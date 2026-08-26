import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { embeddingEnabled, embedText, toVectorLiteral } from '@/lib/embedding'

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

/** 過去の自社判断（memory_type='decision'）。Kabauの差別化の核。 */
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
  id: string
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
      .select('id, summary, memory_type, topic, subject, decided_at, created_at')
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

  const poolRows = (memResult.data ?? []) as MemoryRow[]

  // --- セマンティック想起（P1-1・graceful degrade）---
  //   userQuery があり embedding が使えるときだけ、クエリ埋め込みでコサイン近傍を引き、
  //   キーワード＋recency とハイブリッドに合成する。embedding/RPC が使えない環境
  //   （OPENAI_API_KEY 未設定・migration 未適用・API失敗）では simById が空のまま
  //   ＝従来のキーワード＋recency 検索へ自動フォールバックする（既存動作を壊さない）。
  const simById = new Map<string, number>()
  const extraRows: MemoryRow[] = []
  if (userQuery && embeddingEnabled()) {
    try {
      const vec = await embedText(userQuery)
      if (vec) {
        const { data: matches, error: matchErr } = await supabase.rpc('match_company_memories', {
          p_company_id: companyId,
          p_query_embedding: toVectorLiteral(vec),
          p_match_count: 30,
          p_memory_types: ['summary', 'decision'],
        })
        if (matchErr) {
          console.error('[company:loadCompanyContext] semantic RPC failed; keyword fallback', matchErr.message)
        } else if (Array.isArray(matches)) {
          const seen = new Set(poolRows.map(r => r.id))
          for (const m of matches as (MemoryRow & { similarity: number })[]) {
            simById.set(m.id, typeof m.similarity === 'number' ? m.similarity : 0)
            // recency プール(直近200)の外にある意味的関連行は取りこぼさず合流させる。
            if (!seen.has(m.id)) {
              extraRows.push({
                id: m.id,
                summary: m.summary,
                memory_type: m.memory_type,
                topic: m.topic,
                subject: m.subject,
                decided_at: m.decided_at,
                created_at: m.created_at,
              })
              seen.add(m.id)
            }
          }
        }
      }
    } catch (e) {
      console.error('[company:loadCompanyContext] semantic recall threw; keyword fallback', (e as Error).message)
    }
  }

  const rows = [...poolRows, ...extraRows]
  const summaryRows = rows.filter(r => r.memory_type === 'summary')
  const decisionRows = rows.filter(r => r.memory_type === 'decision')

  // recency ランク（全候補を新しい順に並べた順位）。ハイブリッドの recency 成分に使う。
  const recencyRank = new Map<string, number>()
  ;[...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .forEach((r, i) => recencyRank.set(r.id, i))
  const N = Math.max(1, rows.length)

  // ハイブリッドスコア = 意味類似(0..1)*0.6 + キーワード正規化(0..1)*0.3 + recency(0..1)*0.1。
  //   simById が空（＝非セマンティック時）はキーワード＋recency のみで、従来の
  //   「関連スコア降順→recency」とほぼ同じ振る舞いに縮退する。
  const hybridScore = (r: MemoryRow): number => {
    const sim = simById.get(r.id) ?? 0
    const kw = relevanceScore(r, userQuery)
    const kwNorm = kw > 0 ? Math.min(1, kw / 6) : 0
    const recNorm = (N - (recencyRank.get(r.id) ?? N)) / N
    return sim * 0.6 + kwNorm * 0.3 + recNorm * 0.1
  }

  // --- 関連記憶の選択: userQuery があれば hybrid 降順→recency、無ければ recency のみ ---
  const pickByRelevance = (src: MemoryRow[], limit: number): MemoryRow[] => {
    if (!userQuery) return src.slice(0, limit)
    return [...src]
      .map((r, i) => ({ r, i, s: hybridScore(r) }))
      // ハイブリッド降順、同点は元の並び(recency)を保持。スコア0でも recency 順で埋める。
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
  //   意味的に合流させた古い extraRows ではなく、直近プール(recency降順)を使って
  //   「新しい順に各人3件」を維持する（人ごとの状況は最新の状況を優先したいため）。
  const bySubject = new Map<string, string[]>()
  for (const r of poolRows) {
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

// ============================================================================
// F1 規程まるごと取込 — 規程原文（company_documents）の関連抜粋リトリーバ
//   看板「会社を覚える」の実体: 取り込んだ就業規則等の原文から、今回の相談に
//   関連する条文チャンクを選び、チャットの system に注入する
//   （company_memories と同じ recency+キーワード方式・非ベクトル。
//    pgvector 解禁時は relevanceScore と同様ここが差し替え点）。
// ============================================================================

/** チャットに注入する規程原文の抜粋（出典＝規程名つき）。 */
export interface CompanyRuleExcerpt {
  title: string   // 規程名（例「就業規則」）
  excerpt: string // 条文チャンク（原文のまま・上限あり）
}

// 抜粋チャンクの上限（system 注入コストの天井。prompt caching 前提でも節度を持つ）。
const EXCERPT_MAX_CHARS = 800
const EXCERPT_MAX_COUNT = 4

/**
 * 規程原文を「条」単位のチャンクに分割する。
 *   - 「第◯条」見出しを境界として優先（日本の規程はほぼこの形式）。
 *   - 条見出しが無い/条が長すぎる場合は空行・サイズで分割する。
 *   exported: ingest 側のプレビューや将来のテストからも使えるようにする。
 */
export function chunkRegulationText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  // 「第◯条」（漢数字・算用数字とも）の直前で切る。lookahead で見出し自体はチャンク先頭に残す。
  const byArticle = normalized.split(/(?=第\s*[0-9０-９一二三四五六七八九十百]+\s*条)/)

  const chunks: string[] = []
  for (const part of byArticle) {
    const p = part.trim()
    if (!p) continue
    if (p.length <= EXCERPT_MAX_CHARS) {
      chunks.push(p)
      continue
    }
    // 長すぎる塊は空行→サイズの順でさらに割る（原文の切れ目を極力尊重）。
    let buf = ''
    for (const para of p.split(/\n{2,}/)) {
      const seg = para.trim()
      if (!seg) continue
      if ((buf + '\n\n' + seg).length > EXCERPT_MAX_CHARS && buf) {
        chunks.push(buf)
        buf = seg
      } else {
        buf = buf ? `${buf}\n\n${seg}` : seg
      }
      // 段落単体が上限超過なら固定長で強制分割
      while (buf.length > EXCERPT_MAX_CHARS) {
        chunks.push(buf.slice(0, EXCERPT_MAX_CHARS))
        buf = buf.slice(EXCERPT_MAX_CHARS)
      }
    }
    if (buf) chunks.push(buf)
  }
  return chunks
}

/** チャンクとクエリの素朴な関連度（relevanceScore と同じ n-gram トークン方式）。 */
function chunkRelevance(chunk: string, tokens: string[]): number {
  const c = chunk.toLowerCase()
  let score = 0
  for (const tok of tokens) {
    if (c.includes(tok)) score += 1
  }
  return score
}

/**
 * 今回の相談(userQuery)に関連する規程原文の抜粋を返す。
 *   - RLS 下の anon(=ユーザーJWT) で company_documents を読む（自社のみ可視）。
 *   - ★ベストエフォート: テーブル未適用/クエリ失敗/クエリ空 では [] を返し、
 *     チャット等の既存機能を絶対に巻き添えにしない（loadCompanyAttributes と同じ流儀）。
 *   - 選択は「関連スコア降順→規程の更新が新しい順」。スコア0のチャンクは注入しない
 *     （無関係な条文で system を薄めない）。
 */
export async function loadRelevantRuleExcerpts(
  companyId: string,
  userQuery: string,
  maxExcerpts = EXCERPT_MAX_COUNT,
): Promise<CompanyRuleExcerpt[]> {
  const q = (userQuery ?? '').trim()
  if (!q) return []
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('company_documents')
      .select('title, content, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(5) // 規程は会社あたり数本の想定。読み過ぎない天井。
    if (error || !data || data.length === 0) {
      if (error) {
        // テーブル未適用（migration前）は想定内なので info 級に留める。
        console.error('[company:loadRelevantRuleExcerpts] select failed (non-fatal)', error.message)
      }
      return []
    }

    const tokens = extractTokens(q.toLowerCase())
    const scored: { title: string; excerpt: string; score: number; docIdx: number }[] = []
    data.forEach((doc, docIdx) => {
      for (const chunk of chunkRegulationText(doc.content ?? '')) {
        const score = chunkRelevance(chunk, tokens)
        if (score > 0) scored.push({ title: doc.title, excerpt: chunk, score, docIdx })
      }
    })

    return scored
      .sort((a, b) => (b.score - a.score) || (a.docIdx - b.docIdx))
      .slice(0, maxExcerpts)
      .map(({ title, excerpt }) => ({ title, excerpt }))
  } catch (e) {
    console.error('[company:loadRelevantRuleExcerpts] threw (non-fatal)', (e as Error).message)
    return []
  }
}

/** company_attributes（オンボーディング5問の正規化属性）の値。null=未回答。 */
export interface CompanyAttributesValues {
  industry_major: string | null
  employee_band: string | null
  has_36kyotei: boolean | null
  has_work_rules: boolean | null
  has_fixed_ot: boolean | null
}

/**
 * company_attributes（オンボーディング5問の正規化属性）を読む。
 *   digest の空状態判定・生成コンテキスト注入の一次入力（risk-audit と同型の流儀）。
 *   RLS 下の anon(=ユーザーJWT) で自社のみ可視。
 *   ★ベストエフォート: テーブル未適用/RLS 失敗でも例外にせず全 null を返す
 *     （呼び出し側のレスポンスを止めない＝既存 UX 非破壊）。
 */
export async function loadCompanyAttributes(companyId: string): Promise<CompanyAttributesValues> {
  const empty: CompanyAttributesValues = {
    industry_major: null,
    employee_band: null,
    has_36kyotei: null,
    has_work_rules: null,
    has_fixed_ot: null,
  }
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('company_attributes')
      .select('industry_major, employee_band, has_36kyotei, has_work_rules, has_fixed_ot')
      .eq('company_id', companyId)
      .maybeSingle()
    if (error || !data) return empty
    return {
      industry_major: data.industry_major ?? null,
      employee_band: data.employee_band ?? null,
      has_36kyotei: data.has_36kyotei ?? null,
      has_work_rules: data.has_work_rules ?? null,
      has_fixed_ot: data.has_fixed_ot ?? null,
    }
  } catch (e) {
    console.error('[company:loadCompanyAttributes] load threw (non-fatal)', (e as Error).message)
    return empty
  }
}

/** 回答済み（null 以外）の属性数。空状態(TTV)判定の材料に使う。 */
export function countAnsweredAttributes(attrs: CompanyAttributesValues): number {
  return Object.values(attrs).filter(v => v !== null).length
}
