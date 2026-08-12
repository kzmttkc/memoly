#!/usr/bin/env node
// ============================================================================
// verify_production_state.mjs — 「コードは正しいが本番設定で無効」を検出する
// ----------------------------------------------------------------------------
// なぜ要るか（2026-08-12）:
//   席招待のメール確認ガードは、コード側には正しく書かれていたのに本番の
//   Supabase Auth 設定 mailer_autoconfirm=true によって丸ごと無効化されていた。
//   コードを読むだけでは永遠に気づけない種類の欠陥なので、**本番の実値を取りに行く**
//   検査をリポジトリに置く。同じ理由で「マイグレーションが本番に当たっているか」も
//   ここで実測する（ローカルの .sql が存在することは、本番に適用された証拠ではない）。
//
// 使い方:
//   node scripts/verify_production_state.mjs
//   （.env.local から NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を読む）
//   異常があれば exit 1。CI や日次監視から呼べる。
//
// 何を見るか:
//   [A] Auth 設定    GET /auth/v1/settings の mailer_autoconfirm を
//                    invite-guard.ts の MAILER_AUTOCONFIRM_IN_PRODUCTION と突き合わせる。
//   [B] スキーマ適用  GET /rest/v1/ （PostgREST の OpenAPI）を1回引くと、本番に実在する
//                    テーブル・列・RPC が全部返る。supabase/*.sql が宣言している
//                    CREATE TABLE / ADD COLUMN / CREATE FUNCTION を突き合わせ、
//                    本番に無いものを落とす＝未適用マイグレーションの検出。
//
// この方法の限界（正直に）:
//   PostgREST が公開するのは「テーブル・列・RPC」まで。RLS ポリシー・トリガ・
//   制約・GRANT は返らないので、本検査は **それらの適用は保証しない**。
//   ポリシーとトリガの検証は各 *_e2e.mjs（実アカウントで越境アクセスを試す）が担う。
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const notes = []

// --- .env.local を読む（dotenv 非依存の最小パーサ） ---------------------------
function loadEnv() {
  const env = { ...process.env }
  try {
    for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* CI では実環境変数だけで動く */
  }
  return env
}

const env = loadEnv()
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が読めません')
  process.exit(2)
}
const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

// --- [A] Auth 設定の実値 -----------------------------------------------------
async function checkAuthSettings() {
  const res = await fetch(`${URL_}/auth/v1/settings`, { headers: auth, redirect: 'follow' })
  if (!res.ok) {
    problems.push(`[A] /auth/v1/settings が ${res.status}。Auth 設定を確認できません`)
    return
  }
  const s = await res.json()

  // コード側の宣言値を読む（import すると TS のままなので正規表現で取る）
  const guard = readFileSync(join(ROOT, 'app/api/company/members/invite-guard.ts'), 'utf8')
  const m = guard.match(/MAILER_AUTOCONFIRM_IN_PRODUCTION\s*=\s*(true|false)/)
  if (!m) {
    problems.push('[A] invite-guard.ts から MAILER_AUTOCONFIRM_IN_PRODUCTION を読めません')
    return
  }
  const declared = m[1] === 'true'
  const actual = s.mailer_autoconfirm === true

  if (declared !== actual) {
    problems.push(
      `[A] 本番 mailer_autoconfirm=${actual} だが invite-guard.ts は ${declared} と宣言。` +
        ' 席招待の判定が実態とズレています。invite-guard.ts の定数とヘッダを更新し、' +
        ' autoconfirm を無効化したなら /api/auth/confirm-signup の扱いも同時に見直すこと'
    )
  } else {
    notes.push(`[A] mailer_autoconfirm=${actual}（コードの宣言と一致）`)
  }
  if (s.disable_signup === true) problems.push('[A] disable_signup=true＝新規登録が止まっています（北極星は無料登録）')
  notes.push(`[A] disable_signup=${s.disable_signup} / phone_autoconfirm=${s.phone_autoconfirm}`)
}

