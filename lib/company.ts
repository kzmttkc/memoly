import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// ============================================================================
// company.ts — 会社スコープ解決層
//   ログインユーザーが所属する会社(company)を解決するヘルパ群。
//   既存 lib/supabase-server.ts のSSR authを踏襲し、RLS下のanonクライアントで
//   company_members を引く（RLSにより自分の所属席のみ可視）。
//
//   service role は RLS をバイパスするため、可視性の正は常にanon+JWT側にある。
//   admin系操作（会社作成・席追加）でのみ service role を使い、席トリガを尊重する。
// ============================================================================

export type CompanyRole = 'admin' | 'member'

export interface CompanyMembership {
  companyId: string
  role: CompanyRole
  name: string
  plan: string
  seatsPurchased: number
}

/**
 * service role クライアント（RLSバイパス）。
 * 会社作成・席追加など「自分でまだメンバーでない／他席を操作する」必要がある
 * 書込みでのみ使う。読取りの可視性検証には使わない（バイパスするため証拠にならない）。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * ログインユーザーの所属会社を全件解決する（RLS下のanonクライアント経由）。
 * 未所属なら空配列。複数所属は created_at 昇順（最初に入った会社が先頭）。
 */
export async function listMyCompanies(): Promise<CompanyMembership[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // company_members（自分の席のみRLSで可視）と companies を結合して取得。
  const { data, error } = await supabase
    .from('company_members')
    .select('role, created_at, companies!inner(id, name, plan, seats_purchased)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: any) => ({
    companyId: row.companies.id,
    role: row.role as CompanyRole,
    name: row.companies.name,
    plan: row.companies.plan,
    seatsPurchased: row.companies.seats_purchased,
  }))
}

/**
 * デフォルト会社を1社解決する。
 *   - 複数所属時: 最初に入った会社（created_at最古）をデフォルトとする。
 *     将来 last_active_company 等の明示選択が入るまでの暫定ルール。
 *   - 未所属時: null。呼び出し側で「会社作成へ誘導」する。
 */
export async function resolveDefaultCompany(): Promise<CompanyMembership | null> {
  const companies = await listMyCompanies()
  return companies[0] ?? null
}

/**
 * 指定 companyId にユーザーが所属しているか・ロールを返す。
 * 未所属なら null。API ルートで「この会社を操作してよいか」のガードに使う。
 */
export async function getMembership(companyId: string): Promise<CompanyMembership | null> {
  const companies = await listMyCompanies()
  return companies.find(c => c.companyId === companyId) ?? null
}

/**
 * 現在のログインユーザーを返す（未ログインなら null）。API ルートの先頭ガード用。
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** 過去の自社判断（memory_type='decision'）。番頭の差別化の核。 */
export interface CompanyDecision {
  summary: string          // 下した判断（decisionText を保存したもの）
  topic: string | null     // トピックラベル（例「育休」）
  subject: string | null   // 対象者ラベル（例「Aさん(育休)」）
  decidedAt: string | null // 判断日時（ISO）
}

/** 対象者(subject)ごとにまとめた状況。担当者交代でも残る「人ごとの記憶」。 */
export interface CompanyPersonSituation {
  subject: string          // 対象者ラベル
  notes: string[]          // その人に関する記憶（新しい順・要約/判断混在）
}

export interface CompanyContext {
  profiles: { key: string; value: string }[]
  /**
   * 直近の相談要約（後方互換: 既存の buildCompanySystemPrompt/他ルートが string[] を期待）。
   * 縦深化後も「平板な記憶リスト」として残し、下の decisions/peopleSituations を補完する。
   */
  memories: string[]
  /** 過去の自社判断（新しい順）。「前回はこう決めました」を返す土台。 */
  decisions: CompanyDecision[]
  /** 対象者ごとの状況（subject でグルーピング）。「Aさんの件は…」を返す土台。 */
  peopleSituations: CompanyPersonSituation[]
}

// 内部: company_memories の行型（縦深列を含む。列未適用環境では undefined/null になる）。
interface MemoryRow {
  summary: string
  memory_type: string
  topic: string | null
  subject: string | null
  decided_at: string | null
  created_at: string
}

/** userQuery と記憶行の素朴な関連度。非ベクトル（recency は呼び出し側の取得順で担保）。
 *  topic 完全一致を最優先、次に summary/subject/topic への部分文字列一致でスコア。 */
function relevanceScore(row: MemoryRow, query: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  let score = 0
  const topic = (row.topic ?? '').toLowerCase()
  const subject = (row.subject ?? '').toLowerCase()
  const summary = (row.summary ?? '').toLowerCase()
  if (topic && (q.includes(topic) || topic.includes(q))) score += 5
  if (subject && q.includes(subject)) score += 4
  // クエリ中の2文字以上トークンが summary/topic/subject に出てくるか（日本語向けに簡易n-gram）。
  for (const tok of extractTokens(q)) {
    if (summary.includes(tok)) score += 1
    if (topic.includes(tok)) score += 1
    if (subject.includes(tok)) score += 1
  }
  return score
}

