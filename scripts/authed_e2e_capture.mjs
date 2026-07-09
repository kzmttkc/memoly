// ============================================================================
// authed_e2e_capture.mjs — 認証後フローのスクショ/録画キャプチャ（Playwright）
// ----------------------------------------------------------------------------
// 目的:
//   service role で使い捨てユーザーを作り、実ログイン → 会社ダッシュボードの主要面
//   （company / onboarding / chat / memory）を巡回してスクリーンショット（と録画）を
//   残す。デザイン回帰の目視・不具合の再現・リリースノート用の素材に使う。
//
// 前提（このスクリプトは「任意」の道具。CI 接続も任意）:
//   - Playwright 未導入なら何もせず案内して exit 0（本体ビルド/依存には一切影響しない）。
//       npm i -D @playwright/test && npx playwright install chromium
//   - 実行中の番頭サーバが必要（既定 http://127.0.0.1:3000）。BASE_URL で上書き可。
//       npm run build && npm run start   # 別ターミナルで
//   - .env.local に SUPABASE URL / ANON / SERVICE ROLE が必要（既存 e2e と同じ読み方）。
//
// 使い方:
//   BASE_URL=http://127.0.0.1:3000 node scripts/authed_e2e_capture.mjs
//   出力: ./e2e-captures/*.png（+ trace.zip 相当の録画があれば）。gitignore 済。
//
// 設計メモ:
//   - 認証は「service role で email_confirm 済ユーザーを作成 → 実ログインフォームを駆動」。
//     Cookie の直注入より堅牢（Supabase SSR の chunk cookie 名に依存しない）。
//   - 会社が無い新規ユーザーは /company が作成/オンボーディングへ誘導する。各URLは
//     ベストエフォートで訪問し、描画されたものをそのまま撮る（リダイレクト先も有効な証跡）。
//   - 後始末で使い捨てユーザーを service role で削除する（テナントを汚さない）。
// ============================================================================
import { readFileSync, mkdirSync } from 'node:fs'
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

mkdirSync(OUT_DIR, { recursive: true })

let userId = null
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
    ['05-chat', '/company/chat'],
    ['06-memory', '/company/memory'],
  ]) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await shot(name)
    } catch (e) {
      console.log(`  skip ${name}: ${(e && e.message) || e}`)
    }
  }

  await context.close()
  console.log(`[authed_e2e_capture] done. 出力: ${OUT_DIR}`)
} catch (e) {
  console.error('[authed_e2e_capture] failed:', (e && e.message) || e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  // 後始末: 使い捨てユーザーを削除（テナントを汚さない）。
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    console.log('[authed_e2e_capture] cleaned temp user')
  }
}
