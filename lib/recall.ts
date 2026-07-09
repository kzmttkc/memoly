import type { CompanyContext, CompanyRuleExcerpt } from '@/lib/company'

// ============================================================================
// recall.ts — 「この相談で参照した自社の記憶」の可視化ペイロード（革新性の体感化）。
// ----------------------------------------------------------------------------
//   番頭の核の差別化＝「自社を覚えていて、それを踏まえて答える」。その"想起"を
//   ユーザーに見える形で返すための、チャット応答に添える軽量サマリを組み立てる。
//
//   設計原則:
//     - 非PII: 氏名等が入りうる subject や記憶の本文(summary)は載せない。
//       規程名(title)・自社ルールのkey・判断のtopicラベル/日付だけを出す
//       （これらは分類ラベルで、個人情報にはあたらない）。相談記憶は件数のみ。
//     - 軽量: HTTPレスポンスヘッダ(X-Recalled-Memory)で運ぶため、件数に上限を設け短く保つ。
//     - graceful: セマンティック(pgvector)が未有効でも、キーワード＋recencyで想起した
//       分をそのまま可視化できる（この関数は ctx の中身をラベル化するだけ）。
// ============================================================================

export interface RecalledItem {
  kind: 'profile' | 'rule' | 'decision'
  label: string
  /** 判断(decision)のときの決定日（ISO文字列・日付だけ表示に使う）。 */
  at?: string
}

export interface RecalledMemory {
  /** 参照した自社ルール(company_profiles)の件数。 */
  profileCount: number
  /** 参照した過去の相談記憶(summary)の件数（本文は載せない）。 */
  memoryCount: number
  /** 参照した過去の自社判断(decision)の件数。 */
  decisionCount: number
  /** 参照した規程原文の本数（ユニーク出典数）。 */
  ruleDocCount: number
  /** セマンティック想起が有効だったか（pgvector 経路）。 */
  semantic: boolean
  /** 表示用の想起アイテム（ラベルのみ・非PII・件数上限あり）。 */
  items: RecalledItem[]
}

const MAX_PROFILE_ITEMS = 6
const MAX_RULE_ITEMS = 4
const MAX_DECISION_ITEMS = 5

/**
 * チャットの system に注入した会社コンテキストから、可視化用の想起サマリを作る。
 * @param ctx           loadCompanyContext の結果（profiles/memories/decisions）
 * @param ruleExcerpts  loadRelevantRuleExcerpts の結果（規程原文の関連抜粋）
 * @param semantic      セマンティック想起が有効だったか
 */
export function buildRecalledMemory(
  ctx: CompanyContext,
  ruleExcerpts: CompanyRuleExcerpt[],
  semantic: boolean,
): RecalledMemory {
  const items: RecalledItem[] = []

  // 自社ルール（keyだけ＝「所定労働時間」等の分類ラベル・非PII）。
  for (const p of ctx.profiles.slice(0, MAX_PROFILE_ITEMS)) {
    if (p.key) items.push({ kind: 'profile', label: p.key })
  }

  // 規程原文の出典（規程名のユニーク集合・非PII）。
  const seenTitles = new Set<string>()
  for (const ex of ruleExcerpts) {
    if (!ex.title || seenTitles.has(ex.title)) continue
    seenTitles.add(ex.title)
    items.push({ kind: 'rule', label: ex.title })
    if (seenTitles.size >= MAX_RULE_ITEMS) break
  }

  // 過去の自社判断（topicラベル＋決定日。subject=氏名等は載せない）。
  for (const d of ctx.decisions.slice(0, MAX_DECISION_ITEMS)) {
    items.push({
      kind: 'decision',
      label: d.topic || '過去の相談で決めた方針',
      at: d.decidedAt ?? undefined,
    })
  }

  return {
    profileCount: ctx.profiles.length,
    memoryCount: ctx.memories.length,
    decisionCount: ctx.decisions.length,
    ruleDocCount: seenTitles.size,
    semantic,
    items,
  }
}

/** レスポンスヘッダに載せられる形（URLエンコード済JSON）へ直列化する。空想起なら null。 */
export function serializeRecalledMemory(r: RecalledMemory): string | null {
  const hasAnything =
    r.profileCount > 0 || r.memoryCount > 0 || r.decisionCount > 0 || r.ruleDocCount > 0
  if (!hasAnything) return null
  try {
    return encodeURIComponent(JSON.stringify(r))
  } catch {
    return null
  }
}