/** 日本語クエリの簡易トークン化（空白分割＋連続するCJK/英数の2-gram）。embedding不要の軽量版。 */
function extractTokens(q: string): string[] {
  const toks = new Set<string>()
  for (const w of q.split(/[\s、。,.「」（）()【】]+/)) {
    const t = w.trim()
    if (t.length >= 2) toks.add(t)
    // CJK 連続部分の 2-gram（「育児休業」→「育児」「児休」「休業」）で語の重なりを拾う。
    const cjk = t.match(/[぀-ヿ一-鿿]{2,}/g) ?? []
    for (const seg of cjk) {
      for (let i = 0; i + 2 <= seg.length; i++) toks.add(seg.slice(i, i + 2))
    }
  }
  return [...toks].slice(0, 40) // クエリが長くても上限で抑える
}

/**
 * チャットの system プロンプトに注入する会社コンテキストを取得する（縦深化版）。
 *   - profiles: company_profiles（admin承認済みの自社ルール）
 *   - memories: 直近 summary（後方互換の平板リスト）
 *   - decisions: 過去の自社判断（memory_type='decision'・新しい順）
 *   - peopleSituations: 対象者(subject)ごとの状況
 *  いずれも RLS 下の anon(=ユーザーJWT) クライアントで読む（自社のみ可視）。
 *  userQuery があれば「現在の相談に関連する記憶」を recency+キーワードで優先選択する
 *  （★pgvectorセマンティック検索は未配線。relevanceScore がその将来差し込み点）。
 */
export async function loadCompanyContext(
  companyId: string,
  maxMemories = 10,
  userQuery = '',
): Promise<CompanyContext> {
  const supabase = await createServerSupabaseClient()

  // 構造化のために decision/summary を広めに取得し、関連度＋recency でクライアント側選択する。
  // （列未適用の環境でも topic/subject/decided_at は select で null になるだけで壊れない…が、
  //  万一 select 自体が落ちたら従来挙動へフォールバックする＝既存ルート非破壊を最優先。）
  const [{ data: profileRows }, memResult] = await Promise.all([
    supabase
      .from('company_profiles')
      .select('key, value')
      .eq('company_id', companyId)
      .order('key', { ascending: true }),
    supabase
      .from('company_memories')
      .select('summary, memory_type, topic, subject, decided_at, created_at')
      .eq('company_id', companyId)
      .in('memory_type', ['summary', 'decision'])
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const profiles = profileRows ?? []

  // フォールバック: 縦深列を含む select が失敗（列未適用など）した場合は、
  // 従来どおり summary のみを引いて memories を満たす（decisions/people は空）。
  if (memResult.error) {
    console.error('[company:loadCompanyContext] depth select failed; falling back to summary-only', memResult.error)
    const { data: legacy } = await supabase
      .from('company_memories')
      .select('summary')
      .eq('company_id', companyId)
      .eq('memory_type', 'summary')
      .order('created_at', { ascending: false })
      .limit(maxMemories)
    return {
      profiles,
      memories: (legacy ?? []).map(r => r.summary),
      decisions: [],
      peopleSituations: [],
    }
  }

  const rows = (memResult.data ?? []) as MemoryRow[]
  const summaryRows = rows.filter(r => r.memory_type === 'summary')
  const decisionRows = rows.filter(r => r.memory_type === 'decision')

  // --- 関連記憶の選択: userQuery があれば relevance 降順→recency、無ければ recency のみ ---
  const pickByRelevance = (src: MemoryRow[], limit: number): MemoryRow[] => {
    if (!userQuery) return src.slice(0, limit)
    return [...src]
      .map((r, i) => ({ r, i, s: relevanceScore(r, userQuery) }))
      // 関連スコア降順、同点は元の並び(recency)を保持。スコア0でも recency 順で埋める。
      .sort((a, b) => (b.s - a.s) || (a.i - b.i))
      .slice(0, limit)
      .map(x => x.r)
  }

  const memories = pickByRelevance(summaryRows, maxMemories).map(r => r.summary)

  // --- 過去の自社判断（最大8件・新しい順 or 関連順） ---
  const decisions: CompanyDecision[] = pickByRelevance(decisionRows, 8).map(r => ({
    summary: r.summary,
    topic: r.topic,
    subject: r.subject,
    decidedAt: r.decided_at ?? r.created_at,
  }))

  // --- 対象者(subject)ごとの状況: summary+decision を subject で束ね、最大5名×各3件 ---
  const bySubject = new Map<string, string[]>()
  for (const r of rows) {
    const s = (r.subject ?? '').trim()
    if (!s) continue
    const arr = bySubject.get(s) ?? []
    if (arr.length < 3) arr.push(r.summary) // rows は recency 降順なので新しい順に積まれる
    bySubject.set(s, arr)
  }
  const peopleSituations: CompanyPersonSituation[] = [...bySubject.entries()]
    .slice(0, 5)
    .map(([subject, notes]) => ({ subject, notes }))

  return { profiles, memories, decisions, peopleSituations }
}
