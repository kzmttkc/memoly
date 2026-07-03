// ============================================================================
// company_documents_e2e.mjs — F1「規程まるごと取込」の実トランザクション検証
//
//   前提: supabase/company_documents.sql を適用済みであること（未適用なら全FAILする。
//         それ自体が「適用漏れ」の検知になる）。
//
//   証拠主義: service role は RLS をバイパスするため可視性の証拠にならない。
//   → company_rls_e2e.mjs と同じ手法で、実ユーザーJWTを載せた anon クライアントで
//      「admin書込み可 / member読取り可・書込み不可 / 他社不可視」を実測する。
//
//   検証項目:
//     (A) admin は規程原文を insert できる（anon+JWT・RLS admin_write）
//     (B) 同名 title の upsert は差替えになる（行が増えない・内容が新しくなる）
//     (C) 同じ会社の member は読める（RLS member_select）が、書けない（admin_write）
//     (D) 他社ユーザーからは不可視（0件）
//     (E) DB CHECK: content 200,000字超は拒否される（アプリ層の天井の最終防衛線）
//     (F) リトリーバ挙動: lib/company.ts loadRelevantRuleExcerpts と同じ
//         チャンク分割＋トークン一致で「残業上限の相談→第36条抜粋」が選ばれる
//         （※ Next実行時コンテキスト依存のため同ロジックを逐語再現して検証）
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
const adminEmail = `e2e_doc_admin_${stamp}@example.test`
const memberEmail = `e2e_doc_member_${stamp}@example.test`
const otherEmail = `e2e_doc_other_${stamp}@example.test`

let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' :: ' + detail : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`) }
}

// JWT付きanonクライアント（実ユーザー視点）
function userClient(accessToken) {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function signIn(email) {
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return data.session.access_token
}

const created = { users: [], companies: [] }

// --- lib/company.ts loadRelevantRuleExcerpts の選択ロジック（逐語再現）---
const EXCERPT_MAX_CHARS = 800
function chunkRegulationText(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const byArticle = normalized.split(/(?=第\s*[0-9０-９一二三四五六七八九十百]+\s*条)/)
  const chunks = []
  for (const part of byArticle) {
    const p = part.trim()
    if (!p) continue
    if (p.length <= EXCERPT_MAX_CHARS) { chunks.push(p); continue }
    let buf = ''
    for (const para of p.split(/\n{2,}/)) {
      const seg = para.trim()
      if (!seg) continue
      if ((buf + '\n\n' + seg).length > EXCERPT_MAX_CHARS && buf) { chunks.push(buf); buf = seg }
      else { buf = buf ? `${buf}\n\n${seg}` : seg }
      while (buf.length > EXCERPT_MAX_CHARS) { chunks.push(buf.slice(0, EXCERPT_MAX_CHARS)); buf = buf.slice(EXCERPT_MAX_CHARS) }
    }
    if (buf) chunks.push(buf)
  }
  return chunks
}
function extractTokens(q) {
  const toks = new Set()
  for (const w of q.split(/[\s、。,.「」（）()【】]+/)) {
    const t = w.trim()
    if (t.length >= 2) toks.add(t)
    const cjk = t.match(/[぀-ヿ一-鿿]{2,}/g) ?? []
    for (const seg of cjk) {
      for (let i = 0; i + 2 <= seg.length; i++) toks.add(seg.slice(i, i + 2))
    }
  }
  return [...toks].slice(0, 40)
}
function chunkRelevance(chunk, tokens) {
  const c = chunk.toLowerCase()
  let score = 0
  for (const tok of tokens) { if (c.includes(tok)) score += 1 }
  return score
}

const REGULATION = `就業規則

第1条（目的）
この規則は、当社の労働条件その他の就業に関する事項を定める。

第9条（所定労働時間）
所定労働時間は1日8時間、週40時間とする。

第36条（時間外労働）
会社は、労使協定の範囲内で時間外労働を命じることがある。時間外労働の上限は月45時間・年360時間とする。

