// L2 是正の実機検証その2（本番）: 期限をUIから追加し、ページ再読込せずに一覧へ即時反映
// されることを実測（N7-②/二重登録防止）。使い捨てユーザー+会社を作り後始末する。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE_URL ?? 'https://banto-roumu.com'
const { chromium } = await import('@playwright/test')

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `l2dl+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)
const TITLE = 'L2検証_36協定の更新_' + Math.random().toString(36).slice(2, 6)
const DUE = '2026-12-15'

let userId = null, companyId = null, browser = null
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (cErr) throw cErr
  userId = created.user.id
  const { data: company, error: coErr } = await admin
    .from('companies').insert({ name: `L2DL_${stamp}`, plan: 'free' }).select('id').single()
  if (coErr) throw new Error(coErr.message)
  companyId = company.id
  const { error: mErr } = await admin.from('company_members')
    .insert({ company_id: companyId, user_id: userId, role: 'admin' })
  if (mErr) throw new Error(mErr.message)

  browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')])
  await page.waitForTimeout(2500)
  console.log('after login url:', page.url())

  await page.goto(`${BASE}/company?companyId=${companyId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/company/deadlines?companyId=${companyId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log('deadlines url:', page.url())
  try {
    await page.locator('#d-title').waitFor({ state: 'visible', timeout: 20000 })
  } catch (e) {
    console.log('body:', (await page.evaluate(() => document.body.innerText)).slice(0, 600))
    throw e
  }

  // 追加前: 一覧に当該タイトルが無いこと。
  const before = await page.evaluate((t) => document.body.innerText.includes(t), TITLE)
  await page.fill('#d-title', TITLE)
  await page.fill('#d-due', DUE)
  await page.click('button[type="submit"]')

  // 追加直後、ページ遷移/リロードせずに一覧へ反映されるか（最大8秒・楽観更新なら即時）。
  let appeared = false
  for (let i = 0; i < 16; i++) {
    // 登録済み一覧のカード（CalendarClock付きの期限行）に出たかを、フォームのplaceholderや
    // サジェストと区別して判定する: 期限リストの各行は残日数バッジ「残り」を含む。
    appeared = await page.evaluate((t) => {
      const cards = Array.from(document.querySelectorAll('li, div'))
      return cards.some(el => el.textContent.includes(t) && el.textContent.includes('期日の目安'))
    }, TITLE)
    if (appeared) { console.log(`一覧反映まで約 ${i * 500}ms（リロード無し）`); break }
    await page.waitForTimeout(500)
  }
  console.log('addTitle:', TITLE)
  console.log('before(list had title):', before)
  console.log('after(list shows title WITHOUT reload):', appeared)

  // DB 実在確認（service role）。
  const { data: rows } = await admin.from('company_deadlines')
    .select('title, due_on').eq('company_id', companyId)
  console.log('DB rows:', JSON.stringify(rows))
  console.log(appeared && rows?.some(r => r.title === TITLE) ? 'RESULT: PASS' : 'RESULT: FAIL')
} catch (e) {
  console.error('FAILED:', (e && e.message) || e); process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId) } catch {}
  try { if (userId) await admin.auth.admin.deleteUser(userId) } catch {}
  console.log('cleaned up')
}
