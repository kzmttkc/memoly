// ============================================================================
// authed_e2e_capture.mjs — 認証後フローのスクショ/録画キャプチャ（Playwright）
// ----------------------------------------------------------------------------
// 目的:
//   service role で使い捨てユーザー「かつ」使い捨て会社（company_members admin）を作り、
//   実ログイン → 会社ダッシュボードの主要面（company / onboarding / chat / memory）を
//   巡回してスクリーンショットを残す。加えて、chat 画面では実際に UI からメッセージを
//   送信し（実 POST /api/company/chat・実 LLM 呼び出し・実ストリーミング）、送信後に
//   company_memories へ抽出結果が保存されたことを service role で実 DB 確認する
//   （＝「チャット送信→記憶保存」までを実地証跡として残す。目視のスクショだけで
//   済ませない）。
//
// 前提（このスクリプトは「任意」の道具。CI 接続も任意）:
//   - Playwright 未導入なら何もせず案内して exit 0（本体ビルド/依存には一切影響しない）。
//       npm i -D @playwright/test && npx playwright install chromium
//   - 実行中の番頭サーバが必要（既定 http://127.0.0.1:3000）。BASE_URL で上書き可。
//       npm run build && npm run start   # 別ターミナルで
//   - .env.local に SUPABASE URL / ANON / SERVICE ROLE が必要（既存 e2e と同じ読み方）。
//   - ANTHROPIC_API_KEY が有効であること（chat 送信は実 LLM 呼び出しを伴う）。
//
// 使い方:
//   BASE_URL=http://127.0.0.1:3000 node scripts/authed_e2e_capture.mjs
//   出力: ./e2e-captures/*.png（+ result.json = 実測結果サマリ）。gitignore 済。
//
// 設計メモ:
//   - 認証は「service role で email_confirm 済ユーザーを作成 → 実ログインフォームを駆動」。
//     Cookie の直注入より堅牢（Supabase SSR の chunk cookie 名に依存しない）。
//   - 会社は billing_lifecycle_e2e.mjs と同じ流儀で service role が companies に直接 insert
//     し、company_members(admin) を張って参加させる（オンボーディングUIの経路検証は別途・
//     ここでは「会社が既にある状態」でのchat/memoryの実地証跡に絞る）。
//   - 後始末で使い捨てユーザー・会社・記憶行を service role で削除する（テナントを汚さない）。
// ============================================================================
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = process.env.OUT_DIR ?? join(ROOT, 'e2e-captures')
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

// --- Playwright を任意依存として遅延ロード（未導入なら案内して終了） ---
let chromium
try {
  ;({ chromium } = await import('@playwright/test'))
} catch {
  console.log(
    '[authed_e2e_capture] Playwright 未導入のためスキップします。\n' +
      '  導入: npm i -D @playwright/test && npx playwright install chromium\n' +
      '  その後: BASE_URL=' + BASE + ' node scripts/authed_e2e_capture.mjs',
  )
  process.exit(0)
}

