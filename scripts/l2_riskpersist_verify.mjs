// L2 是正の実機検証その3（本番）: 診断を実行→結果表示→ページ再読込しても結果が
// localStorage から復元され「前回の診断結果を表示しています」で即表示されること（N7-①）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE_URL ?? 'https://banto-roumu.com'
const { chromium } = await import('@playwright/test')
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `l2rp+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)

let userId = null, companyId = null, browser = null
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (cErr) throw cErr
  userId = created.user.id
  const { data: company, error: coErr } = await admin
    .from('companies').insert({ name: `L2RP_${stamp}`, plan: 'free' }).select('id').single()
  if (coErr) throw new Error(coErr.message)
  companyId = company.id
  await admin.from('company_members').insert({ company_id: companyId, user_id: userId, role: 'admin' })

  browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')])
  await page.waitForTimeout(2500)
  await page.goto(`${BASE}/company?companyId=${companyId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.goto(`${BASE}/company/risk?companyId=${companyId}`, { waitUntil: 'networkidle' })

  // 診断実行（手動ボタン）。
  const btn = page.getByRole('button', { name: /労務リスクをセルフ診断する/ })
  await btn.waitFor({ state: 'visible', timeout: 20000 })
  await btn.click()
  // 結果（スコアの帯ラベルや上位ポイント見出し）が出るまで待つ（LLM ~30s）。
  await page.getByText('いま気になる上位ポイント').waitFor({ state: 'visible', timeout: 70000 })
  await page.waitForTimeout(1500)
  const scoreBefore = await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d{1,3})\s*\/\s*100/)
    return m ? m[1] : '(score not found)'
  })
  console.log('診断実行後のスコア:', scoreBefore)

  // ページを再読込（direct re-visit 相当）。
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const restored = await page.evaluate(() => document.body.innerText.includes('前回の診断結果を表示しています'))
  const scoreAfter = await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d{1,3})\s*\/\s*100/)
    return m ? m[1] : '(none)'
  })
  const stillHasResult = await page.evaluate(() => document.body.innerText.includes('いま気になる上位ポイント'))
  console.log('再読込後: 復元バナー=', restored, ' スコア=', scoreAfter, ' 結果表示継続=', stillHasResult)
  console.log(restored && stillHasResult && scoreAfter === scoreBefore ? 'RESULT: PASS' : 'RESULT: FAIL')
} catch (e) {
  console.error('FAILED:', (e && e.message) || e); process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId) } catch {}
  try { if (userId) await admin.auth.admin.deleteUser(userId) } catch {}
  console.log('cleaned up')
}
