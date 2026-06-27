// ============================================================================
// company_document_e2e.mjs — 提案A（書類生成＋規程レビュー）の実トランザクションE2E
//
//   証拠主義: 「会社プロファイルが生成ドラフトに効いているか」「レビューが危険条文を
//   実際に指摘するか」を sonnet-4-6 の実応答テキストで確認する。
//
//   手順:
//     1. service role でテスト会社(製造業/8名/36協定未締結/月60h残業) + adminユーザー作成
//     2. 書類生成: Dify(36協定ボット)優先→不可なら sonnet で会社プロファイル＋ひな型から
//        ドラフト生成。生成物が会社前提（未締結/60h/製造業）を踏まえるか検査。
//     3. 規程レビュー: 「残業は固定残業代に含む、上限なし」を含むサンプル規程を sonnet に
//        レビューさせ、リスク指摘（固定残業代/上限/時間外）が返るか検査。
//     4. teardown: 会社/ユーザーを service role で完全削除。
//
//   ※ APIルートはNext.jsのcookie認証依存のため、ここでは route と同じ lib ロジック
//     （prompts/dify）を import して「実モデル呼び出し」を行い振る舞いを実証する。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { register } from 'node:module'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of readFileSync(join(__dir, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY
if (!URL || !SERVICE || !ANTHROPIC_KEY) throw new Error('env missing')

const CHAT_MODEL = 'claude-sonnet-4-6'
const DIFY_KEYS_PATH = '/Users/takeshi/Takeshi_Automation/config/x_keys.json'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

const stamp = Date.now()
let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

// --- lib/prompts.ts と同じビルダー（route が使うものを再現）---
function profilesText(profiles) {
  return profiles.length ? profiles.map(p => `- ${p.key}：${p.value}`).join('\n')
    : '（自社ルール未登録）'
}
function buildDocGenSystem(companyName, label, profiles) {
  return `あなたは「${companyName}」の労務担当を支援するAIアシスタントです。
以下の「自社ルール」を前提に、${label}のドラフト（たたき台）を日本語で作成してください。
【${companyName}の自社ルール・制度（必ず反映する）】
${profilesText(profiles)}
【作成ルール】
- 上の自社ルールを必ず反映してください（所定労働時間・36協定の有無等を織り込む）。
- 自社ルールに無い項目は一般的な値で埋め「（要確認）」を付す。
- 自社ルールが現行法に抵触するおそれがあれば「（法令上のリスクの可能性：〜）」と条件形で添える。
- 「社労士監修」「AI社労士」「法的精度」は使わない。本文のみ出力。`
}
function buildReviewSystem(companyName, profiles) {
  return `あなたは「${companyName}」の労務担当を支援するAIアシスタントです。
ユーザーが貼り付けた既存規程を読み、危ない条文/不足/古い規定を点検してください。
【自社ルール（参考）】\n${profilesText(profiles)}
【点検観点】危ない条文（時間外上限規制、固定残業代の青天井、有給法定下回り等）/ 不足 / 古い規定。
【出力】必ず次のJSONのみ（前後に説明やコードフェンス無し）：
{"items":[{"severity":"high|medium|low","category":"危ない条文|不足|古い規定","clause":"対象","issue":"問題（条件形）","suggestion":"方向性"}],"summary":"所感"}
- 断定的法律判断はしない。条件形で書く。`
}

// --- lib/dify.ts と同じ（生成ボット）---
function loadDifyKeys() {
  try { return JSON.parse(readFileSync(DIFY_KEYS_PATH, 'utf8')) } catch { return {} }
}
async function generateViaDify(keyName, query) {
  const key = loadDifyKeys()[keyName]
  if (!key) return null
  try {
    const res = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, inputs: {}, response_mode: 'blocking', conversation_id: '', user: 'e2e-doc' }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!res.ok) { console.log(`  (dify HTTP ${res.status})`); return null }
    const data = await res.json()
    return typeof data.answer === 'string' ? data.answer.trim() : null
  } catch (e) { console.log('  (dify err: ' + e.message + ')'); return null }
}

function parseReviewJson(raw) {
  if (!raw) return null
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a === -1 || b <= a) return null
  try { return JSON.parse(s.slice(a, b + 1)) } catch { return null }
}

const created = { users: [], companies: [] }
const PASSWORD = 'Test-Pass-' + stamp + '!'
const adminEmail = `e2e_doc_admin_${stamp}@example.test`

