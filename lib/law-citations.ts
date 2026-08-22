// ============================================================================
// law-citations.ts — 回答末尾の「参照した法令・指針（一次情報）」ブロック
//   (WORK_ORDERS.md Trust Stack v2 #4・STATE 7/29 提言#2・2026-08-21)
//
//   何をするか:
//     チャットの回答末尾に、参照した条文／通達／指針の「名称＋条番号＋一次URL
//     （e-Gov法令検索／厚労省／国税庁／日本年金機構）」を構造化して付ける。
//     出典候補は既存の確定ファクトベース（lib/legal-facts.ts・selectFactsForQuery）
//     から取る。LLMの出力からは取らない（LLMが書いた条番号は検証できないため使わない）。
//
//   捏造しないためのガード（fail-closed）:
//     - 条番号は e-Gov法令API v2 `GET /api/2/law_data/{law_id}?elm=MainProvision-Article_N`
//       で「その法令にその条が実在する」ことを確認できたものだけを表示する。
//       仕様は https://laws.e-gov.go.jp/api/2/swagger-ui/lawapi-v2.yaml（公式OpenAPI）で
//       2026-08-21 に確認。実在しない条は HTTP 400 / code "400021"
//       （「要素（elm）に合致する要素が法令本文に存在しません。」）で返る（実呼び出しで確認）。
//     - 実在しない（400021）→ その条番号を落とす（法令名だけ残す）。
//     - API 失敗（ネットワーク断・5xx・タイムアウト・想定外の形）→ その条は「未確認」として
//       落とす。全件が未確認なら条文セクションを出さず「自動確認ができなかった」と明示する。
//       黙って捏造しない・黙って省かない。
//     - 確定ファクトに当たらない質問 → 「一般的な情報提供（出典なし）」と明示し専門家相談を促す。
//
//   カスハラ文脈の回答には Kabau 実務パック導線（lib/kabau-pack.ts）を末尾に1箇所付ける。
//   出典の可否とは独立（#3 番頭側）。
//
//   出力は text/plain ストリームの末尾に追記する平文（1行1項目・URLは行末）。
//   描画は components/ui/AnswerSources.tsx が行う（行頭「・」＋行末URLを構造化して表示）。
//   履歴（company_messages）にもそのまま残るため、再読込後も同じ表示になる。
//
//   このファイルは Node の単体テスト（node --test・型ストリップ実行）から直接 import されるため
//   '@/...' エイリアスを使わず、相対 import は拡張子付き（Node は拡張子無しを解決しない。
//   tsconfig の allowImportingTsExtensions で許可）。
// ============================================================================

import { selectFactsForQuery, type LegalFact } from './legal-facts.ts'
import { KABAU_PACK_URL, KABAU_PACK_COPY, isKasuharaQuery } from './kabau-pack.ts'

// ----------------------------------------------------------------------------
// 法令の台帳（法令名 → e-Gov 法令ID）。ここに無い法令の条番号は拾わない（知らない法令は出さない）。
//   法令IDは e-Gov法令検索の URL（https://laws.e-gov.go.jp/law/{law_id}）と同じ。
//   2026-08-21 に /api/2/law_data/{law_id} を実呼び出しして law_title が一致することを確認済み。
// ----------------------------------------------------------------------------
export interface LawEntry {
  /** 表示名 */
  name: string
  /** e-Gov 法令ID */
  lawId: string
  /** 出典名に現れうる別表記（正式名称・「改正〜」など） */
  aliases: string[]
}

export const LAW_REGISTRY: LawEntry[] = [
  // 長い名称を先に置く（「労働基準法施行規則」を「労働基準法」として誤認しないため）。
  { name: '労働基準法施行規則', lawId: '322M40000100023', aliases: [] },
  { name: '労働基準法', lawId: '322AC0000000049', aliases: [] },
  {
    name: '労働施策総合推進法',
    lawId: '341AC0000000132',
    aliases: ['労働施策の総合的な推進並びに労働者の雇用の安定及び職業生活の充実等に関する法律'],
  },
]

export const EGOV_API_BASE = 'https://laws.e-gov.go.jp/api/2/law_data/'
export const EGOV_LAW_PAGE = 'https://laws.e-gov.go.jp/law/'

/** 回答末尾ブロックの見出し。クライアントはこの共通接頭辞で本文と切り分ける。 */
export const SOURCES_TRAILER_MARKER = '【参照した法令・指針'
export const SOURCES_HEADING = '【参照した法令・指針（一次情報）】'
export const SOURCES_NONE_HEADING = '【参照した法令・指針（出典なし）】'
export const SOURCES_UNVERIFIED_HEADING = '【参照した法令・指針（未確認）】'
export const KABAU_BLOCK_HEADING = '【カスハラ対策の書式】'
export const SOURCES_FOOTNOTE = '条番号は e-Gov法令API で実在を確認できたものだけを表示しています。'

