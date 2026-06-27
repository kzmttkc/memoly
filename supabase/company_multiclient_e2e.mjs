// ============================================================================
// company_multiclient_e2e.mjs — 提案E「開業/若手社労士の多クライアント対応」の実証
//
//   シナリオ: 1人の社労士ユーザーが2つの顧問先（社A=製造業/8名・社B=IT/30名）の
//             両方の admin 席に入り、各社に別々の自社プロファイルを持つ。
//
//   証拠主義: service role は RLS をバイパスするため可視性の証拠にならない。
//     → createUser(service role)でユーザーを作り、signInWithPassword で JWT を得て、
//        その JWT を載せた anon クライアント（=本番の loadCompanyContext / /api/company
//        と同じRLS経路）で実ユーザー視点を検証する。
//
//   検証項目:
//     (a) /api/company 相当: 社労士ユーザーは company_members 経由で2社とも見える。
//     (b) loadCompanyContext(社A) と (社B): それぞれ自社のプロファイルのみ返す
//         （クロス汚染なし＝記憶が顧問先ごとに分離）。
//         ※ lib/company.ts の loadCompanyContext と同一クエリを anon+JWT で再現。
//     (c) 第三者ユーザー: company_members に席が無く、両社とも一切見えない。
//
//   実行後、作成した auth.users / companies を service role で完全削除する。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// .env.local をパース（dotenv非依存・追跡外ファイルを読むだけ・秘密は出力しない）
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
const shiroushiEmail = `e2e_sharoushi_${stamp}@example.test`   // 顧問先2社を持つ社労士
const otherEmail = `e2e_other_${stamp}@example.test`           // 無関係な第三者

let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

// JWT付きanonクライアント（実ユーザー視点・RLS有効）
function userClient(accessToken) {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// lib/company.ts listMyCompanies と同一クエリ（/api/company GET 相当）。
async function listMyCompanies(client) {
  const { data, error } = await client
    .from('company_members')
    .select('role, created_at, companies!inner(id, name, plan, seats_purchased)')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    companyId: r.companies.id, role: r.role, name: r.companies.name,
  }))
}

// lib/company.ts loadCompanyContext と同一クエリ（RLS anon+JWT 経路で再現）。
async function loadCompanyContext(client, companyId, maxMemories = 10) {
  const [{ data: profileRows }, { data: memoryRows }] = await Promise.all([
    client.from('company_profiles').select('key, value')
      .eq('company_id', companyId).order('key', { ascending: true }),
    client.from('company_memories').select('summary')
      .eq('company_id', companyId).eq('memory_type', 'summary')
      .order('created_at', { ascending: false }).limit(maxMemories),
  ])
  return {
    profiles: profileRows ?? [],
    memories: (memoryRows ?? []).map(r => r.summary),
  }
}

const created = { users: [], companies: [] }

async function setup() {
  console.log('--- SETUP: create 1 社労士 user + 1 第三者 user (service role) ---')
  const { data: cS, error: eS } = await admin.auth.admin.createUser({
    email: shiroushiEmail, password: PASSWORD, email_confirm: true,
  })
  if (eS) throw eS
  const sharoushi = cS.user; created.users.push(sharoushi.id)

  const { data: cO, error: eO } = await admin.auth.admin.createUser({
    email: otherEmail, password: PASSWORD, email_confirm: true,
  })
  if (eO) throw eO
  const other = cO.user; created.users.push(other.id)
  console.log(`  社労士=${sharoushi.id}\n  第三者=${other.id}`)

  console.log('--- SETUP: 顧問先A(製造業/8名) と 顧問先B(IT/30名) を作成し、社労士を両社のadmin席へ ---')
  // 社A: 2席(社労士+将来の担当者を想定)、社B: 2席。社労士1人が両社のadminになる。
  const { data: cA, error: eA } = await admin.from('companies')
    .insert({ name: `製造A_${stamp}`, seats_purchased: 2 }).select('id').single()
  if (eA) throw eA
  created.companies.push(cA.id)
  const { error: mA } = await admin.from('company_members')
    .insert({ company_id: cA.id, user_id: sharoushi.id, role: 'admin' })
  if (mA) throw mA

  const { data: cB, error: eB } = await admin.from('companies')
    .insert({ name: `ITスタートB_${stamp}`, seats_purchased: 2 }).select('id').single()
  if (eB) throw eB
  created.companies.push(cB.id)
  const { error: mB } = await admin.from('company_members')
    .insert({ company_id: cB.id, user_id: sharoushi.id, role: 'admin' })
  if (mB) throw mB

  // 各社に「明らかに別物」のプロファイルを投入（クロス汚染を検出できるように）。
  await admin.from('company_profiles').insert([
    { company_id: cA.id, key: '業種', value: '製造業' },
    { company_id: cA.id, key: '従業員数', value: '8名' },
    { company_id: cA.id, key: '所定労働時間', value: '社Aは1日8時間・交替制あり' },
  ])
  await admin.from('company_profiles').insert([
    { company_id: cB.id, key: '業種', value: 'IT(SaaS)' },
    { company_id: cB.id, key: '従業員数', value: '30名' },
    { company_id: cB.id, key: '所定労働時間', value: '社Bは1日7.5時間・フルフレックス' },
  ])
  console.log(`  顧問先A=${cA.id}\n  顧問先B=${cB.id}`)

  return { sharoushi, other, cA: cA.id, cB: cB.id }
}

