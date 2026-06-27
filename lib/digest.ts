import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient, loadCompanyContext } from '@/lib/company'
import { checkAndIncrement } from '@/lib/rate-limit'
import type { PlanId } from '@/lib/plans'
import { loadSubsidies, loadLawChanges } from '@/lib/insights-core'
import type { CompanyProfileKV } from '@/lib/prompts'
import { detectRiskWorsening } from '@/lib/risk-trend'
import { detectDecisionConflicts } from '@/lib/decision-conflict'

// ============================================================================
// digest.ts — 「今週、自社に関係する変更」能動フィードの生成＋週次キャッシュ層。
//
//   差別化の槍＝能動診断。insights/risk は「開いて押したとき」だけ走る受け身。
//   本モジュールは、アプリ内に常設するフィード（自社プロファイルに照らして対象に
//   なりうる法改正・助成金カード）を、会社×ISO週でキャッシュして提供する。
//
//   コスト制御（CTO観点・重要）:
//     - ページ表示ごとに LLM を走らせない。会社×週で payload(jsonb) をキャッシュ。
//     - 当週キャッシュがあれば即返す（LLM呼び出し0）。
//     - 無ければ rate-limit(checkAndIncrement, kind='insights') を通して1回だけ生成し
//       キャッシュへ書く（lazy生成・クーロン不要）。生成回数は会社×週で1回に収束する。
//
//   生成ロジックは lib/insights-core.ts（insights ルートと共通）を再利用し、結果を
//   「カード」へ正規化する。カードは診断→起草の連結（番頭の独自価値）を1タップで
//   提供するため actionTo/actionLabel を持つ。citation/確定度は prompts.ts/legal-facts.ts
//   の方針（確定度ラベル・固い数値は確定値のみ・無ければ要確認・human-in-the-loop）に揃える。
//
//   Phase1コンプラ: 「社労士監修」「AI社労士」「法的精度」不使用は prompts.ts 側で担保。
// ============================================================================

// 能動カードの種別:
//   lawChange/subsidy = LLM生成（insights-core）。
//   riskAlert         = リスクスコア悪化（TOP5 #2・決定的計算・LLM不要）。
//   decisionReview    = 過去判断 vs 最新法令の確認対象（TOP5 #3・決定的計算・LLM不要）。
export type DigestCardKind = 'lawChange' | 'subsidy' | 'riskAlert' | 'decisionReview'

export interface DigestCard {
  /** カード種別（法改正 / 助成金）。UIのアイコン・並びに使う。 */
  kind: DigestCardKind
  /** (1) 何が（見出し）。 */
  title: string
  /** (2) 自社の場合どうなるか（1〜2文・自社視点）。 */
  selfImpact: string
  /** (3) 次のアクション（一般的な方向性）。 */
  nextAction: string
  /** (4) 期日（あれば。例 '2026-04-01' 等のモデル明示分のみ。無ければ undefined）。 */
  deadline?: string
  /** 確定度ラベル（prompts方針に整合）。診断・助言は「参考情報」、事実整理寄りは「一次回答（要確認）」。 */
  confidence: '参考情報' | '一次回答（要確認）'
  /** 連結先ルート（companyId は UI 側で付与）。診断→起草の連結が独自価値。 */
  actionTo: 'document' | 'chat' | 'insights' | 'risk'
  /** 連結ボタンの文言。 */
  actionLabel: string
  /** chat 連結時のプリフィル質問（actionTo='chat' のときのみ）。 */
  chatPrompt?: string
}

export interface DigestPayload {
  /** カード（対象になりうるものだけ＝ノイズ抑制）。優先度順。 */
  cards: DigestCard[]
  /** 助成金の取得元（dify/sonnet）。デバッグ・将来の出典表示用。 */
  subsidiesSource: 'dify' | 'sonnet'
  /** この週分の生成時点（ISO文字列）。 */
  generatedAt: string
  /** 免責（Phase1・コード強制付与）。 */
  disclaimer: string
  /** human-in-the-loop の固定注記（確定は人/社労士）。 */
  humanReview: string
}