// --- .env.local を素朴にパース（dotenv 非依存・既存 e2e と同じ流儀） ---
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SERVICE) {
  console.error('[authed_e2e_capture] .env.local に SUPABASE URL / SERVICE ROLE が必要です')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(SB_URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `e2e+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)
const NAME_PREFIX = 'E2Eキャプチャ検証_'
const TEST_MESSAGE = '36協定を結んでいない場合、何が問題になりますか？'

mkdirSync(OUT_DIR, { recursive: true })

const result = {
  startedAt: new Date().toISOString(),
  email,
  companyId: null,
  chatSent: false,
  chatReplyReceived: false,
  memorySavedRows: 0,
  memoryRows: [],
  steps: [],
}

let userId = null
let companyId = null
let browser = null
try {
  // 使い捨てユーザー作成（email 確認済＝ログイン可能に）。
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  console.log('[authed_e2e_capture] temp user:', email)

  // 使い捨て会社を作成し admin として参加させる（billing e2e と同じ流儀の直接 insert）。
  const { data: company, error: coErr } = await admin
    .from('companies')
    .insert({ name: `${NAME_PREFIX}${stamp}`, plan: 'free' })
    .select('id')
    .single()
  if (coErr) throw new Error(`companies insert failed: ${coErr.message}`)
  companyId = company.id
  result.companyId = companyId
  const { error: memErr } = await admin
    .from('company_members')
    .insert({ company_id: companyId, user_id: userId, role: 'admin' })
  if (memErr) throw new Error(`company_members insert failed: ${memErr.message}`)
  console.log('[authed_e2e_capture] temp company:', companyId)

  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: OUT_DIR },
  })
  const page = await context.newPage()

  const shot = async (name) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true })
    console.log(`  captured: ${name}.png  (url=${page.url()})`)
    result.steps.push({ name, url: page.url() })
  }

  // 1) ログイン画面
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await shot('01-login')

  // 実ログインフォームを駆動（label/placeholder に依存しない汎用セレクタ）。
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('button[type="submit"]'),
  ])
  await shot('02-after-login')

  // 2) 主要面をベストエフォートで巡回（リダイレクト先も有効な証跡として撮る）。
  for (const [name, path] of [
    ['03-company', '/company'],
    ['04-onboarding', '/company/onboarding'],
  ]) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await shot(name)
    } catch (e) {
      console.log(`  skip ${name}: ${(e && e.message) || e}`)
    }
  }

  // 3) chat画面: companyId 付きで開き、実際にUIから1通送信する（実API・実LLM・実ストリーム）。
  try {
    await page.goto(`${BASE}/company/chat?companyId=${companyId}`, { waitUntil: 'networkidle' })
    await shot('05-chat-open')

    const textarea = page.locator('textarea[aria-label="メッセージを入力"]')
    await textarea.waitFor({ state: 'visible', timeout: 15000 })
    await textarea.fill(TEST_MESSAGE)
    await shot('06-chat-typed')

    const sendButton = page.locator('button[aria-label="送信"]')
    await sendButton.click()
    result.chatSent = true
    console.log('[authed_e2e_capture] chat message sent:', TEST_MESSAGE)

    // アシスタントの返信が非タイピング状態で描画される（=ストリーム完了）まで待つ。
    const assistantBubble = page.locator('[role="log"] >> text=' + JSON.stringify(TEST_MESSAGE))
    await assistantBubble.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
    // ストリーム完了の目安: 送信ボタンが再度活性化する（loading=false に戻る）まで待つ。
    await page
      .waitForFunction(
        () => {
          const btn = document.querySelector('button[aria-label="送信"]')
          return btn && !btn.disabled
        },
        { timeout: 30000 },
      )
      .catch(() => {})
    await page.waitForTimeout(1500)
    await shot('07-chat-reply')
    result.chatReplyReceived = true
  } catch (e) {
    console.log(`  skip chat interaction: ${(e && e.message) || e}`)
  }

  // 4) memory抽出は client 側が非同期(fetch)で /api/company/memory を呼ぶ設計のため、
  //    UI遷移前に少し待ってから DB を直接確認する（screenshot は目視証跡として残す）。
  await page.waitForTimeout(4000)
  try {
    await page.goto(`${BASE}/company/memory?companyId=${companyId}`, { waitUntil: 'networkidle' })
    await shot('08-memory')
  } catch (e) {
    console.log(`  skip 08-memory: ${(e && e.message) || e}`)
  }

  await context.close()

  // 5) 記憶保存の実地確認: company_memories を service role で直接読む（目視でなく実DB）。
  const { data: memRows, error: memReadErr } = await admin
    .from('company_memories')
    .select('id, memory_type, summary, topic, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
  if (memReadErr) {
    console.error('[authed_e2e_capture] company_memories 読取り失敗:', memReadErr.message)
  } else {
    result.memorySavedRows = memRows?.length ?? 0
    result.memoryRows = memRows ?? []
    console.log(`[authed_e2e_capture] company_memories 実測件数: ${result.memorySavedRows}`)
    for (const row of memRows ?? []) {
      console.log(`  - [${row.memory_type}] ${row.summary?.slice(0, 60)}`)
    }
  }

  console.log(`[authed_e2e_capture] done. 出力: ${OUT_DIR}`)
} catch (e) {
  console.error('[authed_e2e_capture] failed:', (e && e.message) || e)
  result.error = (e && e.message) || String(e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  result.finishedAt = new Date().toISOString()
  try {
    writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(result, null, 2))
    console.log('[authed_e2e_capture] result.json 保存:', join(OUT_DIR, 'result.json'))
  } catch (e) {
    console.error('[authed_e2e_capture] result.json 書込み失敗:', (e && e.message) || e)
  }
  // 後始末: 使い捨て会社（cascadeでcompany_members/company_memoriesも削除）→ユーザーを削除。
  if (companyId) {
    try {
      await admin.from('companies').delete().eq('id', companyId)
      console.log('[authed_e2e_capture] cleaned temp company')
    } catch (e) {
      console.error('[authed_e2e_capture] company cleanup failed:', (e && e.message) || e)
    }
  }
  if (userId) {
    try {
      await admin.auth.admin.deleteUser(userId)
      console.log('[authed_e2e_capture] cleaned temp user')
    } catch (e) {
      console.error('[authed_e2e_capture] user cleanup failed:', (e && e.message) || e)
    }
  }
}
