// ============================================================================
// document_diff_e2e.mjs — D22 規程改定の差分要約 E2E（Playwright・実UI駆動）
// ----------------------------------------------------------------------------
// 目的:
//   service role で使い捨てユーザー+会社(admin)を作り、実ログイン →
//   /company/documents の実UIから同じ規程名で **2回** 取込を行い、
//     1回目（初回）: changeSummary が出ない（LLM不発火＝コスト最小）こと
//     2回目（改定）: 「前回の取込からの変更点（自動要約）」カードが実表示されること
//   を検証する。加えて company_memories(topic='規程の改定') への保存を
//   service role で実DB確認する（目視スクショだけで済ませない）。
//
// 前提・使い方は authed_e2e_capture.mjs と同じ（Playwright 任意導入・.env.local 必須）:
//   BASE_URL=https://banto-roumu.com node scripts/document_diff_e2e.mjs
//   出力: ./e2e-captures/diff-*.png + diff-result.json（gitignore 済）
//
// 後始末: companies 削除（CASCADE で members/documents/memories も消える）→ user 削除。
// ============================================================================
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = process.env.OUT_DIR ?? join(ROOT, 'e2e-captures')
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

let chromium
try {
  ;({ chromium } = await import('@playwright/test'))
} catch {
  console.log('[document_diff_e2e] Playwright 未導入のためスキップします。')
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
  console.error('[document_diff_e2e] .env.local に SUPABASE URL / SERVICE ROLE が必要です')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(SB_URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `e2e-diff+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)
const TITLE = 'E2E差分検証規程'

// v1: 初版。v2: 有給10日→12日へ変更・在宅勤務の条文を追加・服装規定を削除。
const REG_V1 = `第1条 所定労働時間は1日8時間、週40時間とする。
第2条 年次有給休暇は入社6ヶ月経過後に10日を付与する。
第3条 時間外労働は月45時間を上限とする。
第4条 勤務中の服装は事務所指定の制服とする。`
const REG_V2 = `第1条 所定労働時間は1日8時間、週40時間とする。
第2条 年次有給休暇は入社6ヶ月経過後に12日を付与する。
第3条 時間外労働は月45時間を上限とする。
第4条 在宅勤務は週2日まで認め、対象者は入社1年以上の従業員とする。`

mkdirSync(OUT_DIR, { recursive: true })

const result = {
  startedAt: new Date().toISOString(),
  base: BASE,
  email,
  companyId: null,
  firstIngestOk: false,
  firstSummaryShown: null, // 期待: false（初回はLLM不発火）
  secondIngestOk: false,
  summaryCardShown: false,
  summaryText: null,
  memoryRowSaved: false,
  memoryRowSummary: null,
}

let userId = null
let companyId = null
let browser = null
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id

  const { data: company, error: coErr } = await admin
    .from('companies')
    .insert({ name: `E2E差分検証_${stamp}`, plan: 'free' })
    .select('id')
    .single()
  if (coErr) throw new Error(`companies insert failed: ${coErr.message}`)
  companyId = company.id
  result.companyId = companyId
  const { error: memErr } = await admin
    .from('company_members')
    .insert({ company_id: companyId, user_id: userId, role: 'admin' })
  if (memErr) throw new Error(`company_members insert failed: ${memErr.message}`)
  console.log('[document_diff_e2e] temp user/company:', email, companyId)

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const shot = async (name) => {
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true })
    console.log(`  captured: ${name}.png`)
  }

  // ログイン
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // ログイン完了＝/login から離れるのを明示的に待つ（networkidle はSPA遷移を取りこぼす）。
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(async () => {
    await shot('diff-00-login-stuck')
    throw new Error(`login did not redirect (url=${page.url()})`)
  })
  await shot('diff-00-after-login')

  // documents ページ → 規程レビュータブ
  await page.goto(`${BASE}/company/documents?companyId=${companyId}`, { waitUntil: 'networkidle' })
  const reviewTab = page.locator('button:has-text("規程をレビュー")')
  await reviewTab.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
    await shot('diff-00-documents-page')
    throw new Error(`review tab not found (url=${page.url()})`)
  })
  await reviewTab.click()

  // 取込フォーム（規程名+全文を覚えさせる）は「レビュー実行後」に現れる設計のため、
  // まず v1 でレビューを1回実行してフォームを出す（document_review 1/3 消費）。
  await page.fill('#review-text', REG_V1)
  await page.click('button:has-text("この規程をレビューする")')
  await page.waitForSelector('input[aria-label="規程名"]', { timeout: 90000 })

  const fillAndIngest = async (text) => {
    await page.fill('#review-text', text)
    await page.fill('input[aria-label="規程名"]', TITLE)
    await page.click('button:has-text("全文を覚えさせる")')
  }

  // --- 1回目（初回取込・LLM不発火のはず）---
  await fillAndIngest(REG_V1)
  await page.waitForSelector(`text=「${TITLE}」を覚えました`, { timeout: 20000 })
  result.firstIngestOk = true
  // 初回に要約カードが「出ない」ことを確認（3秒待って不在なら期待どおり）。
  await page.waitForTimeout(3000)
  result.firstSummaryShown =
    (await page.locator('text=前回の取込からの変更点').count()) > 0
  await shot('diff-01-first-ingest')
  console.log('[document_diff_e2e] 1回目取込OK・要約カード表示:', result.firstSummaryShown, '(期待: false)')

  // --- 2回目（同名再取込＝改定・要約カードが出るはず）---
  await fillAndIngest(REG_V2)
  // 更新トースト（LLM完了後に出る）→ 要約カードを待つ。haiku要約ぶん長めに待つ。
  await page.waitForSelector('text=前回の取込からの変更点', { timeout: 90000 })
  result.secondIngestOk = true
  result.summaryCardShown = true
  await shot('diff-02-second-ingest-summary')
  // カード本文（要約テキスト）を実取得。
  const card = page.locator('text=前回の取込からの変更点').locator('..')
  result.summaryText = (await card.innerText()).trim()
  console.log('[document_diff_e2e] 要約カード実表示。本文:')
  console.log(result.summaryText)

  await context.close()

  // --- 実DB確認: company_memories(topic='規程の改定') が保存されているか ---
  const { data: rows, error: rErr } = await admin
    .from('company_memories')
    .select('summary, memory_type, topic')
    .eq('company_id', companyId)
    .eq('topic', '規程の改定')
  if (rErr) throw new Error(`company_memories read failed: ${rErr.message}`)
  result.memoryRowSaved = (rows?.length ?? 0) > 0
  result.memoryRowSummary = rows?.[0]?.summary ?? null
  console.log('[document_diff_e2e] 記憶保存 実DB確認:', result.memoryRowSaved, '件数:', rows?.length)
  if (rows?.[0]) console.log('  memory:', rows[0].summary.slice(0, 200))

  const pass =
    result.firstIngestOk &&
    result.firstSummaryShown === false &&
    result.summaryCardShown &&
    result.memoryRowSaved
  console.log(pass ? '[document_diff_e2e] PASS' : '[document_diff_e2e] FAIL')
  if (!pass) process.exitCode = 1
} catch (e) {
  console.error('[document_diff_e2e] failed:', (e && e.message) || e)
  result.error = (e && e.message) || String(e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  result.finishedAt = new Date().toISOString()
  try {
    writeFileSync(join(OUT_DIR, 'diff-result.json'), JSON.stringify(result, null, 2))
  } catch {}
  // 後始末: 会社（CASCADE: members/documents/memories）→ ユーザー。
  if (companyId) {
    try {
      await admin.from('companies').delete().eq('id', companyId)
      console.log('[document_diff_e2e] cleaned temp company')
    } catch (e) {
      console.error('[document_diff_e2e] company cleanup failed:', (e && e.message) || e)
    }
  }
  if (userId) {
    try {
      await admin.auth.admin.deleteUser(userId)
      console.log('[document_diff_e2e] cleaned temp user')
    } catch (e) {
      console.error('[document_diff_e2e] user cleanup failed:', (e && e.message) || e)
    }
  }
}