const SPECIALIST_LINE = '個別の判断は社会保険労務士など専門家にご相談ください。'

// 表示上限（長大化の天井。確定ファクトの条参照は多くても十数件）
const MAX_ARTICLE_LINES = 8
const MAX_REF_LINES = 4
const MAX_VERIFY = 12

// ----------------------------------------------------------------------------
// 1) 出典名から「法令名＋条番号」を取り出す
// ----------------------------------------------------------------------------
export interface ArticleRef {
  lawName: string
  lawId: string
  /** e-Gov の Article Num 形式（例 "36"・枝番は "24_3"） */
  articleNum: string
}

const FULLWIDTH_DIGITS = /[０-９]/g
function normalizeDigits(s: string): string {
  return s.replace(FULLWIDTH_DIGITS, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
}

// 法令名の直後に続く「第N条（のM）（第N項）（第N号）」の列挙（・ 〜 ～ 、 で連結）だけを条参照とみなす。
//   「同法」「旧第138条」のように法令名から離れた参照は拾わない（解決できないため）。
const LAW_NAME_ALTERNATION = LAW_REGISTRY.flatMap(e => [e.name, ...e.aliases])
  // 長い名称を先に（正規表現の選択は左優先）
  .sort((a, b) => b.length - a.length)
  .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')
const ARTICLE_TOKEN = '第\\d+条(?:の\\d+)*(?:第\\d+項)?(?:第\\d+号)?'
const TAIL_TOKEN = '第\\d+項(?:第\\d+号)?|第\\d+号'
const ARTICLE_RUN_RE = new RegExp(
  `(${LAW_NAME_ALTERNATION})((?:${ARTICLE_TOKEN}|${TAIL_TOKEN}|[・〜～、])+)`,
  'g',
)
const ARTICLE_RE = /第(\d+)条((?:の\d+)*)/g

function lawEntryByName(name: string): LawEntry | undefined {
  return LAW_REGISTRY.find(e => e.name === name || e.aliases.includes(name))
}

/** e-Gov 法令ID → 台帳エントリ（出典URLが e-Gov の法令ページのときに使う）。 */
export function lawEntryById(lawId: string): LawEntry | undefined {
  return LAW_REGISTRY.find(e => e.lawId === lawId)
}

/** 出典名文字列から、台帳にある法令の条参照を取り出す（重複は除く・出現順）。 */
export function extractArticleRefs(sourceName: string): ArticleRef[] {
  const text = normalizeDigits(sourceName ?? '')
  const out: ArticleRef[] = []
  const seen = new Set<string>()
  for (const run of text.matchAll(ARTICLE_RUN_RE)) {
    const entry = lawEntryByName(run[1])
    if (!entry) continue
    for (const a of run[2].matchAll(ARTICLE_RE)) {
      const branches = a[2] ? a[2].split('の').filter(Boolean) : []
      const articleNum = [a[1], ...branches].join('_')
      const key = `${entry.lawId}:${articleNum}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ lawName: entry.name, lawId: entry.lawId, articleNum })
    }
  }
  return out
}

/** e-Gov法令API v2 の elm パラメータ（本則の条）。 */
export function egovArticleElm(articleNum: string): string {
  return `MainProvision-Article_${articleNum}`
}

/** 表示ラベル（"24_3" → "第24条の3"）。 */
export function articleLabel(articleNum: string): string {
  const [head, ...branches] = articleNum.split('_')
  return `第${head}条${branches.map(b => `の${b}`).join('')}`
}

/** e-Gov 法令ページの条アンカー付きURL。 */
export function articleUrl(lawId: string, articleNum: string): string {
  return `${EGOV_LAW_PAGE}${lawId}#Mp-At_${articleNum}`
}

// ----------------------------------------------------------------------------
// 2) e-Gov 実在確認
// ----------------------------------------------------------------------------
export type VerifyResult = 'exists' | 'missing' | 'error'

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>

export interface VerifyDeps {
  fetchImpl?: FetchLike
  /** 実在/非実在の結果キャッシュ（プロセス内）。error はキャッシュしない。 */
  cache?: Map<string, { result: VerifyResult; expiresAt: number }>
  timeoutMs?: number
  now?: () => number
}

const DEFAULT_CACHE = new Map<string, { result: VerifyResult; expiresAt: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 4000

/**
 * 法令ID＋条番号の実在を e-Gov法令API v2 で確認する。
 *   exists  : 200 かつ law_full_text が Article 要素
 *   missing : 400 かつ code "400021"（elm に合致する要素が無い）
 *   error   : それ以外すべて（404=法令ID誤り・5xx・ネットワーク断・タイムアウト・想定外の形）
 * error と missing を混同しない（error は「確認できなかった」であって「存在しない」ではない）。
 */
export async function verifyArticleExists(
  lawId: string,
  articleNum: string,
  deps: VerifyDeps = {},
): Promise<VerifyResult> {
  const fetchImpl: FetchLike = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  const cache = deps.cache ?? DEFAULT_CACHE
  const now = deps.now ?? Date.now
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const key = `${lawId}:${articleNum}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now()) return hit.result

  const url = `${EGOV_API_BASE}${encodeURIComponent(lawId)}?elm=${encodeURIComponent(
    egovArticleElm(articleNum),
  )}&response_format=json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let result: VerifyResult = 'error'
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (res.status === 200) {
      const json = (await res.json().catch(() => null)) as
        | { law_full_text?: { tag?: string; attr?: { Num?: string } } }
        | null
      const node = json?.law_full_text
      if (node && node.tag === 'Article' && (node.attr?.Num === undefined || node.attr.Num === articleNum)) {
        result = 'exists'
      }
    } else if (res.status === 400) {
      const json = (await res.json().catch(() => null)) as { code?: string } | null
      if (json?.code === '400021') result = 'missing'
    }
  } catch {
    result = 'error'
  } finally {
    clearTimeout(timer)
  }
  if (result !== 'error') cache.set(key, { result, expiresAt: now() + CACHE_TTL_MS })
  return result
}

// ----------------------------------------------------------------------------
// 3) 質問 → 根拠ブロック
// ----------------------------------------------------------------------------
export interface VerifiedArticle {
  num: string
  label: string
  url: string
}
export interface VerifiedLaw {
  lawName: string
  lawId: string
  lawUrl: string
  /** e-Gov で実在確認できた条だけ（確認できなければ空） */
  articles: VerifiedArticle[]
}
export interface SourceRef {
  name: string
  url: string
}
export interface AnswerSources {
  /** sources=出典あり / none=確定ファクトに当たらない / unverified=e-Gov確認が全滅 */
  status: 'sources' | 'none' | 'unverified'
  laws: VerifiedLaw[]
  /** 条文以外の一次情報（厚労省・国税庁・日本年金機構の解説／指針／通達ページ） */
  refs: SourceRef[]
  /** カスハラ文脈（Kabau 実務パック導線を付ける） */
  kasuhara: boolean
}

const ARTICLE_STRIP_RE = new RegExp(ARTICLE_TOKEN, 'g')

/** 条文以外の一次情報の表示名。未確認の条番号が漏れないよう「第N条…」を落として整える。
 *  法令番号（「令和7年法律第63号」「令和8年政令第17号」）の「第N号」は条参照ではないので残す。 */
function refDisplayName(sourceName: string): string {
  return normalizeDigits(sourceName)
    // 台帳の法令名に続く条の列挙（「・第6項」のような項・号の続きを含む）をまとめて落とす
    .replace(ARTICLE_RUN_RE, '$1')
    // 法令名から離れた「第N条」単体も落とす（「旧第138条」など）
    .replace(ARTICLE_STRIP_RE, '')
    .replace(/[・、]{2,}/g, '・')
    .replace(/(^|／)[・、]+/g, '$1')
    .replace(/[・、]+(／|$)/g, '$1')
    .replace(/／{2,}/g, '／')
    .replace(/^／|／$/g, '')
    .trim()
}

function isEgovLawUrl(url: string): string | null {
  const m = /^https:\/\/laws\.e-gov\.go\.jp\/law\/([0-9A-Z]+)/.exec(url)
  return m ? m[1] : null
}

/**
 * 質問文から（確定ファクトベース経由で）出典候補を集め、条番号を e-Gov で確認して組み立てる。
 *   例外は投げない（計測や出典表示の失敗で回答本体を壊さない）。
 */
export async function buildAnswerSources(query: string, deps: VerifyDeps = {}): Promise<AnswerSources> {
  const kasuhara = isKasuharaQuery(query)
  let facts: LegalFact[] = []
  try {
    facts = selectFactsForQuery(query)
  } catch {
    facts = []
  }
  if (!facts.length) return { status: 'none', laws: [], refs: [], kasuhara }

  // 候補の収集（出現順・重複なし）
  const lawOrder: string[] = []
  const lawsById = new Map<string, VerifiedLaw>()
  const ensureLaw = (entry: LawEntry) => {
    if (!lawsById.has(entry.lawId)) {
      lawOrder.push(entry.lawId)
      lawsById.set(entry.lawId, {
        lawName: entry.name,
        lawId: entry.lawId,
        lawUrl: `${EGOV_LAW_PAGE}${entry.lawId}`,
        articles: [],
      })
    }
    return lawsById.get(entry.lawId)!
  }
  const candidates: ArticleRef[] = []
  const seenCandidate = new Set<string>()
  const refs: SourceRef[] = []
  const seenRefUrl = new Set<string>()

  for (const f of facts) {
    for (const r of extractArticleRefs(f.sourceName)) {
      const key = `${r.lawId}:${r.articleNum}`
      if (seenCandidate.has(key)) continue
      seenCandidate.add(key)
      candidates.push(r)
      ensureLaw(lawEntryById(r.lawId)!)
    }
    const egovId = isEgovLawUrl(f.sourceUrl)
    if (egovId) {
      const entry = lawEntryById(egovId)
      if (entry) ensureLaw(entry)
      // 台帳に無い法令IDの e-Gov URL は表示しない（名称を保証できない）
    } else if (/^https:\/\/(www\.mhlw\.go\.jp|www\.nta\.go\.jp|www\.nenkin\.go\.jp)\//.test(f.sourceUrl)) {
      if (!seenRefUrl.has(f.sourceUrl)) {
        seenRefUrl.add(f.sourceUrl)
        refs.push({ name: refDisplayName(f.sourceName), url: f.sourceUrl })
      }
    }
  }

  // e-Gov 実在確認（並列・上限あり）
  const toVerify = candidates.slice(0, MAX_VERIFY)
  let results: VerifyResult[] = []
  try {
    results = await Promise.all(toVerify.map(r => verifyArticleExists(r.lawId, r.articleNum, deps)))
  } catch {
    results = toVerify.map(() => 'error' as const)
  }
  if (toVerify.length > 0 && results.every(r => r === 'error')) {
    // 確認が全滅＝条文セクションは出さない（黙って捏造しない・黙って省かない）
    return { status: 'unverified', laws: [], refs: [], kasuhara }
  }
  toVerify.forEach((r, i) => {
    if (results[i] !== 'exists') return
    lawsById.get(r.lawId)!.articles.push({
      num: r.articleNum,
      label: articleLabel(r.articleNum),
      url: articleUrl(r.lawId, r.articleNum),
    })
  })
  const laws = lawOrder.map(id => lawsById.get(id)!)
  for (const l of laws) {
    l.articles.sort((a, b) => {
      const pa = a.num.split('_').map(Number)
      const pb = b.num.split('_').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (d !== 0) return d
      }
      return 0
    })
  }
  if (!laws.length && !refs.length) return { status: 'none', laws: [], refs: [], kasuhara }
  return { status: 'sources', laws, refs, kasuhara }
}

// ----------------------------------------------------------------------------
// 4) 平文トレーラ（ストリーム末尾に追記・履歴にも残る）
// ----------------------------------------------------------------------------
export function formatSourcesTrailer(s: AnswerSources): string {
  const parts: string[] = []
  if (s.status === 'none') {
    parts.push(
      `${SOURCES_NONE_HEADING}\n一般的な情報提供（出典なし）です。この回答には一次情報（条文・通達・指針）の出典を添えられていません。${SPECIALIST_LINE}`,
    )
  } else if (s.status === 'unverified') {
    parts.push(
      `${SOURCES_UNVERIFIED_HEADING}\n一次情報の自動確認（e-Gov法令API）ができなかったため、条文の表示を省略しています。${SPECIALIST_LINE}`,
    )
  } else {
    const lines: string[] = []
    let articleLines = 0
    for (const l of s.laws) {
      if (l.articles.length) {
        for (const a of l.articles) {
          if (articleLines >= MAX_ARTICLE_LINES) break
          lines.push(`・${l.lawName} ${a.label}（e-Gov法令検索） ${a.url}`)
          articleLines++
        }
      } else {
        lines.push(`・${l.lawName}（e-Gov法令検索） ${l.lawUrl}`)
      }
    }
    for (const r of s.refs.slice(0, MAX_REF_LINES)) {
      lines.push(`・${r.name} ${r.url}`)
    }
    parts.push(`${SOURCES_HEADING}\n${lines.join('\n')}\n${SOURCES_FOOTNOTE}`)
  }
  if (s.kasuhara) {
    parts.push(
      `${KABAU_BLOCK_HEADING}\n${KABAU_PACK_COPY.title}\n${KABAU_PACK_COPY.sub}\n・${KABAU_PACK_COPY.button} ${KABAU_PACK_URL}`,
    )
  }
  return `\n\n${parts.join('\n\n')}`
}
