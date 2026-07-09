// ============================================================================
// authed_theme_capture.mjs — 会社版 /company の「ライト/ダーク両モード」実描画証跡。
// ----------------------------------------------------------------------------
// authed_e2e_capture.mjs の認証方式（service role で使い捨てユーザー作成→実ログイン）を
// 流用し、会社を1社作成したうえで /company 配下の主要面をライト/ダークの両方で撮る。
// ダーク/ライトは localStorage('banto-theme') を切り替え、各ページ遷移で
// /public/banto-theme-init.js（beforeInteractive）が data-theme を確定する挙動を実測する。
//
// 使い方:
//   npm run build && npm run start   # 別ターミナル
//   BASE_URL=http://127.0.0.1:3000 node scripts/authed_theme_capture.mjs
//   出力: ./e2e-captures/theme/{light,dark}-*.png（gitignore 済）
// ============================================================================
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = process.env.OUT_DIR ?? join(ROOT, 'e2e-captures', 'theme')
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

let chromium
try {
  ;({ chromium } = await import('@playwright/test'))
} catch {
  console.log('[theme_capture] Playwright 未導入のためスキップ（npm i -D @playwright/test）')
  process.exit(0)
}

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SERVICE) {
  console.error('[theme_capture] .env.local に SUPABASE URL / SERVICE ROLE が必要です')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(SB_URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `e2e-theme+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)

mkdirSync(OUT_DIR, { recursive: true })

// 撮影する /company 配下の面（companyId を付与して巡回）。
const PAGES = [
  ['hub', '/company'],
  ['home', '/company/home'],
  ['chat', '/company/chat'],
  ['rules', '/company/rules'],
  ['documents', '/company/documents'],
  ['risk', '/company/risk'],
  ['insights', '/company/insights'],
  ['reports', '/company/reports'],
  ['deadlines', '/company/deadlines'],
  ['memory', '/company/memory'],
  ['billing', '/company/billing'],
]

let userId = null
let companyId = ''
let browser = null
let consoleErrors = []
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  console.log('[theme_capture] temp user:', email)

  // --- 認証: ヘッドレスブラウザから Supabase 直アクセスできない環境向けに、
  //   node（ネットワーク可）でサインインしてセッションを取得し、@supabase/ssr が
  //   期待する形式のクッキーを createServerClient で正確に符号化してブラウザへ注入する。
  //   認証はミドルウェア（サーバ側・ネットワーク可）が検証し、データ取得は同一オリジンの
  //   /api/* 経由（同じくサーバ側）なので、ブラウザ→Supabase 直通は不要になる。
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const { createServerClient } = await import('@supabase/ssr')
  const anon = createClient(SB_URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({ email, password })
  if (sErr) throw sErr
  const jar = {}
  const ssr = createServerClient(SB_URL, ANON, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: list => list.forEach(({ name, value }) => (jar[name] = value)),
    },
  })
  await ssr.auth.setSession({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  })
  const cookies = Object.entries(jar).map(([name, value]) => ({
    name,
    value,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }))
  console.log(`[theme_capture] injecting ${cookies.length} auth cookie(s)`)

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies(cookies)
  const page = await context.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`${page.url()} :: ${msg.text()}`)
  })

  // 会社を1社作成し、サンプルの自社ルールを数件登録（同一オリジンの認証済 fetch＝確実）。
  //   ブラウザ→/api/*（サーバ側でネットワーク可）なので companyId を安定して得られる。
  await page.goto(`${BASE}/company`, { waitUntil: 'networkidle' })
  try {
    const created = await page.evaluate(async () => {
      const r = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'テスト商事株式会社' }),
      })
      return r.ok ? await r.json() : null
    })
    companyId = created?.company?.companyId ?? ''
    if (companyId) {
      const rules = [
        ['所定労働時間', '1日8時間 / 週40時間'],
        ['36協定', '締結済み（限度時間 月45時間・年360時間）'],
        ['給与締め日', '毎月末締め・翌月25日払い'],
      ]
      for (const [key, value] of rules) {
        await page.evaluate(
          async ([cid, k, v]) => {
            await fetch('/api/company/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ companyId: cid, key: k, value: v }),
            })
          },
          [companyId, key, value],
        )
      }
    }
  } catch (e) {
    console.log('  会社作成スキップ:', (e && e.message) || e)
  }
  console.log('[theme_capture] companyId =', companyId || '(なし)')

  const q = companyId ? `?companyId=${companyId}` : ''

  for (const theme of ['light', 'dark']) {
    // localStorage を設定（以降の遷移で init script が data-theme を確定）。
    await page.goto(`${BASE}/company${q}`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(t => localStorage.setItem('banto-theme', t), theme)

    for (const [name, path] of PAGES) {
      try {
        await page.goto(`${BASE}${path}${path === '/company' ? q : q}`, {
          waitUntil: 'networkidle',
        })
        await page.waitForTimeout(500)
        const applied = await page.evaluate(
          () => document.documentElement.getAttribute('data-theme'),
        )
        await page.screenshot({
          path: join(OUT_DIR, `${theme}-${name}.png`),
          fullPage: true,
        })
        console.log(`  ${theme}-${name}.png  (data-theme=${applied})`)
      } catch (e) {
        console.log(`  skip ${theme}-${name}: ${(e && e.message) || e}`)
      }
    }

    // コマンドパレット（Cmd/Ctrl+K）の実描画も1枚だけ残す。
    try {
      await page.goto(`${BASE}/company/home${q}`, { waitUntil: 'networkidle' })
      await page.keyboard.press('Meta+k')
      await page.waitForTimeout(200)
      // Meta が効かない環境向けに Control でも試す。
      const visible = await page.evaluate(
        () => !!document.querySelector('[aria-label="コマンドパレット"]'),
      )
      if (!visible) {
        await page.keyboard.press('Control+k')
        await page.waitForTimeout(200)
      }
      await page.screenshot({
        path: join(OUT_DIR, `${theme}-command-palette.png`),
        fullPage: false,
      })
      console.log(`  ${theme}-command-palette.png`)
      await page.keyboard.press('Escape')
    } catch (e) {
      console.log(`  skip ${theme}-command-palette: ${(e && e.message) || e}`)
    }
  }

  await context.close()
  console.log(`[theme_capture] done. 出力: ${OUT_DIR}`)
  if (consoleErrors.length) {
    console.log(`[theme_capture] console.error 検出 (${consoleErrors.length}):`)
    for (const e of consoleErrors.slice(0, 20)) console.log('   -', e)
  } else {
    console.log('[theme_capture] console.error: 0')
  }
} catch (e) {
  console.error('[theme_capture] failed:', (e && e.message) || e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  // 会社を先に消す（company_* は ON DELETE CASCADE で連鎖削除）。
  //   deleteUser は company_members しか cascade しないため、会社本体は明示削除が必要
  //   （さもないと本番DBに孤児会社が溜まる）。
  if (companyId) {
    await admin.from('companies').delete().eq('id', companyId).then(
      () => console.log('[theme_capture] cleaned temp company'),
      () => {},
    )
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    console.log('[theme_capture] cleaned temp user')
  }
}
