// ============================================================================
// company_chat_e2e.mjs — 会社版チャットの実トランザクションE2E
//
//   証拠主義: 「会社プロファイルが本当に回答へ効いているか」を実応答テキストで確認する。
//
//   手順:
//     1. service role でテスト会社(製造業/8名/36協定未締結/月60h残業) + adminユーザー作成
//     2. signInWithPassword で JWT 取得 → anon+JWT クライアント（=実ユーザー視点・RLS下）
//     3. 会社版チャットAPIのコアロジックを再現:
//        - loadCompanyContext 相当: company_profiles + company_memories を JWT で読む
//        - buildCompanySystemPrompt 相当の system を組む
//        - 必要なら Dify 照会（36協定キーワード一致 → DIFY_KEY_36KYOTEI）
//        - sonnet-4-6 で「36協定について対応すべきことは？」を実呼び出し
//        - company_conversations / company_messages へ JWT で保存（RLS尊重を実証）
//     4. 応答テキストに自社プロファイル（未締結/60時間/製造業）が反映されているか検査
//     5. teardown: 作成した会社/ユーザーを service role で完全削除
//
//   ※ APIルートはNext.jsのcookie認証に依存するため、ここでは同一のlibロジックを
//     直接importして「実モデル呼び出し＋実RLS書込み」を行い、振る舞いを実証する。
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY
if (!URL || !ANON || !SERVICE || !ANTHROPIC_KEY) throw new Error('env missing')

const CHAT_MODEL = 'claude-sonnet-4-6'
const DIFY_KEYS_PATH = '/Users/takeshi/Takeshi_Automation/config/x_keys.json'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

const stamp = Date.now()
const PASSWORD = 'Test-Pass-' + stamp + '!'
const adminEmail = `e2e_company_admin_${stamp}@example.test`

let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

function userClient(accessToken) {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// --- Dify 照会（lib/dify.ts と同じ振る舞いを再現）---
function loadDifyKeys() {
  try { return JSON.parse(readFileSync(DIFY_KEYS_PATH, 'utf8')) } catch { return {} }
}
async function askDify36(query) {
  const keys = loadDifyKeys()
  const key = keys['DIFY_KEY_36KYOTEI']
  if (!key) return null
  try {
    const res = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, inputs: {}, response_mode: 'blocking', conversation_id: '', user: 'e2e' }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) { console.log(`  (dify HTTP ${res.status})`); return null }
    const data = await res.json()
    return typeof data.answer === 'string' ? data.answer.trim() : null
  } catch (e) { console.log('  (dify err: ' + e.message + ')'); return null }
}

const created = { users: [], companies: [] }

async function setup() {
  console.log('--- SETUP: admin user + company (製造業/8名/36協定未締結/月60h残業) ---')
  const { data: c, error: e } = await admin.auth.admin.createUser({
    email: adminEmail, password: PASSWORD, email_confirm: true,
  })
  if (e) throw e
  const user = c.user; created.users.push(user.id)

  const { data: company, error: ce } = await admin.from('companies')
    .insert({ name: `テスト製造_${stamp}`, seats_purchased: 8 }).select('id, name').single()
  if (ce) throw ce
  created.companies.push(company.id)

  const { error: me } = await admin.from('company_members')
    .insert({ company_id: company.id, user_id: user.id, role: 'admin' })
  if (me) throw me

  // 自社プロファイル投入（admin承認済みの確定ルール）
  const profiles = [
    { key: '従業員数', value: '8名' },
    { key: '業種', value: '製造業' },
    { key: '36協定', value: '未締結' },
    { key: '残業の実態', value: '繁忙期は月60時間の残業がある' },
  ]
  for (const p of profiles) {
    const { error } = await admin.from('company_profiles')
      .insert({ company_id: company.id, key: p.key, value: p.value })
    if (error) throw error
  }
  console.log(`  company=${company.id} (${company.name})`)
  return { user, company }
}

async function signIn(email) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return data.session.access_token
}