async function setup() {
  console.log('--- SETUP: company (製造業/8名/36協定未締結/月60h残業) ---')
  const { data: c, error: e } = await admin.auth.admin.createUser({
    email: adminEmail, password: PASSWORD, email_confirm: true,
  })
  if (e) throw e
  created.users.push(c.user.id)
  const { data: company, error: ce } = await admin.from('companies')
    .insert({ name: `テスト製造_${stamp}`, seats_purchased: 8 }).select('id, name').single()
  if (ce) throw ce
  created.companies.push(company.id)
  const { error: me } = await admin.from('company_members')
    .insert({ company_id: company.id, user_id: c.user.id, role: 'admin' })
  if (me) throw me
  const profiles = [
    { key: '従業員数', value: '8名' },
    { key: '業種', value: '製造業' },
    { key: '36協定', value: '未締結' },
    { key: '残業の実態', value: '繁忙期は月60時間の残業がある' },
    { key: '所定労働時間', value: '1日8時間・週40時間' },
  ]
  for (const p of profiles) {
    const { error } = await admin.from('company_profiles')
      .insert({ company_id: company.id, key: p.key, value: p.value })
    if (error) throw error
  }
  console.log(`  company=${company.id} (${company.name})`)
  return { company, profiles }
}

async function run() {
  const { company, profiles } = await setup()
  const companyName = company.name

  // ========== TEST 1: 書類生成（36協定） ==========
  console.log('\n--- TEST 1: 書類生成（36協定ドラフト・会社前提反映） ---')
  let draft = '', source = 'sonnet'
  const difyQuery = `次の会社の前提で、時間外・休日労働に関する協定届（36協定）のドラフトを今すぐ本文だけ出してください。
会社名：${companyName}
自社ルール：\n${profilesText(profiles)}
注意：自社ルールを必ず反映。前置きなしで本文だけ。`
  const difyDraft = await generateViaDify('DIFY_KEY_36KYOTEI', difyQuery)
  if (difyDraft && difyDraft.length > 80) {
    draft = difyDraft; source = 'dify'
  } else {
    const system = buildDocGenSystem(companyName, '時間外・休日労働に関する協定届（36協定）', profiles)
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL, max_tokens: 4096, system,
      messages: [{ role: 'user', content: '36協定届のドラフトを御社の前提に沿って本文だけ作成してください。' }],
    })
    draft = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  }
  console.log(`  (source=${source}, len=${draft.length})`)
  console.log('\n===== 生成ドラフト（先頭1200字） =====\n' + draft.slice(0, 1200) + '\n...\n==========================\n')
  ok(draft.length > 200, '書類ドラフトが生成された', `len=${draft.length}`)
  const dManu = /製造/.test(draft)
  const d60 = /60\s*時間|月60|60時間/.test(draft)
  const dName = draft.includes(companyName) || /御社|当社|会社名/.test(draft)
  ok(dManu || d60, 'ドラフトが会社の実態（製造業 or 月60h）を踏まえる', `製造=${dManu} 60h=${d60}`)
  ok(dName, 'ドラフトが当該会社のものとして組まれている', `nameRef=${dName}`)
  ok(!/社労士監修|AI社労士|法的精度/.test(draft), 'Phase1禁止表現を含まない')

  // ========== TEST 2: 規程レビュー（危険条文の指摘） ==========
  console.log('\n--- TEST 2: 規程レビュー（固定残業代・上限なし条文のリスク指摘） ---')
  const sampleRule = `第15条（時間外労働）
1. 従業員の残業代は固定残業代に含むものとし、別途の割増賃金は支払わない。時間外労働の上限は設けない。
2. 年次有給休暇は入社1年経過後に5日付与する。
3. 育児休業に関する定めは設けない。`
  const reviewSystem = buildReviewSystem(companyName, profiles)
  const rResp = await anthropic.messages.create({
    model: CHAT_MODEL, max_tokens: 4096, system: reviewSystem,
    messages: [{ role: 'user', content: `次の既存規程をレビューしてください。指定JSONのみで返す。\n----\n${sampleRule}\n----` }],
  })
  const rRaw = rResp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  const parsed = parseReviewJson(rRaw)
  console.log('\n===== レビューJSON（先頭1400字） =====\n' + rRaw.slice(0, 1400) + '\n==========================\n')
  ok(!!parsed && Array.isArray(parsed.items), 'レビュー結果がJSONとしてパースできる')
  const items = parsed?.items ?? []
  ok(items.length >= 1, 'リスク指摘が1件以上返る', `count=${items.length}`)
  const blob = JSON.stringify(items)
  const mFixed = /固定残業|上限|青天井|時間外|割増/.test(blob)
  ok(mFixed, '固定残業代/時間外上限のリスクを指摘している', mFixed ? 'yes' : 'no')
  const hasHigh = items.some(it => it.severity === 'high')
  ok(hasHigh, '少なくとも1件を high リスクと判定', `high=${hasHigh}`)
  ok(!/社労士監修|AI社労士|法的精度/.test(blob), 'レビューにPhase1禁止表現を含まない')
}

async function teardown() {
  console.log('\n--- TEARDOWN ---')
  for (const id of created.companies) await admin.from('companies').delete().eq('id', id)
  for (const id of created.users) await admin.auth.admin.deleteUser(id)
  console.log('  cleaned.')
}

try { await run() }
catch (e) { fail++; console.error('  ERROR during run:', e.message) }
finally { await teardown().catch(e => console.error('teardown error:', e.message)) }

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
process.exit(fail === 0 ? 0 : 1)
