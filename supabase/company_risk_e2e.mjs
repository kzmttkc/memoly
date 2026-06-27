// ============================================================================
// company_risk_e2e.mjs — 提案C 労務リスク・セルフ監査スコア の実トランザクションE2E。
//
//   証拠主義: 「会社プロファイルが採点に効いているか」を実モデル（sonnet-4-6）の
//   実応答で確認する。
//
//   手順:
//     1. service role でテスト会社(製造業/8名/36協定未締結/月60h残業/有給5日付与) +
//        adminユーザー + company_profiles を作成
//     2. /api/company/risk-audit と同じ prompts ロジックを再現して sonnet を実呼び出し
//     3. 検査:
//        (a) 総合スコアが数値(0-100)で返る
//        (b) 危ない点に「36協定未締結」や「有給の法定割れ(年5日)」等が挙がる
//        (c) カテゴリ別が返る（6カテゴリ）
//        (d) Phase1禁止語（社労士監修/AI社労士/法的精度）が無い
//     4. teardown で会社/ユーザー完全削除
//
//   ※ APIルートは Next.js cookie認証依存のため、ここでは route と同じ prompts
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

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

const stamp = Date.now()
let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

// --- lib/prompts.ts buildRiskAuditSystemPrompt と同じビルダーを再現 ---
function profilesText(profiles) {
  return profiles.length ? profiles.map(p => `- ${p.key}：${p.value}`).join('\n')
    : '（自社ルール未登録。一般的な中小企業を前提）'
}
function answersText(answers) {
  return answers.length ? answers.map(a => `- ${a.key}：${a.value}`).join('\n')
    : '（追加の設問回答はありません。自社ルールのみを起点にしてください）'
}
function buildRiskAuditSystem(companyName, profiles, answers) {
  return `あなたは「${companyName}」の労務担当を支援するAIアシスタントです。
御社の自社ルール・属性と、任意の簡易設問の回答を起点に、御社の労務リスクを採点してください。
これは社内のセルフチェック（自己点検）の"目安"であり、正式な監査ではありません。

【${companyName}の自社ルール・属性（必ず起点にする）】
${profilesText(profiles)}

【簡易設問への回答（あれば加味する）】
${answersText(answers)}

【現行制度の前提（令和7年度改正・参考値）】
- 給与所得控除の最低額は65万円、基礎控除は最大95万円（年収の壁見直し後）。古い103万円ベースで語らない。
- 時間外労働の上限規制：原則 月45時間・年360時間。特別条項でも年720時間・複数月平均80時間以内・単月100時間未満。36協定の締結・届出が無いまま時間外労働をさせている状態はリスクが高い。
- 年次有給休暇は、年10日以上付与される労働者に年5日の取得義務がある。
- 月60時間超の時間外割増率50%は中小企業にも2023年4月から適用済み。

【採点ルール】
- 総合スコア(score)は0〜100の整数。100が最も健全。明らかな法令抵触のおそれ（36協定未締結のまま時間外労働、有給5日取得義務の未達、上限規制超えの残業 等）があれば大きく減点する。
- カテゴリは「労働時間」「賃金」「休暇」「就業規則」「社会保険」「育児・介護」の6つを必ず全て返す。各カテゴリにも0〜100のスコアを付ける。
- 情報不足で判断できない項目は減点せず note に「情報不足のため要確認」と書き score は中庸(60前後)に。情報が無いことを理由に不当に低い点を付けない。
- 危ない上位3点(topRisks)は最も優先度の高いリスクを3件（情報が乏しければ減らしてよい）。

【出力ルール】
- 必ず次のJSONのみ（前後に説明文やコードフェンス無し）：
{
  "score": 0,
  "level": "要注意" | "改善の余地あり" | "おおむね良好",
  "categories": [{ "name": "労働時間", "score": 0, "note": "短評(条件形。情報不足なら要確認)" }],
  "topRisks": [{ "title": "見出し", "severity": "high" | "medium" | "low", "why": "なぜリスクか(属性に紐づけ条件形)", "fix": "直す方向性" }],
  "summary": "全体所感1〜2文(条件形)"
}
- level は score に整合(0-49=要注意/50-74=改善の余地あり/75-100=おおむね良好)。
- 断定的法律判断はしない。条件形で書く。「社労士監修」「AI社労士」「法的精度」は使わない。`
}

