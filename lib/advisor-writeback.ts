// ============================================================================
// advisor-writeback.ts — 社労士の返事を会社の台帳へ戻す（資格者の判断は「外部確定」）
//   番頭は助言しない。事務所が書いた行として残すだけ。
// ============================================================================

export interface AdvisorWritebackRow {
  summary: string
  memory_type: 'decision'
  topic: '外部確定（社労士）'
  subject: null
  decided_at: string
}

const MIN_CHARS = 8
const MAX_SUMMARY = 1000

export function parseAdvisorWriteback(raw: string): AdvisorWritebackRow | null {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length < MIN_CHARS) return null
  const body = `【外部確定】${text}`.slice(0, MAX_SUMMARY)
  return {
    summary: body,
    memory_type: 'decision',
    topic: '外部確定（社労士）',
    subject: null,
    decided_at: new Date().toISOString(),
  }
}
