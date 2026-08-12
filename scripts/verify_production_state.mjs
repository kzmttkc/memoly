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

// --- 実行 --------------------------------------------------------------------
await checkAuthSettings()
await checkSchemaApplied()

for (const n of notes) console.log('  ' + n)
if (problems.length) {
  console.error('\n本番状態の検査で問題を検出しました:')
  for (const p of problems) console.error('  NG ' + p)
  process.exit(1)
}
console.log('\nOK: 本番の Auth 設定とスキーマ適用状態はコードの前提と一致しています')
console.log('（注意: RLS ポリシー・トリガ・GRANT は PostgREST から見えないため本検査の対象外。')
console.log('  それらは supabase/*_e2e.mjs の実アカウント越境テストが担当）')
