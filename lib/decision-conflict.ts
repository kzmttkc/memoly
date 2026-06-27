import { LEGAL_FACTS, type LegalFact } from '@/lib/legal-facts'
import type { CompanyDecision } from '@/lib/company'

// ============================================================================
// decision-conflict.ts — 過去判断 vs 最新法令の「矛盾（確認対象）」検知（TOP5 #3）
//
//   競合RAG（汎用法令ボット）が構造的に出せない非対称＝「この会社が"いつ"何を決めたか」
//   を覚えていること。それと lib/legal-facts.ts の施行日(effectiveDate)を突合し、
//   「decided_at が関連法令の施行日より前＝その判断は最新改正を反映していない可能性」を
//   決定的に検知する（LLM不要・追加コストゼロ）。
//
//   厳守（Phase1コンプラ・誤検知回避）:
//     - 断定しない。「最新改正を反映していない可能性／確認対象」という条件形のみ。
//     - トピックの関連付けはキーワードマッチで保守的に（拾い過ぎない）。
//     - 施行日が読めない法令はスキップ（誤った時系列比較をしない）。
//     - 「decided_at が無い判断」はスキップ（時期不明を古いと決めつけない）。
// ============================================================================

/** 関連付けるトピックと、それに紐づく法令キー＋判断側を引き寄せるキーワード。 */
interface ConflictTopic {
  /** 表示用トピック名（カード文面に出す）。 */
  label: string
  /** この法令ファクトの key 群（lib/legal-facts.ts）。 */
  factKeys: string[]
  /** 判断(decision)の topic/summary に出たらこのトピックに該当と見なす語。 */
  keywords: string[]
}

// legal-facts.ts の確定ファクトに対応するトピック。
//   ※ legal-facts 側の TOPIC_KEYWORDS と概念は同じだが、ここは「判断（自社の決定）」を
//     法令へ寄せるための保守的キーワードに絞る（過検知を避ける）。
const CONFLICT_TOPICS: ConflictTopic[] = [
  {
    label: '年収の壁・控除（令和7年度税制改正）',
    factKeys: ['kyuyo_shotoku_kojo_min', 'kiso_kojo_shotokuzei', 'fuyo_goukei_shotoku_youken'],
    keywords: [
      '年収の壁', '103万', '106万', '123万', '130万', '160万', '扶養', '配偶者控除',
      '配偶者特別控除', '基礎控除', '給与所得控除', '年末調整', '税制改正',
    ],
  },
  {
    label: '36協定・時間外労働の上限',
    factKeys: ['overtime_gensoku', 'overtime_tokubetsu'],
    keywords: ['36協定', '三六協定', '時間外', '残業', '上限規制', '特別条項', '固定残業'],
  },
  {
    label: '厚生年金保険料率',
    factKeys: ['kosei_nenkin_rate'],
    keywords: ['厚生年金', '社会保険料', '保険料率', '年金保険料', '標準報酬'],
  },
]

/**
 * effectiveDate 文字列から YYYY-MM-DD 相当の Date を取り出す。
 *   例: '2025-12-01（令和7年分以後...）' → 2025-12-01
 *       '2019-04-01（中小企業は2020-04-01から適用）' → 2019-04-01（先頭の確定日を採用）
 *       '2017-09（平成29年9月以降固定）' → 2017-09-01
 *   読めなければ null（＝この法令は時系列比較から外す）。
 */
function parseEffectiveDate(s: string): Date | null {
  if (!s) return null
  const ymd = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    const d = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const ym = s.match(/(\d{4})-(\d{2})(?!-)/)
  if (ym) {
    const d = new Date(`${ym[1]}-${ym[2]}-01T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** decided_at(ISO) を Date に。読めなければ null。 */
function parseDecidedAt(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 判断テキストがトピックに該当するか（topic ラベル一致 or summary キーワード一致）。 */
function decisionMatchesTopic(decision: CompanyDecision, topic: ConflictTopic): boolean {
  const hay = `${decision.topic ?? ''} ${decision.summary ?? ''}`
  return topic.keywords.some(kw => hay.includes(kw))
}

/** トピックに紐づく確定ファクトのうち、最も新しい施行日のものを返す。 */
function newestFactForTopic(topic: ConflictTopic): { fact: LegalFact; date: Date } | null {
  let best: { fact: LegalFact; date: Date } | null = null
  for (const key of topic.factKeys) {
    const fact = LEGAL_FACTS.find(f => f.key === key)
    if (!fact) continue
    const date = parseEffectiveDate(fact.effectiveDate)
    if (!date) continue
    if (!best || date.getTime() > best.date.getTime()) best = { fact, date }
  }
  return best
}

/** 1件の「確認対象」（過去判断 × 最新法令）。 */
export interface DecisionConflict {
  /** 関連トピック名（カード/プロンプト文面）。 */
  topicLabel: string
  /** 該当した過去判断の要約。 */
  decisionSummary: string
  /** 判断日（ISO）。 */
  decidedAt: string
  /** 反映漏れの可能性がある法令ファクト。 */
  fact: LegalFact
}

/**
 * 過去判断（decisions）× 最新法令（legal-facts）を突合し、
 * 「判断日 < 関連法令の施行日」= 最新改正を反映していない可能性のある判断を返す。
 *   - 決定的（LLM不要）。1判断につき最も関連の強い1法令（最新施行日）で1件に絞る。
 *   - 同一トピックで複数判断が古い場合は、最も古い（最初の）該当判断を代表として返す
 *     （カードを乱発しない・トピック単位で1枚に集約）。
 *   - 該当ゼロなら空配列（ノイズ抑制）。
 */
export function detectDecisionConflicts(decisions: CompanyDecision[]): DecisionConflict[] {
  if (!decisions?.length) return []
  const conflicts: DecisionConflict[] = []

  for (const topic of CONFLICT_TOPICS) {
    const newest = newestFactForTopic(topic)
    if (!newest) continue // 施行日が読めない法令はスキップ

    // このトピックに該当し、かつ判断日が施行日より前の判断を集める。
    const stale = decisions
      .filter(d => decisionMatchesTopic(d, topic))
      .map(d => ({ d, when: parseDecidedAt(d.decidedAt) }))
      .filter((x): x is { d: CompanyDecision; when: Date } => x.when !== null)
      .filter(x => x.when.getTime() < newest.date.getTime())
      // 最も古い判断を代表に（差分が最も大きい＝確認価値が高い）。
      .sort((a, b) => a.when.getTime() - b.when.getTime())

    if (!stale.length) continue
    const rep = stale[0]
    conflicts.push({
      topicLabel: topic.label,
      decisionSummary: rep.d.summary,
      decidedAt: rep.when.toISOString(),
      fact: newest.fact,
    })
  }

  return conflicts
}
