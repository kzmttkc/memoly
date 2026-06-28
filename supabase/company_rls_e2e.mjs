// ============================================================================
// company_rls_e2e.mjs — 会社スコープ RLS / 席トリガ の実トランザクション検証
//
//   証拠主義: service role は RLS をバイパスするため可視性の証拠にならない。
//   → createUser（service role）でテストユーザーを作り、signInWithPassword で
//      JWT を取得し、その JWT を載せた anon クライアントで実ユーザー視点を検証する。
//
//   検証項目:
//     (A) RLS他社不可視: User2(社B) は User1(社A) の company_profiles を読めない（0件）。
//                        逆も同様。各自は自社のみ見える。
//     (B) 席トリガ超過拒否: seats_purchased=1 の社Aに2人目を INSERT すると
//                          trg_company_seat_limit が EXCEPTION を投げ失敗する。
//
//   実行後、作成した auth.users / companies を service role で完全削除する。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// .env.local をパース（dotenv非依存・追跡外ファイルを読むだけ）
const __dir = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of readFileSync(join(__dir, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) throw new Error('env missing')

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const stamp = Date.now()
const PASSWORD = 'Test-Pass-' + stamp + '!'
const u1email = `e2e_u1_${stamp}@example.test`
const u2email = `e2e_u2_${stamp}@example.test`

let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

// JWT付きanonクライアントを作る（実ユーザー視点）
function userClient(accessToken) {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const created = { users: [], companies: [] }

async function setup() {
  console.log('--- SETUP: create 2 users (service role) ---')
  const { data: c1, error: e1 } = await admin.auth.admin.createUser({
    email: u1email, password: PASSWORD, email_confirm: true,
  })
  if (e1) throw e1
  const u1 = c1.user; created.users.push(u1.id)

  const { data: c2, error: e2 } = await admin.auth.admin.createUser({
    email: u2email, password: PASSWORD, email_confirm: true,
  })
  if (e2) throw e2
  const u2 = c2.user; created.users.push(u2.id)
  console.log(`  user1=${u1.id}\n  user2=${u2.id}`)

  console.log('--- SETUP: create company A (1 seat, admin=u1) and company B (1 seat, admin=u2) ---')
  const { data: cA, error: eA } = await admin.from('companies')
    .insert({ name: `社A_${stamp}`, seats_purchased: 1 }).select('id').single()
  if (eA) throw eA
  created.companies.push(cA.id)
  const { error: mA } = await admin.from('company_members')
    .insert({ company_id: cA.id, user_id: u1.id, role: 'admin' })
  if (mA) throw mA

  const { data: cB, error: eB } = await admin.from('companies')
    .insert({ name: `社B_${stamp}`, seats_purchased: 1 }).select('id').single()
  if (eB) throw eB
  created.companies.push(cB.id)
  const { error: mB } = await admin.from('company_members')
    .insert({ company_id: cB.id, user_id: u2.id, role: 'admin' })
  if (mB) throw mB

  // 各社に自社プロファイルを1件ずつ（service roleで投入）
  await admin.from('company_profiles').insert({ company_id: cA.id, key: '所定労働時間', value: '社Aは1日8時間' })
  await admin.from('company_profiles').insert({ company_id: cB.id, key: '所定労働時間', value: '社Bは1日7時間' })
  console.log(`  companyA=${cA.id}\n  companyB=${cB.id}`)

  return { u1, u2, cA: cA.id, cB: cB.id }
}

async function signIn(email) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return data.session.access_token
}

async function run() {
  const { u2, cA, cB } = await setup()

  console.log('\n--- TEST A: RLS 他社不可視（anon + user JWT 経由） ---')
  const tok1 = await signIn(u1email)
  const tok2 = await signIn(u2email)
  const user1 = userClient(tok1)
  const user2 = userClient(tok2)

  // User1: 自社A は見える
  const a1 = await user1.from('company_profiles').select('company_id, value').eq('company_id', cA)
  ok(!a1.error && a1.data?.length === 1, 'User1 は自社A profiles を見られる', `rows=${a1.data?.length}`)

  // User1: 他社B は見えない（RLSで0件）
  const a2 = await user1.from('company_profiles').select('company_id, value').eq('company_id', cB)
  ok(!a2.error && (a2.data?.length ?? 0) === 0, 'User1 は他社B profiles を見られない(0件)', `rows=${a2.data?.length}`)

  // User1: フィルタ無しで全件取得しても自社Aのみ（RLSがcompany_idで絞る）
  const a3 = await user1.from('company_profiles').select('company_id')
  const a3OnlyA = (a3.data ?? []).every(r => r.company_id === cA)
  ok(!a3.error && (a3.data?.length ?? 0) === 1 && a3OnlyA, 'User1 の無条件SELECTは自社Aのみ', `rows=${a3.data?.length}`)

  // User2: 他社A は見えない
  const b1 = await user2.from('company_profiles').select('company_id').eq('company_id', cA)
  ok(!b1.error && (b1.data?.length ?? 0) === 0, 'User2 は他社A profiles を見られない(0件)', `rows=${b1.data?.length}`)

  // User2: companies テーブルでも他社A行が見えない
  const b2 = await user2.from('companies').select('id').eq('id', cA)
  ok(!b2.error && (b2.data?.length ?? 0) === 0, 'User2 は他社A companies 行を見られない(0件)', `rows=${b2.data?.length}`)

  console.log('\n--- TEST B: 席トリガ超過拒否（seats_purchased=1 の社Aに2人目INSERT） ---')
  // service role で2人目を社Aに追加 → トリガが EXCEPTION を投げ失敗するはず
  const seatTry = await admin.from('company_members')
    .insert({ company_id: cA, user_id: u2.id, role: 'member' })
  const blockedBySeat = !!seatTry.error && /席数上限/.test(seatTry.error.message)
  ok(blockedBySeat, '社A(1席)への2人目INSERTがトリガで拒否される',
     seatTry.error ? seatTry.error.message : '(エラー無し=トリガ未発火=NG)')

  // 念のため: 実際にメンバー数が1のままであることを確認
  const seatCount = await admin.from('company_members').select('user_id', { count: 'exact', head: true }).eq('company_id', cA)
  ok(seatCount.count === 1, '社A のメンバー数は1のまま', `count=${seatCount.count}`)

  // 対照: seats_purchased を2に増やせば2人目が入ることも確認（トリガの正常系）
  await admin.from('companies').update({ seats_purchased: 2 }).eq('id', cA)
  const seatTry2 = await admin.from('company_members')
    .insert({ company_id: cA, user_id: u2.id, role: 'member' })
  ok(!seatTry2.error, '社A を2席に増やすと2人目INSERTが成功する(対照)',
     seatTry2.error ? seatTry2.error.message : 'inserted')
}

async function teardown() {
  console.log('\n--- TEARDOWN: delete test companies + users ---')
  for (const id of created.companies) {
    await admin.from('companies').delete().eq('id', id) // cascade で members/profiles も消える
  }
  for (const id of created.users) {
    await admin.auth.admin.deleteUser(id)
  }
  console.log('  cleaned.')
}

try {
  await run()
} catch (e) {
  fail++
  console.error('  ERROR during run:', e.message)
} finally {
  await teardown().catch(e => console.error('teardown error:', e.message))
}

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`)
process.exit(fail === 0 ? 0 : 1)