// --- [B] マイグレーションの本番適用 ------------------------------------------
// supabase/*.sql が宣言する object を抜き、本番の OpenAPI に在るか照合する。
function declaredObjects() {
  const tables = new Set()
  const columns = new Map() // table -> Set(col)
  const functions = new Set()
  const dir = join(ROOT, 'supabase')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, f), 'utf8')
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      tables.add(m[1].toLowerCase())
    }
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z0-9_]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi
    )) {
      const t = m[1].toLowerCase()
      if (!columns.has(t)) columns.set(t, new Set())
      columns.get(t).add(m[2].toLowerCase())
    }
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)/gi)) {
      functions.add(m[1].toLowerCase())
    }
  }
  return { tables, columns, functions }
}

async function checkSchemaApplied() {
  const res = await fetch(`${URL_}/rest/v1/`, {
    headers: { ...auth, Accept: 'application/openapi+json' },
    redirect: 'follow',
  })
  if (!res.ok) {
    problems.push(`[B] /rest/v1/ (OpenAPI) が ${res.status}。本番スキーマを確認できません`)
    return
  }
  const spec = await res.json()
  const liveTables = new Set(Object.keys(spec.definitions || {}).map((t) => t.toLowerCase()))
  const liveCols = new Map(
    Object.entries(spec.definitions || {}).map(([t, d]) => [
      t.toLowerCase(),
      new Set(Object.keys(d.properties || {}).map((c) => c.toLowerCase())),
    ])
  )
  const liveFns = new Set(
    Object.keys(spec.paths || {})
      .filter((p) => p.startsWith('/rpc/'))
      .map((p) => p.slice(5).toLowerCase())
  )

  const { tables, columns, functions } = declaredObjects()

  const missingTables = [...tables].filter((t) => !liveTables.has(t))
  if (missingTables.length) {
    problems.push(`[B] .sql が作るはずのテーブルが本番に無い（未適用の疑い）: ${missingTables.join(', ')}`)
  }

  const missingCols = []
  for (const [t, cols] of columns) {
    if (!liveTables.has(t)) continue // テーブル欠如は上で報告済み
    for (const c of cols) if (!liveCols.get(t)?.has(c)) missingCols.push(`${t}.${c}`)
  }
  if (missingCols.length) {
    problems.push(`[B] ADD COLUMN が本番に当たっていない列: ${missingCols.join(', ')}`)
  }

  // 関数は PostgREST から見えるのは「RPC として公開されたもの」だけ。
  // トリガ関数（enforce_company_seat_limit 等）は公開されないので欠如＝異常ではない。
  const invisibleFns = [...functions].filter((f) => !liveFns.has(f))
  notes.push(
    `[B] テーブル ${tables.size}件宣言 / 本番 ${liveTables.size}件・不足 ${missingTables.length}件、` +
      ` ADD COLUMN 不足 ${missingCols.length}件`
  )
  if (invisibleFns.length) {
    notes.push(
      `[B] RPC として公開されていない関数（トリガ関数なら正常・要目視）: ${invisibleFns.join(', ')}`
    )
  }
}

