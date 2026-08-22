// ============================================================================
// rule-operation-conflict.ts — 規程の条文と現場運用のずれ（LLM不要）
//   FAQ が「どちらも登録できる」と書いてある対の実体。同じ論点で値が違うときだけ出す。
// ============================================================================

export interface RuleOperationConflict {
  topic: string
  ruleKey: string
  ruleValue: string
  operationKey: string
  operationValue: string
}

function topicOf(key: string): string {
  return key
    .replace(/の?(規程|条文|就業規則|運用|現場|実運用)/g, '')
    .replace(/[：:\s]/g, '')
    .trim()
}

function isRuleKey(key: string): boolean {
  return /規程|条文|就業規則/.test(key)
}

function isOperationKey(key: string): boolean {
  return /運用|現場/.test(key) && !isRuleKey(key)
}

/**
 * 同じ論点（キーから規程/運用語を除いた残り）で、規程と運用の値が違う組を返す。
 * 1論点1件。値が同じ・片方しか無い場合は出さない。
 */
export function detectRuleOperationConflicts(
  profiles: { key: string; value: string }[],
): RuleOperationConflict[] {
  const rules = profiles.filter(p => isRuleKey(p.key))
  const ops = profiles.filter(p => isOperationKey(p.key))
  const out: RuleOperationConflict[] = []
  const seen = new Set<string>()

  for (const rule of rules) {
    const topic = topicOf(rule.key)
    if (!topic || seen.has(topic)) continue
    const op = ops.find(o => topicOf(o.key) === topic)
    if (!op) continue
    if (op.value.trim() === rule.value.trim()) continue
    seen.add(topic)
    out.push({
      topic,
      ruleKey: rule.key,
      ruleValue: rule.value,
      operationKey: op.key,
      operationValue: op.value,
    })
  }
  return out
}
