// L2 ドッグフーディング是正の実機検証（本番）。使い捨てユーザー+会社を service role で作り、
// 実ログイン → /company/chat で2問を実送信（実API・実LLM）→ 各回答テキストを抽出して出力。
// 後始末で会社・ユーザーを削除。BASE_URL 既定は本番 banto-roumu.com。
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
const email = `l2verify+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)
const QUESTIONS = [
  '就業規則をアップロードできますか',
  'カスハラ義務化はいつからですか',
]

let userId = null
let companyId = null
let browser = null
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  const { data: company, error: coErr } = await admin
    .from('companies').insert({ name: `L2検証_${stamp}`, plan: 'free' }).select('id').single()
  if (coErr) throw new Error(`companies insert: ${coErr.message}`)
  companyId = company.id
  const { error: memErr } = await admin
    .from('company_members').insert({ company_id: companyId, user_id: userId, role: 'admin' })
  if (memErr) throw new Error(`members insert: ${memErr.message}`)
  console.log('temp user/company ready:', email, companyId)

  browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')])
  await page.waitForTimeout(2000)
  console.log('after login url:', page.url())

  await page.goto(`${BASE}/company?companyId=${companyId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log('company url:', page.url())

  await page.goto(`${BASE}/company/chat?companyId=${companyId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  console.log('chat url:', page.url())
  const textarea = page.locator('textarea[aria-label="メッセージを入力"]')
  try {
    await textarea.waitFor({ state: 'visible', timeout: 25000 })
  } catch (e) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 800))
    console.log('--- chat page body (textarea not found) ---\n' + body)
    throw e
  }

  for (const q of QUESTIONS) {
    await textarea.fill(q)
    await page.locator('button[aria-label="送信"]').click()
    // ストリーム完了 = 送信ボタン再活性 & 入力中ドット消滅。
    await page.waitForFunction(() => {
      const b = document.querySelector('button[aria-label="送信"]')
      const typing = document.querySelector('[aria-label="入力中"]')
      return b && !b.disabled && !typing
    }, { timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // 最後の assistant バブル（bg-neutral-100）のテキストを抽出。
    const answer = await page.evaluate(() => {
      const log = document.querySelector('[role="log"]')
      if (!log) return '(no log)'
      const bubbles = log.querySelectorAll('.bg-neutral-100')
      const last = bubbles[bubbles.length - 1]
      return last ? last.textContent.trim() : '(no assistant bubble)'
    })
    console.log('\n==================== Q: ' + q + '\n' + answer + '\n====================')
  }
} catch (e) {
  console.error('FAILED:', (e && e.message) || e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId) } catch (e) { console.error('co cleanup:', e.message) }
  try { if (userId) await admin.auth.admin.deleteUser(userId) } catch (e) { console.error('user cleanup:', e.message) }
  console.log('\ncleaned up temp user/company')
}