export interface DigestResult {
  period: string
  payload: DigestPayload
  /** true=キャッシュ命中（LLM未実行） / false=新規生成。 */
  cached: boolean
}

// フィード共通の免責・human-in-the-loop 注記（コード強制）。
const FEED_DISCLAIMER =
  '対象になりうるものを自社プロファイルから自動で抽出した参考情報です。実際の適用可否・手続き・期日は一次情報と専門家でご確認ください。'
const HUMAN_REVIEW_NOTE =
  '最終的な適用判断・申請は、人（必要に応じて社労士）の確認のうえで進めてください。'

// 期日らしき表記をテキストから1つだけ拾う（モデルが明示した分のみ。創作はしない）。
//   例: 「2026年4月1日」「2026-04-01」「令和8年4月」「4月1日」。見つからなければ undefined。
function extractDeadline(...texts: string[]): string | undefined {
  const joined = texts.filter(Boolean).join(' ')
  const patterns: RegExp[] = [
    /(令和\d{1,2}年\d{1,2}月(?:\d{1,2}日)?)/,
    /(20\d{2}年\d{1,2}月(?:\d{1,2}日)?)/,
    /(20\d{2}[-/]\d{1,2}(?:[-/]\d{1,2})?)/,
    /(\d{1,2}月\d{1,2}日)/,
  ]
  for (const re of patterns) {
    const m = joined.match(re)
    if (m) return m[1]
  }
  return undefined
}

