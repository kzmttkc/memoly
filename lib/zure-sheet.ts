// ============================================================================
// zure-sheet.ts — 就業規則ファイルから「ずれ1枚」を組み立てる（LLM不要）
//   違法断定はしない。書いてある／書いてない／規程と運用の差、だけを出す。
// ============================================================================

import { detectRuleOperationConflicts } from './rule-operation-conflict.ts'

export type ZureKind = 'unread' | 'conflict' | 'rule_only' | 'absent'

export interface ZureRow {
  kind: ZureKind
  topic: string
  detail: string
}

export interface ZureSheet {
  title: string
  rows: ZureRow[]
  disclaimer: string
}

const TOPICS: { id: string; label: string; pattern: RegExp }[] = [
  { id: 'kasuhara', label: 'カスタマーハラスメント', pattern: /カスタマーハラスメント|カスハラ/ },
  { id: 'yukyu', label: '年次有給休暇', pattern: /年次有給|有給休暇|有給/ },
  { id: 'overtime', label: '時間外労働', pattern: /36協定|時間外労働|残業/ },
  { id: 'ikuji', label: '育児・介護', pattern: /育児休業|介護休業|育児・介護/ },
  { id: 'fixed_ot', label: '固定残業代', pattern: /固定残業|みなし残業/ },
  { id: 'disciplinary', label: '懲戒', pattern: /懲戒/ },
  { id: 'trial', label: '試用期間', pattern: /試用期間/ },
]

const DISCLAIMER =
  'この1枚はファイルから読み取れた範囲の整理です。個別の法的助言ではありません。最終の判断は会社と、必要に応じて専門家が行います。'

export function sheetTitle(filename: string): string {
  if (/^pasted(\.txt)?$/i.test(filename)) return '貼った本文のずれ1枚'
  const base = filename.replace(/\.[^.]+$/, '') || filename
  const short = Array.from(base).length > 40 ? `${Array.from(base).slice(0, 40).join('')}…` : base
  return `${short}のずれ1枚`
}

export function zureKindLabel(kind: ZureKind): string {
  switch (kind) {
    case 'unread':
      return '未読'
    case 'conflict':
      return '規程と運用'
    case 'rule_only':
      return '規程にある'
    case 'absent':
      return '触れていない'
  }
}

export function buildZureSheet(input: {
  filename: string
  text: string
  unreadNote: string | null
  profiles?: { key: string; value: string }[]
}): ZureSheet {
  const rows: ZureRow[] = []

  if (input.unreadNote) {
    rows.push({
      kind: 'unread',
      topic: '読めなかった箇所',
      detail: input.unreadNote,
    })
  }

  const conflicts = detectRuleOperationConflicts(input.profiles ?? [])
  for (const c of conflicts) {
    rows.push({
      kind: 'conflict',
      topic: c.topic,
      detail: `規程は「${c.ruleValue}」。運用は「${c.operationValue}」。`,
    })
  }

  const text = input.text
  if (!text.trim()) {
    return {
      title: sheetTitle(input.filename),
      rows,
      disclaimer: DISCLAIMER,
    }
  }

  const absentLabels: string[] = []
  for (const topic of TOPICS) {
    if (conflicts.some(c => c.topic.includes(topic.label) || topic.label.includes(c.topic))) {
      continue
    }
    if (topic.pattern.test(text)) {
      rows.push({
        kind: 'rule_only',
        topic: topic.label,
        detail: '規程には記載があります。運用の書き方は、このファイルからはまだありません。',
      })
    } else {
      absentLabels.push(topic.label)
    }
  }

  if (absentLabels.length > 0) {
    rows.push({
      kind: 'absent',
      topic: 'このファイルでは触れていない論点',
      detail: `${absentLabels.join('、')}は、このファイルからは読み取れませんでした。不足の断定ではありません。`,
    })
  }

  return {
    title: sheetTitle(input.filename),
    rows,
    disclaimer: DISCLAIMER,
  }
}
