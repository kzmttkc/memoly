// ============================================================================
// answer-citation.ts — 回答末尾の3行出典（自社 / 法令 / 未登録）
//   LLM に「根拠を書いて」と頼むのではなく、注入した行から機械的に組む。
//   一般論と自社決定が混ざらないことが、ChatGPT のメモリ機能との差になる。
// ============================================================================

export interface CompanyCite {
  title: string
  registeredOn?: string
}

export interface LegalCite {
  label: string
  sourceName: string
  effectiveDate: string
}

export interface CitationInput {
  company: CompanyCite | null
  legal: LegalCite | null
  unregistered: string[]
}

export type CitationLocale = 'ja' | 'en'

const EXPECTED_DOCS = ['就業規則', '36協定', '賃金規程']

/** 注入した記憶から、出典3行の材料を組む。 */
export function citationFromContext(args: {
  ruleTitles: string[]
  legal: LegalCite | null
  hasProfiles: boolean
}): CitationInput {
  const company: CompanyCite | null = args.ruleTitles[0]
    ? { title: args.ruleTitles[0] }
    : args.hasProfiles
      ? { title: '自社ルール' }
      : null
  const unregistered = EXPECTED_DOCS.filter(
    t => !args.ruleTitles.some(r => r.includes(t)),
  )
  return {
    company,
    legal: args.legal,
    unregistered: company === null ? unregistered.filter(t => t !== '就業規則') : unregistered,
  }
}

export function formatAnswerCitation(
  input: CitationInput,
  locale: CitationLocale = 'ja',
): string {
  if (locale === 'en') {
    const company = input.company
      ? `Company: ${input.company.title}${input.company.registeredOn ? ` (registered ${input.company.registeredOn})` : ''}`
      : 'Company: this company has no work rules on file'
    const legal = input.legal
      ? `Law: ${input.legal.label} (${input.legal.sourceName} / ${input.legal.effectiveDate})`
      : 'Law: no confirmed fact selected for this question'
    const missing =
      input.unregistered.length > 0 ? `Not on file: ${input.unregistered.join(', ')}` : ''
    return ['[Source]', company, legal, missing].filter(Boolean).join('\n')
  }

  const company = input.company
    ? `自社: ${input.company.title}${input.company.registeredOn ? `（登録 ${input.company.registeredOn}）` : ''}`
    : '自社: この会社の規程は未登録'
  const legal = input.legal
    ? `法令: ${input.legal.label}（${input.legal.sourceName} / ${input.legal.effectiveDate}）`
    : '法令: この質問に当てはまる確定ファクトは未選択'
  const missing =
    input.unregistered.length > 0 ? `未登録: ${input.unregistered.join('、')}` : ''
  return ['【出典】', company, legal, missing].filter(Boolean).join('\n')
}
