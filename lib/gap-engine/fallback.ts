// ============================================================================
// Claude 障害時の決定的フォールバック。引用が取れない「ある」は出さない。
// ============================================================================

import { TAXONOMY, DISCLAIMER } from './taxonomy/items'
import type { AnalyzeInput, GapBlock, GapSheet } from './engine/types'
import { enforceTaxonomy } from './engine/validateSheet'

function snippetAround(text: string, term: string): string | null {
  const i = text.indexOf(term)
  if (i < 0) return null
  const start = Math.max(0, i - 4)
  const end = Math.min(text.length, i + term.length + 24)
  const raw = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return raw.length >= 4 ? raw.slice(0, 80) : null
}

/** lookFor 語が本文にあるときだけ written（引用付き）。無ければ unmentioned。 */
export function heuristicGapSheet(input: AnalyzeInput): GapSheet {
  const text = input.text ?? ''
  const blocks: GapBlock[] = TAXONOMY.map(item => {
    const terms = item.lookFor.split(/[、,]/).map(t => t.trim()).filter(t => t.length >= 2)
    let quote: string | null = null
    for (const term of terms) {
      quote = snippetAround(text, term)
      if (quote) break
    }
    if (quote) {
      return {
        id: item.id,
        group: item.group,
        title: item.title,
        status: 'written' as const,
        priority: item.priority,
        deadline: item.deadline,
        what_found: 'このファイルに、関連する記載があります。',
        what_not_found: '',
        why_it_matters: '',
        next_step: '運用の書き方（窓口・周知・期限）が同じファイルにあるか確認する。',
        citations: [{ quote }],
      }
    }
    return {
      id: item.id,
      group: item.group,
      title: item.title,
      status: 'unmentioned' as const,
      priority: item.priority,
      deadline: item.deadline,
      what_found: '',
      what_not_found: 'このファイルからは読み取れませんでした。不足の断定ではありません。',
      why_it_matters: '',
      next_step: '専門家に、この項目を現行ファイルで確認する。',
      citations: [],
    }
  })

  return enforceTaxonomy(
    {
      schema_version: '2026-08-29.1',
      disclaimer: DISCLAIMER,
      document: {
        title_guess: input.titleGuess ?? '',
        page_count: input.pageCount ?? 0,
        pages_read: Math.max(0, (input.pageCount ?? 0) - (input.pagesUnread?.length ?? 0)),
        pages_unread: input.pagesUnread ?? [],
        char_count: text.length,
        extracted_ok: text.trim().length >= 80,
      },
      summary: {
        headline: 'このファイルから読み取れたこと（簡易）',
        written_count: 0,
        ops_missing_count: 0,
        unmentioned_count: 0,
        unread_note: null,
      },
      blocks,
      contradictions: [],
      followups: [],
    },
    text,
  )
}