// --- [C] 手動 migration 適用台帳の網羅性 -------------------------------------
//   なぜ要るか（2026-08-13 セキュリティ採点 -4）:
//     docs/BANTO_MANUAL_MIGRATIONS.md には①〜④の4本しか載っておらず、
//     high2_rpc_grant_and_search_path.sql / company_members_column_grant.sql /
//     billing_past_due_grace.sql / company_documents.sql が**台帳に存在しなかった**。
//     しかも [B] のスキーマ照合は GRANT/REVOKE 系を**構造的に検出できない**
//     （テーブルも列も関数も作らないため）。つまり「台帳に載っていない」ことが
//     唯一の手掛かりなのに、それを機械が見ていなかった。ここで見る。
function checkMigrationLedger() {
  const ledgerPath = join(ROOT, 'docs/BANTO_MANUAL_MIGRATIONS.md')
  let ledger
  try {
    ledger = readFileSync(ledgerPath, 'utf8')
  } catch {
    problems.push('[C] docs/BANTO_MANUAL_MIGRATIONS.md が読めません（適用台帳が不在）')
    return
  }
  const sqlFiles = readdirSync(join(ROOT, 'supabase')).filter((f) => f.endsWith('.sql'))
  const unlisted = sqlFiles.filter((f) => !ledger.includes(f))
  if (unlisted.length) {
    problems.push(
      `[C] supabase/*.sql のうち台帳に載っていないものが ${unlisted.length} 件: ${unlisted.join(', ')}。` +
        ' 本番に当たっているか誰も追えない状態です。docs/BANTO_MANUAL_MIGRATIONS.md へ' +
        ' ファイル名・適用日・未適用時の実害を追記してください'
    )
  } else {
    notes.push(`[C] 手動 migration 台帳は supabase/*.sql ${sqlFiles.length}件を全て収載`)
  }
}

// --- [D] 列粒度 GRANT / RPC 権限剥奪の「実効性」を本番で実測 -------------------
//   PostgREST は GRANT を返さないので、**振る舞いで測る**。
//     - 権限検査は行の突合(RLS)より先に走るため、存在しない id を条件にすれば
//       1行も触らずに「その列を更新する権限があるか」だけを引き出せる。
//       権限が剥奪されていれば 42501（permission denied）、あれば 204（0件更新）。
//     - 認証済みロールの JWT が要るので、supabase/company_rls_e2e.mjs と同じ流儀で
//       使い捨てユーザーを作り、**必ず finally で削除**する（@example.test）。
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000'

/**
 * authenticated の JWT で 1 行も一致しない条件の UPDATE を投げ、権限だけを引き出す。
 * 返り値は3値: 'denied'（42501）/ 'allowed'（2xx）/ 'unknown'（それ以外）。
 *   ★'unknown' を 'allowed' に丸めない。2026-08-13、`?id=eq.` 決め打ちで
 *     company_members（主キーは company_id,user_id で id 列が無い）に投げて
 *     42703 が返り、それを「許可されている/いない」と読み違えた。
 *     測定器が対象を測れていないときは、結果を作らずに測定不能と言う。
 */
async function patchAs(token, table, filter, body) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  if (res.ok) return { verdict: 'allowed', status: res.status }
  const text = await res.text()
  if (/42501|permission denied/i.test(text)) return { verdict: 'denied', status: res.status }
  return { verdict: 'unknown', status: res.status, text: text.slice(0, 200) }
}