/** ISO週キー（YYYY-"W"WW）。会社×週でキャッシュを一意化するためのキー。 */
export function isoWeekPeriod(d: Date = new Date()): string {
  // ISO-8601 週番号（月曜始まり・木曜が属する年を採用）。
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7 // 日曜=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum) // その週の木曜へ
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * 生成結果（insights-core）を能動フィードのカード配列へ正規化する。
 *   - 法改正カードを先（緊急性・自分ごと度が高い）→ 助成金カードを後。
 *   - 対象外（空・実質情報なし）は出さない＝ノイズ抑制。
 *   - 連結先は「法改正＝詳しく診断/相談」「助成金＝相談/詳しく診断」へ振り分け、
 *     規程系の語を含む法改正は「規程ドラフトを作る(document)」へ倒す（診断→起草の連結）。
 */
function toCards(
  lawChanges: { title: string; summary: string; impact: string; action: string }[],
  subsidies: { name: string; reason: string; nextStep: string }[],
): DigestCard[] {
  const cards: DigestCard[] = []

  for (const l of lawChanges) {
    if (!l.title) continue
    const selfImpact = l.impact || l.summary
    if (!selfImpact) continue
    // 規程・就業規則・賃金規程・36協定など「文書を直す」話なら起草へ連結。
    const draftable = /就業規則|賃金規程|規程|規則|36協定|協定|労働条件通知/.test(
      `${l.title} ${l.action}`,
    )
    cards.push({
      kind: 'lawChange',
      title: l.title,
      selfImpact,
      nextAction: l.action || '自社の運用に当てはめて見直しを検討するとよいでしょう。',
      deadline: extractDeadline(l.summary, l.action, l.impact),
      confidence: '参考情報',
      actionTo: draftable ? 'document' : 'chat',
      actionLabel: draftable ? '規程ドラフトを作る' : 'この点を相談する',
      chatPrompt: draftable
        ? undefined
        : `「${l.title}」は自社にどう影響しますか。自社の前提を踏まえて整理してください。`,
    })
  }

  for (const s of subsidies) {
    if (!s.name) continue
    const selfImpact = s.reason
    if (!selfImpact) continue
    cards.push({
      kind: 'subsidy',
      title: s.name,
      selfImpact,
      nextAction: s.nextStep || '要件を確認のうえ、申請の準備を進めるとよいでしょう。',
      deadline: extractDeadline(s.reason, s.nextStep),
      confidence: '参考情報',
      actionTo: 'insights',
      actionLabel: '詳しく診断する',
    })
  }

  return cards
}

/** ISO日時を「YYYY年M月」へ（カード文面の時期提示用）。失敗時は空。 */
function fmtMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/**
 * 決定的カード（LLM不要・追加コストゼロ）を組み立てる。
 *   #2 riskAlert      : company_risk_scores の直近2件を比較し悪化を能動アラート。
 *   #3 decisionReview : 過去判断 × 最新法令(legal-facts)の施行日突合で「確認対象」を出す。
 *
 *   ★週次キャッシュには載せない（リスク再診断・判断追加が即反映されるよう毎回計算）。
 *     決定的計算のみなのでコストはDB読取り＋メモリ比較だけ＝LLMコスト増ゼロ。
 *   ★ノイズ抑制: 悪化なし／該当なしなら何も足さない。
 *
 * @param companyId 呼び出し側で所属検証済みの会社ID
 * @param decisions loadCompanyContext で取得済みの過去判断（再取得しない）
 */
async function buildDeterministicCards(
  companyId: string,
  decisions: { summary: string; topic: string | null; subject: string | null; decidedAt: string | null }[],
): Promise<DigestCard[]> {
  const cards: DigestCard[] = []

  // --- #2 リスク悪化アラート（決定的・直近2件比較） ---
  try {
    const supabase = await createServerSupabaseClient()
    const worsening = await detectRiskWorsening(supabase, companyId)
    if (worsening && worsening.drops.length > 0) {
      const top = worsening.drops[0]
      const prevMonth = fmtMonth(worsening.previousAt)
      const where = top.label === '総合' ? '総合スコア' : `「${top.label}」のスコア`
      const monthPart = prevMonth ? `${prevMonth}に${top.previous}点だった` : `前回${top.previous}点だった`
      cards.push({
        kind: 'riskAlert',
        title: `${where}が前回より低下しています`,
        selfImpact: `${monthPart}${where}が、最新の診断で${top.latest}点に下がっています（${top.drop}点の低下）。状況の変化や法改正で対応が必要になっている可能性があります。`,
        nextAction: '変化があった項目を中心に、もう一度リスク診断で内訳を確認するとよいでしょう。',
        confidence: '参考情報',
        actionTo: 'risk',
        actionLabel: 'リスク診断で確認する',
      })
    }
  } catch (e) {
    // 悪化検知の失敗はフィード全体を止めない（ベストエフォート）。
    console.error('[digest] risk worsening detection failed (skipping card)', (e as Error).message)
  }

  // --- #3 過去判断 vs 最新法令の確認対象（決定的・施行日突合） ---
  try {
    const conflicts = detectDecisionConflicts(decisions)
    for (const c of conflicts) {
      const decidedMonth = fmtMonth(c.decidedAt)
      const decidedPart = decidedMonth ? `${decidedMonth}に決めた` : '過去に決めた'
      cards.push({
        kind: 'decisionReview',
        title: `過去の自社判断が「${c.topicLabel}」の確認対象です`,
        selfImpact: `${decidedPart}判断「${c.decisionSummary}」は、その後の法令（${c.fact.label}・施行 ${c.fact.effectiveDate}）より前に決められています。最新の改正を反映できているか確認の対象になりえます。`,
        nextAction: 'この判断を最新の法令に照らして見直すか、番頭に相談して整理するとよいでしょう。',
        confidence: '参考情報',
        actionTo: 'chat',
        actionLabel: 'この点を相談する',
        chatPrompt: `過去に決めた「${c.decisionSummary}」は、${c.fact.label}（施行 ${c.fact.effectiveDate}）の改正を反映できていますか。自社の前提を踏まえて、見直しが必要か整理してください。`,
      })
    }
  } catch (e) {
    console.error('[digest] decision conflict detection failed (skipping card)', (e as Error).message)
  }

  return cards
}

/**
 * 当週の能動フィードを取得する。キャッシュ優先・無ければ生成してキャッシュ。
 *   読取り: anon(=ユーザーJWT)クライアント＋RLS（company_digests_member_select）で当週行を引く。
 *   書込み: service role（createAdminClient）で upsert（書込みポリシーは付与していないため）。
 *
 * @param companyId   呼び出し側で所属検証済みの会社ID
 * @param companyName 表示・プロンプト用の会社名
 * @param userId      rate-limit のキー（生成時のみ消費）
 * @param planId      会社プラン（rate-limit を plan 連動にする。未指定は 'free'）
 * @returns DigestResult（cached フラグ付き）。生成上限超過時は null。
 */
export async function getOrGenerateDigest(
  companyId: string,
  companyName: string,
  userId: string,
  planId: PlanId = 'free',
): Promise<DigestResult | null> {
  const period = isoWeekPeriod()

  // --- (a) キャッシュ命中なら LLMカードは即返す（LLM呼び出し0）。---
  //   ただし決定的カード（#2 リスク悪化 / #3 判断確認）は週次キャッシュに載せず、
  //   命中時も毎回フレッシュに前置きする（再診断・判断追加が即反映される／LLMコスト増ゼロ）。
  const supabase = await createServerSupabaseClient()
  const { data: cachedRow } = await supabase
    .from('company_digests')
    .select('payload, generated_at')
    .eq('company_id', companyId)
    .eq('period', period)
    .maybeSingle()

  if (cachedRow?.payload) {
    const cached = cachedRow.payload as DigestPayload
    const ctx = await loadCompanyContext(companyId)
    const liveCards = await buildDeterministicCards(companyId, ctx.decisions)
    // 決定的カード（自分ごと度が高い）を先頭に、キャッシュ済みLLMカードを後ろに。
    // 万一キャッシュ payload に決定的カードが混ざっていても重複させない（種別で除外）。
    const cachedLlmCards = cached.cards.filter(
      c => c.kind === 'lawChange' || c.kind === 'subsidy',
    )
    return {
      period,
      payload: { ...cached, cards: [...liveCards, ...cachedLlmCards] },
      cached: true,
    }
  }

  // --- (b) 未生成: rate-limit(plan連動) を通して1回だけ生成 ---
  if (!(await checkAndIncrement(userId, 'insights', planId))) {
    return null // 上限超過。呼び出し側で 429 を返す。
  }

  const ctx = await loadCompanyContext(companyId)
  const profiles: CompanyProfileKV[] = ctx.profiles

  const [subsidyResult, lawChanges, liveCards] = await Promise.all([
    loadSubsidies(companyName, profiles, companyId),
    loadLawChanges(companyName, profiles),
    buildDeterministicCards(companyId, ctx.decisions),
  ])

  // 決定的カードは「キャッシュに焼かない」。LLMカードのみキャッシュへ書き、
  // 決定的カードは返却時だけ前置きする（鮮度維持のため毎回計算する設計）。
  const llmCards = toCards(lawChanges, subsidyResult.subsidies)

  const payload: DigestPayload = {
    cards: llmCards,
    subsidiesSource: subsidyResult.source,
    generatedAt: new Date().toISOString(),
    disclaimer: FEED_DISCLAIMER,
    humanReview: HUMAN_REVIEW_NOTE,
  }

  // service role で会社×週へ upsert（同週の再生成を冪等に防ぐ。書込みは service role 限定）。
  try {
    const admin = createAdminClient()
    await admin
      .from('company_digests')
      .upsert(
        { company_id: companyId, period, payload, generated_at: payload.generatedAt },
        { onConflict: 'company_id,period' },
      )
  } catch (e) {
    // 書込み失敗（テーブル未適用等）はフィード表示を止めない。今回分は生成済みを返す。
    console.error('[digest] cache upsert failed (returning fresh)', (e as Error).message)
  }

  // 返却は決定的カードを前置きしたもの（キャッシュへ書いた payload は LLM カードのみ）。
  return {
    period,
    payload: { ...payload, cards: [...liveCards, ...llmCards] },
    cached: false,
  }
}
