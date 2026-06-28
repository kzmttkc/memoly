// ============================================================================
// company_insights_e2e.mjs — 提案B（助成金の自分ごと診断）＋提案D（法改正の自分ごと
//   インパクト）の実トランザクションE2E。
//
//   証拠主義: 「会社プロファイルが助成金候補・法改正の影響に効いているか」を
//   実モデル（Dify助成金ボット / sonnet-4-6）の実応答で確認する。
//
//   手順:
//     1. service role でテスト会社(製造業/8名/36協定未締結/月60h残業) + adminユーザー作成
//     2. (B)助成金: Dify(助成金ボット DIFY_KEY_HOJOKIN)優先→不可なら sonnet。
//        候補が1件以上返り会社属性（製造/8名/36協定/60h/正社員転換/教育訓練等）を踏まえるか検査。
//     3. (D)法改正: sonnet で会社プロファイルに関係する法改正＋御社への影響を構造化。
//        項目が返り「御社への影響」に言及するか検査。
//     4. Phase1禁止語が無いこと。teardown で会社/ユーザー完全削除。
//
//   ※ APIルートは Next.js cookie認証依存のため、ここでは route と同じ prompts/dify
//     ロジックを再現して「実モデル呼び出し」で振る舞いを実証する。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

// --- lib/prompts.ts と同じビルダー（route insights が使うものを再現）---
function profilesText(profiles) {
  return profiles.length ? profiles.map(p => `- ${p.key}：${p.value}`).join('\n')
    : '（自社ルール未登録。一般的な中小企業を前提）'
}
function buildSubsidyDifyQuery(companyName, profiles) {
  return `次の会社が使える可能性のある雇用・労務系の助成金を、会社の属性に即して挙げてください。
会社名：${companyName}
御社の属性・状況：
${profilesText(profiles)}
出してほしいこと：御社の業種・規模・状況（36協定の有無、育児/介護、正社員転換、教育訓練、賃上げ等）に当てはまりやすい助成金を3〜6件。各々「制度名／御社で当てはまる理由（属性に紐づけて）／次の一歩」。断定せず条件形で。「社労士監修」「AI社労士」「法的精度」は使わない。`
}
function buildSubsidySystem(companyName, profiles) {
  return `あなたは「${companyName}」の労務担当を支援するAIアシスタントです。
御社の属性・状況を起点に、使える可能性のある雇用・労務系の助成金を挙げてください。
【${companyName}の属性・状況（必ず起点にする）】\n${profilesText(profiles)}
【出力】御社の業種・規模・状況（36協定の有無、育児/介護、正社員転換、教育訓練、賃上げ等）に当てはまりやすい助成金を3〜6件。必ず次のJSONのみ（前後に説明やコードフェンス無し）：
{"subsidies":[{"name":"名称","reason":"御社のどの属性から対象になりうるか（条件形）","nextStep":"次の一歩"}]}
- 断定せず条件形で。「社労士監修」「AI社労士」「法的精度」は使わない。`
}
function buildLawChangeSystem(companyName, profiles) {
  return `あなたは「${companyName}」の労務担当を支援するAIアシスタントです。
最近〜近い将来の労務・社会保険・税の法改正のうち、御社の属性・状況に関係するものを選び、御社への影響を当事者目線で整理してください。
【${companyName}の属性・状況（必ず起点にする）】\n${profilesText(profiles)}
【現行制度の前提（令和7改正・参考値）】給与所得控除最低65万・基礎控除最大95万（年収の壁見直し後）。時間外上限規制 月45h/年360h・特別条項 年720h/月100h未満。月60h超割増50%は中小も2023年4月適用済。
【出力】御社に関係する改正を3〜6件（業種・規模・36協定の有無・残業時間・育児介護・パート扶養等に紐づくもの優先）。必ず次のJSONのみ（前後に説明やコードフェンス無し）：
{"lawChanges":[{"title":"項目名","summary":"概要(1-2文)","impact":"御社のどこに影響するか（属性に紐づけて条件形）","action":"見直すべきこと・方向性"}]}
- 断定的法律判断はしない。条件形で書く。「社労士監修」「AI社労士」「法的精度」は使わない。`
}

function loadDifyKeys() {
  try { return JSON.parse(readFileSync(DIFY_KEYS_PATH, 'utf8')) } catch { return {} }
}
async function askDify(keyName, query) {
  const key = loadDifyKeys()[keyName]
  if (!key) { console.log(`  (dify key ${keyName} missing)`); return null }
  try {
    const res = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, inputs: {}, response_mode: 'blocking', conversation_id: '', user: 'e2e-insights' }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!res.ok) { console.log(`  (dify HTTP ${res.status})`); return null }
    const data = await res.json()
    return typeof data.answer === 'string' ? data.answer.trim() : null
  } catch (e) { console.log('  (dify err: ' + e.message + ')'); return null }
}

function parseJsonObject(raw) {
  if (!raw) return null
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a === -1 || b <= a) return null
  try { return JSON.parse(s.slice(a, b + 1)) } catch { return null }
}