async function checkColumnGrants() {
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!ANON) {
    problems.push('[D] NEXT_PUBLIC_SUPABASE_ANON_KEY が読めず、列粒度 GRANT を実測できません')
    return
  }

  // (1) anon のまま: high2_rpc_grant_and_search_path.sql が revoke したはずの RPC。
  const rpc = await fetch(`${URL_}/rest/v1/rpc/banto_cohort_stats`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: '{}',
    redirect: 'follow',
  })
  const rpcText = await rpc.text()
  const rpcBlocked = rpc.status === 404 || /42501|permission denied/i.test(rpcText)
  if (!rpcBlocked) {
    problems.push(
      `[D] anon が banto_cohort_stats() を実行できます（HTTP ${rpc.status}）。` +
        ' supabase/high2_rpc_grant_and_search_path.sql が本番に当たっていません＝' +
        ' 誰でも全社横断の経営指標を読めます'
    )
  } else {
    notes.push(`[D] anon からの banto_cohort_stats() は遮断（HTTP ${rpc.status}）`)
  }

  // (2) authenticated ロールでの列粒度 GRANT。使い捨てユーザーで測る。
  const stamp = Date.now()
  const email = `e2e_grant_probe_${stamp}@example.test`
  const password = `Probe!${stamp}aA`
  let userId = null
  try {
    const created = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
      redirect: 'follow',
    })
    if (!created.ok) {
      problems.push(`[D] 検査用ユーザーを作成できず列粒度 GRANT を実測できません（HTTP ${created.status}）`)
      return
    }
    userId = (await created.json()).id

    const signIn = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'follow',
    })
    if (!signIn.ok) {
      problems.push(`[D] 検査用ユーザーでサインインできません（HTTP ${signIn.status}）`)
      return
    }
    const token = (await signIn.json()).access_token

    // 主キーが違うので絞り込み条件も表ごとに変える（company_members は id 列を持たない）。
    const ID_FILTER = `id=eq.${NON_EXISTENT_ID}`
    const MEMBER_FILTER = `company_id=eq.${NON_EXISTENT_ID}&user_id=eq.${NON_EXISTENT_ID}`

    // 剥奪されているべき列（更新できたら課金バイパス・席乗っ取りが生きている）
    const denials = [
      ['companies', ID_FILTER, { plan: 'shigyo' }, 'companies.plan（誰でも有料プランへ自己昇格できる）'],
      ['companies', ID_FILTER, { status: 'active' }, 'companies.status'],
      ['company_members', MEMBER_FILTER, { user_id: NON_EXISTENT_ID }, 'company_members.user_id（席の乗っ取り）'],
    ]
    for (const [table, filter, body, label] of denials) {
      const r = await patchAs(token, table, filter, body)
      if (r.verdict === 'allowed') {
        problems.push(
          `[D] authenticated が ${label} を更新できます（HTTP ${r.status}）。` +
            ' 列粒度 GRANT の migration が本番に当たっていません'
        )
      } else if (r.verdict === 'unknown') {
        problems.push(`[D] ${label} を測定できませんでした（HTTP ${r.status} / ${r.text}）`)
      } else {
        notes.push(`[D] ${label} の更新は遮断（HTTP ${r.status}）`)
      }
    }

    // 許可されているべき列（ここまで塞がっていたら機能が壊れている＝過剰剥奪）
    const allowed = [
      ['companies', ID_FILTER, { name: 'grant-probe' }, 'companies.name'],
      ['company_members', MEMBER_FILTER, { role: 'member' }, 'company_members.role'],
    ]
    for (const [table, filter, body, label] of allowed) {
      const r = await patchAs(token, table, filter, body)
      if (r.verdict === 'denied') {
        problems.push(`[D] ${label} まで剥奪されています（過剰剥奪・画面の正常操作が 403 になります）`)
      } else if (r.verdict === 'unknown') {
        problems.push(`[D] ${label} を測定できませんでした（HTTP ${r.status} / ${r.text}）`)
      } else {
        notes.push(`[D] ${label} は更新可（許可列として正常）`)
      }
    }
  } finally {
    if (userId) {
      const del = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: auth,
        redirect: 'follow',
      })
      if (!del.ok) {
        problems.push(
          `[D] 検査用ユーザー ${email} を削除できませんでした（HTTP ${del.status}）。` +
            ' auth.users に残ると外部登録数の計測を汚すため、手動で削除してください'
        )
      } else {
        notes.push('[D] 検査用ユーザーは削除済み（auth.users に残していません）')
      }
    }
  }
}

// --- 実行 --------------------------------------------------------------------
await checkAuthSettings()
await checkSchemaApplied()
checkMigrationLedger()
await checkColumnGrants()

for (const n of notes) console.log('  ' + n)
if (problems.length) {
  console.error('\n本番状態の検査で問題を検出しました:')
  for (const p of problems) console.error('  NG ' + p)
  process.exit(1)
}
console.log('\nOK: 本番の Auth 設定・スキーマ適用・適用台帳・列粒度GRANTはコードの前提と一致しています')
console.log('（対象外: RLS ポリシーとトリガの実体。これらは supabase/*_e2e.mjs の')
console.log('  実アカウント越境テストが担当する。GRANT は 2026-08-13 に [D] で本検査へ取り込んだ）')
