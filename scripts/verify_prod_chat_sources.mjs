// ============================================================================
// verify_prod_chat_sources.mjs — 本番 /api/company/chat の回答末尾に
//   「参照した法令・指針」トレーラと Kabau 導線が付くことの実測（Trust Stack v2 #3/#4）。
// ----------------------------------------------------------------------------
// authed_e2e_capture.mjs と同じ流儀: service role で使い捨てユーザー＋会社を作り、
// 実ログイン→@supabase/ssr 形式のクッキーを組み立て→本番 API へ POST→ストリーム全文を読む。
// 終了時に会社とユーザーを削除する（本番DBに残さない）。
//
// 使い方: node scripts/verify_prod_chat_sources.mjs   （BASE_URL 既定 https://banto-roumu.com）
// ============================================================================
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE_URL ?? 'https://banto-roumu.com'
const env = {}
for (const line of readFileSync(join(process.env.ENV_DIR ?? ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SB_URL || !SERVICE || !ANON) {
  console.error('.env.local に SUPABASE URL / ANON / SERVICE ROLE が必要です')
  process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')
const { createServerClient } = await import('@supabase/ssr')
const admin = createClient(SB_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const email = `e2e-sources+${stamp}@example.com`
const password = 'Passw0rd!' + Math.random().toString(36).slice(2, 10)
const QUESTIONS = process.env.QUESTIONS
  ? JSON.parse(process.env.QUESTIONS)
  : [
      '36協定の上限時間を教えてください',
      'カスハラ対策で就業規則に何を書けばいいですか',
      '来月の社内イベントの案内文を1行で考えてください',
    ]

let userId = null
let companyId = null
const out = []
try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (cErr) throw cErr
  userId = created.user.id
  const { data: company, error: coErr } = await admin
    .from('companies')
    .insert({ name: `E2E出典検証_${stamp}`, plan: 'free' })
    .select('id')
    .single()
  if (coErr) throw new Error(`companies insert failed: ${coErr.message}`)
  companyId = company.id
  const { error: memErr } = await admin
    .from('company_members')
    .insert({ company_id: companyId, user_id: userId, role: 'admin' })
  if (memErr) throw new Error(`company_members insert failed: ${memErr.message}`)

  const anon = createClient(SB_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({ email, password })
  if (sErr) throw sErr
  const jar = {}
  const ssr = createServerClient(SB_URL, ANON, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: list => list.forEach(({ name, value }) => (jar[name] = value)),
    },
  })
  await ssr.auth.setSession({
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
  })
  const cookieHeader = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

  for (const q of QUESTIONS) {
    const res = await fetch(`${BASE}/api/company/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ companyId, messages: [{ role: 'user', content: q }] }),
    })
    const text = await res.text()
    const idx = text.indexOf('【参照した法令・指針')
    const trailer = idx >= 0 ? text.slice(idx) : null
    out.push({
      question: q,
      status: res.status,
      length: text.length,
      hasTrailer: idx >= 0,
      hasKabau: text.includes('utm_campaign=kabau_set'),
      trailer,
      head: text.slice(0, 160).replace(/\n/g, ' / '),
    })
  }
} finally {
  if (companyId) await admin.from('companies').delete().eq('id', companyId).then(({ error }) => error && console.error('company cleanup failed', error.message))
  if (userId) await admin.auth.admin.deleteUser(userId).catch(e => console.error('user cleanup failed', e?.message))
}
for (const r of out) {
  console.log(`\n=== Q: ${r.question}\nstatus=${r.status} length=${r.length} hasTrailer=${r.hasTrailer} hasKabau=${r.hasKabau}\nhead: ${r.head}\n--- trailer ---\n${r.trailer ?? '(なし)'}`)
}