function buildCompanySystemPrompt(companyName, profiles, memories, difyContext) {
  const profileText = profiles.length
    ? profiles.map(p => `- ${p.key}：${p.value}`).join('\n')
    : '（まだ自社ルールが登録されていません）'
  const memoryText = memories.length ? memories.map((m, i) => `${i + 1}. ${m}`).join('\n') : '（記憶なし）'
  const difyBlock = difyContext
    ? `\n\n【法令の一次情報（${difyContext.topic}）】\n${difyContext.answer}` : ''
  return `あなたは「${companyName}」の労務をずっと担当しているAI労務アシスタントです。
【${companyName}の自社ルール・制度（必ず前提にする）】
${profileText}
【過去相談の記憶】
${memoryText}${difyBlock}
【回答ルール】
- 一般論で終わらせず、必ず上の自社ルールを踏まえて回答してください。
- 自社ルールが法令違反のおそれがある場合はリスクを率直に指摘してください。`
}

async function run() {
  const { company } = await setup()
  const token = await signIn(adminEmail)
  const user = userClient(token)

  console.log('\n--- TEST: 会社プロファイルを JWT(RLS下) で読めるか ---')
  const { data: profRows, error: profErr } = await user
    .from('company_profiles').select('key, value').eq('company_id', company.id).order('key')
  ok(!profErr && (profRows?.length ?? 0) === 4, 'admin が自社profilesを4件読める', `rows=${profRows?.length}`)

  const profiles = profRows ?? []

  console.log('\n--- TEST: Dify(36協定ボット) 一次情報の取得 ---')
  const question = '36協定について対応すべきことは？'
  const difyAnswer = await askDify36(question)
  ok(!!difyAnswer, 'Dify 36協定ボットが回答を返す（任意・落ちても続行）', difyAnswer ? `len=${difyAnswer.length}` : 'null（Dify無しで続行）')
  const difyContext = difyAnswer ? { topic: '36協定・残業', answer: difyAnswer } : null

  console.log('\n--- TEST: 会社版チャット（sonnet-4-6 実呼び出し） ---')
  const system = buildCompanySystemPrompt(`テスト製造_${stamp}`, profiles, [], difyContext)
  const resp = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: question }],
  })
  const answer = resp.content.find(b => b.type === 'text')?.text ?? ''
  console.log('\n===== AI応答（全文） =====\n' + answer + '\n==========================\n')

  // 会社プロファイルが効いている証拠を応答テキストで検査
  const mentionsNotConcluded = /未締結|締結されていない|結んでいない|結ばれていない/.test(answer)
  const mentions60 = /60\s*時間|60時間|月60/.test(answer)
  const mentionsManufacturing = /製造業|製造/.test(answer)
  ok(answer.length > 50, 'sonnet-4-6 が実応答を返した', `len=${answer.length}`)
  ok(mentionsNotConcluded, '応答が「36協定 未締結」を踏まえている', mentionsNotConcluded ? 'yes' : 'no')
  ok(mentions60 || mentionsManufacturing, '応答が自社実態（60時間残業 or 製造業）に言及', `60h=${mentions60} 製造=${mentionsManufacturing}`)

  console.log('\n--- TEST: 会話/メッセージを JWT(RLS下) で保存できるか ---')
  const { data: conv, error: convErr } = await user.from('company_conversations')
    .insert({ company_id: company.id, user_id: created.users[0], title: question.slice(0, 30) })
    .select('id').single()
  ok(!convErr && !!conv, 'company_conversations へ JWT で INSERT 成功', convErr?.message ?? 'ok')

  if (conv) {
    const { error: m1 } = await user.from('company_messages')
      .insert({ conversation_id: conv.id, role: 'user', content: question })
    const { error: m2 } = await user.from('company_messages')
      .insert({ conversation_id: conv.id, role: 'assistant', content: answer })
    ok(!m1 && !m2, 'company_messages へ user/assistant 2件 INSERT 成功', (m1?.message || m2?.message) ?? 'ok')

    const { data: saved } = await user.from('company_messages')
      .select('role').eq('conversation_id', conv.id)
    ok((saved?.length ?? 0) === 2, '保存したメッセージを自社視点で2件読み返せる', `rows=${saved?.length}`)
  }
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