async function signIn(email) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return data.session.access_token
}

async function run() {
  const { cA, cB } = await setup()

  const tokSharoushi = await signIn(shiroushiEmail)
  const tokOther = await signIn(otherEmail)
  const sharoushiClient = userClient(tokSharoushi)
  const otherClient = userClient(tokOther)

  console.log('\n--- TEST (a): /api/company 相当 — 社労士は顧問先2社とも見える ---')
  const myCompanies = await listMyCompanies(sharoushiClient)
  const ids = myCompanies.map(c => c.companyId)
  ok(myCompanies.length === 2, '社労士の所属会社は2社', `count=${myCompanies.length}`)
  ok(ids.includes(cA) && ids.includes(cB), '顧問先A と 顧問先B が両方 listMyCompanies に含まれる',
     `names=${myCompanies.map(c => c.name).join(', ')}`)
  ok(myCompanies.every(c => c.role === 'admin'), '両社とも role=admin（管理中の会社）')

  console.log('\n--- TEST (b): loadCompanyContext が顧問先ごとに分離（クロス汚染なし） ---')
  const ctxA = await loadCompanyContext(sharoushiClient, cA)
  const ctxB = await loadCompanyContext(sharoushiClient, cB)

  const aVals = ctxA.profiles.map(p => p.value)
  const bVals = ctxB.profiles.map(p => p.value)

  ok(ctxA.profiles.length === 3, '顧問先Aのプロファイルは3件', `rows=${ctxA.profiles.length}`)
  ok(ctxB.profiles.length === 3, '顧問先Bのプロファイルは3件', `rows=${ctxB.profiles.length}`)

  // 社Aの文脈に製造業の値が入り、社Bの値(IT/30名/7.5h)は一切混ざらない。
  const aHasOwn = aVals.includes('製造業') && aVals.includes('8名') && aVals.some(v => v.includes('社Aは'))
  const aNoBleed = !aVals.some(v => v.includes('IT(SaaS)') || v === '30名' || v.includes('社Bは'))
  ok(aHasOwn, '顧問先Aの文脈は自社の値(製造業/8名/社A...)を含む', `vals=${aVals.join(' | ')}`)
  ok(aNoBleed, '顧問先Aの文脈に社Bの値が混ざらない（汚染なし）')

  // 社Bの文脈にITの値が入り、社Aの値(製造業/8名/交替制)は一切混ざらない。
  const bHasOwn = bVals.includes('IT(SaaS)') && bVals.includes('30名') && bVals.some(v => v.includes('社Bは'))
  const bNoBleed = !bVals.some(v => v === '製造業' || v === '8名' || v.includes('社Aは'))
  ok(bHasOwn, '顧問先Bの文脈は自社の値(IT/30名/社B...)を含む', `vals=${bVals.join(' | ')}`)
  ok(bNoBleed, '顧問先Bの文脈に社Aの値が混ざらない（汚染なし）')

  console.log('\n--- TEST (c): 第三者ユーザーからは両社とも一切見えない ---')
  const otherCompanies = await listMyCompanies(otherClient)
  ok(otherCompanies.length === 0, '第三者の所属会社は0社', `count=${otherCompanies.length}`)

  const oCtxA = await loadCompanyContext(otherClient, cA)
  const oCtxB = await loadCompanyContext(otherClient, cB)
  ok(oCtxA.profiles.length === 0, '第三者は顧問先Aの profiles を読めない(0件)', `rows=${oCtxA.profiles.length}`)
  ok(oCtxB.profiles.length === 0, '第三者は顧問先Bの profiles を読めない(0件)', `rows=${oCtxB.profiles.length}`)

  const oA = await otherClient.from('companies').select('id').eq('id', cA)
  const oB = await otherClient.from('companies').select('id').eq('id', cB)
  ok((oA.data?.length ?? 0) === 0 && (oB.data?.length ?? 0) === 0,
     '第三者は companies 行(両社)も見られない(0件)',
     `A=${oA.data?.length} B=${oB.data?.length}`)
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