第37条（割増賃金）
時間外労働に対しては2割5分増の割増賃金を支払う。`

async function setup() {
  console.log('--- SETUP: users/companies (service role) ---')
  const users = {}
  for (const [name, email] of [['admin', adminEmail], ['member', memberEmail], ['other', otherEmail]]) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw error
    users[name] = data.user.id
    created.users.push(data.user.id)
  }

  // 社A（admin+member の2席）/ 社B（other の1席）
  const { data: compA, error: eA } = await admin.from('companies')
    .insert({ name: `E2E規程社A_${stamp}`, seats_purchased: 2 }).select('id').single()
  if (eA) throw eA
  created.companies.push(compA.id)
  const { data: compB, error: eB } = await admin.from('companies')
    .insert({ name: `E2E規程社B_${stamp}` }).select('id').single()
  if (eB) throw eB
  created.companies.push(compB.id)

  const { error: m1 } = await admin.from('company_members')
    .insert({ company_id: compA.id, user_id: users.admin, role: 'admin' })
  if (m1) throw m1
  const { error: m2 } = await admin.from('company_members')
    .insert({ company_id: compA.id, user_id: users.member, role: 'member' })
  if (m2) throw m2
  const { error: m3 } = await admin.from('company_members')
    .insert({ company_id: compB.id, user_id: users.other, role: 'admin' })
  if (m3) throw m3

  return { users, companyA: compA.id, companyB: compB.id }
}

async function run() {
  const { companyA } = await setup()
  const adminCli = userClient(await signIn(adminEmail))
  const memberCli = userClient(await signIn(memberEmail))
  const otherCli = userClient(await signIn(otherEmail))

  console.log('--- (A) admin insert（anon+JWT・RLS admin_write）---')
  const { data: doc1, error: insErr } = await adminCli.from('company_documents')
    .upsert(
      { company_id: companyA, title: '就業規則', doc_type: '規程', content: REGULATION, char_count: REGULATION.length },
      { onConflict: 'company_id,title' },
    ).select('id, title, char_count').single()
  ok(!insErr && doc1?.title === '就業規則', 'admin が規程原文を取込できる', insErr?.message ?? `id=${doc1?.id}`)

  console.log('--- (B) 同名 title の upsert は差替え ---')
  const v2 = REGULATION + '\n\n第50条（改定）\n本規則は令和8年4月1日に改定した。'
  const { error: upErr } = await adminCli.from('company_documents')
    .upsert(
      { company_id: companyA, title: '就業規則', doc_type: '規程', content: v2, char_count: v2.length, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,title' },
    )
  const { data: rows } = await adminCli.from('company_documents')
    .select('content').eq('company_id', companyA).eq('title', '就業規則')
  ok(!upErr && rows?.length === 1, '行が増えない（1行のまま）', `rows=${rows?.length}`)
  ok(rows?.[0]?.content?.includes('第50条'), '内容が新版に差し替わる')

  console.log('--- (C) member は読めるが書けない ---')
  const { data: memRead, error: memReadErr } = await memberCli.from('company_documents')
    .select('title').eq('company_id', companyA)
  ok(!memReadErr && memRead?.length === 1, 'member は自社の規程を読める', `rows=${memRead?.length}`)
  const { error: memWriteErr } = await memberCli.from('company_documents')
    .insert({ company_id: companyA, title: '賃金規程', content: 'x'.repeat(20), char_count: 20 })
  ok(!!memWriteErr, 'member の書込みは RLS で拒否される', memWriteErr?.message?.slice(0, 60))

  console.log('--- (D) 他社ユーザーからは不可視 ---')
  const { data: otherRead } = await otherCli.from('company_documents')
    .select('title').eq('company_id', companyA)
  ok((otherRead ?? []).length === 0, '他社の規程は0件（RLS遮断）', `rows=${otherRead?.length}`)

  console.log('--- (E) DB CHECK: 200,000字超は拒否 ---')
  const { error: bigErr } = await adminCli.from('company_documents')
    .insert({ company_id: companyA, title: '巨大テスト', content: 'あ'.repeat(200001), char_count: 200001 })
  ok(!!bigErr, '200,001字の insert が CHECK で失敗する', bigErr?.message?.slice(0, 60))

  console.log('--- (F) リトリーバ: 残業上限の相談 → 第36条が選ばれる ---')
  const { data: docs } = await memberCli.from('company_documents')
    .select('title, content, updated_at').eq('company_id', companyA)
    .order('updated_at', { ascending: false }).limit(5)
  const tokens = extractTokens('残業時間の上限は何時間ですか'.toLowerCase())
  const scored = []
  ;(docs ?? []).forEach((d, docIdx) => {
    for (const chunk of chunkRegulationText(d.content ?? '')) {
      const score = chunkRelevance(chunk, tokens)
      if (score > 0) scored.push({ title: d.title, excerpt: chunk, score, docIdx })
    }
  })
  scored.sort((a, b) => (b.score - a.score) || (a.docIdx - b.docIdx))
  const top = scored[0]
  ok(!!top && top.excerpt.includes('第36条') && top.excerpt.includes('月45時間'),
    '最上位抜粋が第36条（月45時間）', top ? JSON.stringify(top.excerpt.slice(0, 24)) + ` score=${top.score}` : 'no excerpt')
}

async function teardown() {
  console.log('--- TEARDOWN (service role) ---')
  for (const id of created.companies) {
    await admin.from('companies').delete().eq('id', id) // company_documents は ON DELETE CASCADE
  }
  for (const id of created.users) {
    await admin.auth.admin.deleteUser(id)
  }
  console.log('  cleaned.')
}

run()
  .catch(e => { fail++; console.error('E2E error:', e.message) })
  .finally(async () => {
    await teardown().catch(e => console.error('teardown error:', e.message))
    console.log(`\n${pass} passed / ${fail} failed`)
    process.exit(fail ? 1 : 0)
  })