function parseJsonObject(raw) {
  if (!raw) return null
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a === -1 || b <= a) return null
  try { return JSON.parse(s.slice(a, b + 1)) } catch { return null }
}

const BANNED = /社労士監修|AI社労士|法的精度/
const CATEGORY_NAMES = ['労働時間', '賃金', '休暇', '就業規則', '社会保険', '育児・介護']

const created = { users: [], companies: [] }
const PASSWORD = 'Test-Pass-' + stamp + '!'
const adminEmail = `e2e_risk_admin_${stamp}@example.test`

async function setup() {
  console.log('--- SETUP: company (製造業/8名/36協定未締結/月60h残業/有給5日付与) ---')
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
    { key: '36協定', value: '未締結（届出していない）' },
    { key: '残業の実態', value: '繁忙期は月60時間の残業がある' },
    { key: '所定労働時間', value: '1日8時間・週40時間' },
    { key: '年次有給休暇', value: '法定どおり10日以上付与しているが、実際の取得は年5日に満たない人がいる' },
    { key: '雇用形態', value: '正社員5名・有期パート3名' },
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

  console.log('\n--- TEST: 労務リスク診断（sonnet・会社属性反映） ---')
  const resp = await anthropic.messages.create({
    model: CHAT_MODEL, max_tokens: 3072,
    system: buildRiskAuditSystem(companyName, profiles, []),
    messages: [{ role: 'user', content: '御社の労務リスクを採点し、指定のJSON形式のみで返してください。' }],
  })
  const raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  const parsed = parseJsonObject(raw)
  const blob = JSON.stringify(parsed)
  console.log('\n===== 診断結果（先頭2200字） =====\n' + blob.slice(0, 2200) + '\n==========================\n')

  // (a) 総合スコアが数値(0-100)で返る
  ok(!!parsed, '診断結果がJSONとしてパースできる')
  const score = Number(parsed?.score)
  ok(Number.isFinite(score) && score >= 0 && score <= 100, '(a) 総合スコアが0-100の数値で返る', `score=${parsed?.score}`)

  // (c) カテゴリ別が返る（6カテゴリ）
  const cats = Array.isArray(parsed?.categories) ? parsed.categories : []
  ok(cats.length >= 1, '(c) カテゴリ別スコアが返る', `count=${cats.length}`)
  const catNames = cats.map(c => String(c?.name ?? '').trim())
  const hasCoreCats = CATEGORY_NAMES.filter(n => catNames.includes(n)).length
  ok(hasCoreCats >= 4, '(c) 規定6カテゴリの大半が含まれる', `matched=${hasCoreCats}/6 :: ${catNames.join(',')}`)
  const allCatScoresNumeric = cats.every(c => Number.isFinite(Number(c?.score)))
  ok(allCatScoresNumeric, '(c) 各カテゴリにも数値スコアが付く')

  // (b) 危ない点に36協定未締結や有給法定割れ等が挙がる
  const risks = Array.isArray(parsed?.topRisks) ? parsed.topRisks : []
  ok(risks.length >= 1, '危ない上位ポイントが1件以上返る', `count=${risks.length}`)
  const riskBlob = JSON.stringify(risks)
  const hit36 = /36協定|時間外.*協定|協定.*未締結|未締結|届出/.test(riskBlob)
  ok(hit36, '(b) 危ない点に36協定未締結（時間外労働の協定）が挙がる', hit36 ? 'matched' : 'no-match')
  const hitYukyu = /有給|年次有給|年5日|5日.*取得|取得.*義務/.test(riskBlob)
  ok(hitYukyu, '(b) 危ない点に有給5日取得義務(法定割れ)が挙がる', hitYukyu ? 'matched' : 'no-match')

  // 会社属性を踏まえている広い証拠
  const attrHit = /製造|中小|8名|60時間|残業|時間外|36協定|有期|パート|正社員/.test(blob)
  ok(attrHit, '採点が会社属性（製造/8名/月60h/36協定等）を踏まえる', attrHit ? 'matched' : 'no-attr-ref')

  // 36協定未締結＋上限超え残業の会社なので、おおむね良好(高得点)にはならないはず
  ok(score < 75, 'リスクの高い会社が満点近くにならない（採点が効いている）', `score=${score}`)

  // (d) Phase1禁止語が無い
  ok(!BANNED.test(blob), '(d) Phase1禁止表現を含まない')
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