const BANNED = /社労士監修|AI社労士|法的精度/

const created = { users: [], companies: [] }
const PASSWORD = 'Test-Pass-' + stamp + '!'
const adminEmail = `e2e_insights_admin_${stamp}@example.test`

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
    { key: '雇用形態', value: '正社員5名・有期パート3名（正社員転換を検討中）' },
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

  // ========== TEST 1: (B) 助成金の自分ごと診断 ==========
  console.log('\n--- TEST 1: 助成金診断（Dify助成金ボット優先・会社属性反映） ---')
  let subsidies = [], source = 'sonnet'
  const difyAnswer = await askDify('DIFY_KEY_HOJOKIN', buildSubsidyDifyQuery(companyName, profiles))
  if (difyAnswer && difyAnswer.trim().length > 80) {
    source = 'dify'
    subsidies = [{ name: '御社向けの助成金診断（助成金ナレッジより）', reason: difyAnswer.trim(), nextStep: '要件確認のうえ申請準備を。' }]
  } else {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL, max_tokens: 2048, system: buildSubsidySystem(companyName, profiles),
      messages: [{ role: 'user', content: '御社が使える可能性のある助成金を、指定JSONのみで返してください。' }],
    })
    const raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const parsed = parseJsonObject(raw)
    subsidies = (Array.isArray(parsed?.subsidies) ? parsed.subsidies : [])
      .map(s => ({ name: String(s.name ?? '').trim(), reason: String(s.reason ?? '').trim(), nextStep: String(s.nextStep ?? '').trim() }))
      .filter(s => s.name)
  }
  const subBlob = JSON.stringify(subsidies)
  console.log(`  (source=${source}, count=${subsidies.length})`)
  console.log('\n===== 助成金（先頭1400字） =====\n' + subBlob.slice(0, 1400) + '\n==========================\n')
  ok(subsidies.length >= 1, '助成金候補が1件以上返る', `count=${subsidies.length}`)
  // 会社属性を踏まえる証拠: 製造/中小/正社員転換(キャリアアップ)/育児/教育訓練/36協定/残業 等の語に当たる
  const attrHit = /製造|中小|キャリアアップ|正社員|有期|転換|育児|介護|教育訓練|人材開発|時間外|残業|36協定|働き方|両立/.test(subBlob)
  ok(attrHit, '助成金が会社属性（製造/正社員転換/残業等）を踏まえる', attrHit ? 'matched' : 'no-attr-ref')
  ok(!BANNED.test(subBlob), 'Phase1禁止表現を含まない（助成金）')

  // ========== TEST 2: (D) 法改正の自分ごとインパクト ==========
  console.log('\n--- TEST 2: 法改正の自分ごとインパクト（sonnet・御社への影響に言及） ---')
  const lawResp = await anthropic.messages.create({
    model: CHAT_MODEL, max_tokens: 3072, system: buildLawChangeSystem(companyName, profiles),
    messages: [{ role: 'user', content: '御社に関係する労務法改正を、指定JSONのみで返してください。' }],
  })
  const lawRaw = lawResp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  const lawParsed = parseJsonObject(lawRaw)
  const lawChanges = (Array.isArray(lawParsed?.lawChanges) ? lawParsed.lawChanges : [])
    .map(l => ({ title: String(l.title ?? '').trim(), summary: String(l.summary ?? '').trim(), impact: String(l.impact ?? '').trim(), action: String(l.action ?? '').trim() }))
    .filter(l => l.title)
  const lawBlob = JSON.stringify(lawChanges)
  console.log('\n===== 法改正（先頭1800字） =====\n' + lawBlob.slice(0, 1800) + '\n==========================\n')
  ok(!!lawParsed, '法改正がJSONとしてパースできる')
  ok(lawChanges.length >= 1, '法改正項目が1件以上返る', `count=${lawChanges.length}`)
  const hasImpact = lawChanges.some(l => l.impact && l.impact.length > 5)
  ok(hasImpact, '各項目に御社への影響(impact)が記載される', `impactFilled=${hasImpact}`)
  // 会社属性に紐づく影響の証拠
  const lawAttrHit = /製造|中小|36協定|残業|時間外|60時間|正社員|有期|パート|転換|8名|育児|扶養|年収の壁/.test(lawBlob)
  ok(lawAttrHit, '影響が会社属性（36協定/残業/正社員転換等）に紐づく', lawAttrHit ? 'matched' : 'no-attr-ref')
  // 旧モデル知識(103万円ベース)で語っていないこと（令和7改正準拠）の軽い確認
  const old103 = /103万円(?!.*見直|.*改正|.*から|.*基準)/.test(lawBlob)
  ok(!old103 || /65万|95万|123万|年収の壁/.test(lawBlob), '税の壁を令和7改正値の文脈で扱う', '')
  ok(!BANNED.test(lawBlob), 'Phase1禁止表現を含まない（法改正）')
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
