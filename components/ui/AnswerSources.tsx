'use client'

import { ArrowRight, ExternalLink } from 'lucide-react'
import { track } from '@/lib/analytics'

// ============================================================================
// AnswerSources — チャット回答末尾の「参照した法令・指針（一次情報）」と
//   カスハラ文脈の Kabau 実務パック導線を構造化して描画する。
//   (WORK_ORDERS.md Trust Stack v2 #3/#4・2026-08-21)
//
//   入力はサーバ（/api/company/chat → lib/law-citations.ts formatSourcesTrailer）が
//   ストリーム末尾に追記した平文トレーラ。形式は
//     【参照した法令・指針（一次情報）】 / （出典なし） / （未確認）
//     ・{名称} {URL}          ← 1行1項目・URLは行末
//     {注記行}
//     【カスハラ対策の書式】
//     {title} / {sub}
//     ・{button} {URL}
//   履歴（company_messages）にも同じ平文が残るため、再読込後も同じ描画になる。
//   解析に失敗した行は平文のまま出す（黙って消さない）。
//
//   XSS: URL は https:// で始まるものだけをリンクにする（それ以外は平文）。
// ============================================================================

/** 本文とトレーラの切れ目（lib/law-citations.ts SOURCES_TRAILER_MARKER と同一。client から lib を
 *  引くと selectFactsForQuery まで束ねられるため、文字列だけをここに複製する）。 */
export const SOURCES_TRAILER_MARKER = '【参照した法令・指針'
const KABAU_HEADING = '【カスハラ対策の書式】'

export function splitAnswerSources(content: string): { body: string; trailer: string | null } {
  if (!content) return { body: content, trailer: null }
  const idx = content.indexOf(SOURCES_TRAILER_MARKER)
  if (idx < 0) return { body: content, trailer: null }
  // 見出しが行頭にあるときだけトレーラとみなす（本文中の引用を誤切断しない）
  if (idx > 0 && content[idx - 1] !== '\n') return { body: content, trailer: null }
  return { body: content.slice(0, idx).replace(/\s+$/, ''), trailer: content.slice(idx) }
}

type Item = { text: string; url: string | null }
type Section = { heading: string; items: Item[]; notes: string[] }

function parseLine(line: string): Item {
  const m = /^・(.*?)(?:\s+(https:\/\/\S+))?$/.exec(line)
  if (!m) return { text: line, url: null }
  return { text: m[1].trim(), url: m[2] ?? null }
}

export function parseSourcesTrailer(trailer: string): Section[] {
  const sections: Section[] = []
  let cur: Section | null = null
  for (const raw of trailer.split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    if (line.startsWith('【') && line.includes('】')) {
      cur = { heading: line, items: [], notes: [] }
      sections.push(cur)
      continue
    }
    if (!cur) {
      cur = { heading: '', items: [], notes: [] }
      sections.push(cur)
    }
    if (line.startsWith('・')) cur.items.push(parseLine(line))
    else cur.notes.push(line)
  }
  return sections
}

function SourceLink({ item }: { item: Item }) {
  if (!item.url) return <span>{item.text}</span>
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1 text-brand-700 underline underline-offset-2"
    >
      <span>{item.text}</span>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
    </a>
  )
}

export function AnswerSourcesPanel({ trailer }: { trailer: string }) {
  const sections = parseSourcesTrailer(trailer)
  if (!sections.length) return null
  return (
    <div className="mt-2 space-y-2">
      {sections.map((sec, i) => {
        if (sec.heading.startsWith(KABAU_HEADING)) {
          const cta = sec.items.find(it => it.url)
          return (
            <div key={i} className="rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
              {sec.notes.map((n, j) => (
                <p
                  key={j}
                  className={j === 0 ? 'text-xs font-semibold text-neutral-900' : 'mt-0.5 text-xs leading-relaxed text-neutral-600'}
                >
                  {n}
                </p>
              ))}
              {cta && cta.url && (
                <a
                  href={cta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('kabau_pack_cta_click', { source: 'chat_answer' })}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700"
                >
                  {cta.text}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          )
        }
        return (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs text-neutral-700">
            {sec.heading && (
              <p className="font-semibold text-neutral-800">{sec.heading.replace(/^【|】$/g, '')}</p>
            )}
            {sec.items.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {sec.items.map((it, j) => (
                  <li key={j} className="flex gap-1">
                    <span aria-hidden>・</span>
                    <SourceLink item={it} />
                  </li>
                ))}
              </ul>
            )}
            {sec.notes.map((n, j) => (
              <p key={j} className="mt-1 leading-relaxed text-neutral-500">
                {n}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}
