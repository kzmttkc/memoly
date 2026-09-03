'use client'

import type { ReactNode } from 'react'
import type { GapSheet } from '@/lib/gap-engine/engine/types'
import { sortBlocks, blockLine } from '@/lib/gap-engine/ui/renderSheet'
import { DISCLAIMER } from '@/lib/gap-engine/taxonomy/items'
import { daysUntilKill } from '@/lib/offer'

const STATUS_CLASS: Record<string, string> = {
  written: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
  ops_missing: 'bg-[var(--lh-fill)] text-[var(--lh-ink)]',
  unmentioned: 'bg-[var(--lh-fill)] text-[var(--lh-ink)]',
  unread: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
  not_applicable: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
}

function sheetTitle(sheet: GapSheet): string {
  const guess = sheet.document?.title_guess?.trim()
  if (guess) return `${guess.replace(/\.[^.]+$/, '')}のずれ1枚`
  return sheet.summary?.headline || 'ずれ1枚'
}

/** Stripe型: 計測値だけ。飾りグラフ・導入社数なし */
export function GapSheetView({
  sheet,
  days,
  footer,
}: {
  sheet: GapSheet
  days?: number
  footer?: ReactNode
}) {
  const d = days ?? daysUntilKill()
  const pagesRead = sheet.document?.pages_read ?? 0
  const pagesUnread = sheet.document?.pages_unread?.length ?? 0
  const unmentioned = sheet.summary?.unmentioned_count ?? 0
  const blocks = sortBlocks(sheet)

  return (
    <section className="outline-none" aria-live="polite" tabIndex={-1}>
      <h2 className="text-lg font-semibold tracking-tight text-[var(--lh-ink)]">{sheetTitle(sheet)}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">施行まで</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{d}日</dd>
        </div>
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">読めたページ</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{pagesRead}</dd>
        </div>
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">未読</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{pagesUnread}</dd>
        </div>
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">触れていない</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{unmentioned}</dd>
        </div>
      </dl>
      {sheet.summary?.unread_note && (
        <p className="mt-3 text-sm text-[var(--lh-muted)]">{sheet.summary.unread_note}</p>
      )}
      <ol className="mt-6 divide-y divide-[var(--lh-line)] border-y border-[var(--lh-line)]">
        {blocks.map(block => (
          <li key={block.id} className="py-3">
            <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-[var(--lh-ink)]">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[block.status] ?? STATUS_CLASS.unmentioned}`}
              >
                {blockLine(block.status, '').trim() || block.status}
              </span>
              {block.title}
              {block.deadline && (
                <span className="text-xs font-normal text-[var(--lh-muted)]">期限 {block.deadline}</span>
              )}
            </p>
            {block.what_found ? (
              <p className="mt-1 text-sm leading-relaxed text-[var(--lh-muted)]">{block.what_found}</p>
            ) : null}
            {block.what_not_found ? (
              <p className="mt-1 text-sm leading-relaxed text-[var(--lh-muted)]">{block.what_not_found}</p>
            ) : null}
            {block.next_step ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--lh-muted)]">次: {block.next_step}</p>
            ) : null}
            {/* 2026-09-04（執行部 9/1 発注）: 判定の根拠になった原文を出す。精度100%は望めないので、
                読んだ人が自分の条文と突き合わせて正誤を確かめられるようにする。無いときは出さない。 */}
            {block.citations?.filter(c => c?.quote?.trim()).slice(0, 2).map((c, i) => (
              <blockquote
                key={i}
                className="mt-1 border-l-2 border-[var(--lh-line)] pl-3 text-xs leading-relaxed text-[var(--lh-muted)]"
              >
                原文: 「{c.quote.trim()}」
                {c.approx_locus ? <span className="ml-1">（{c.approx_locus}）</span> : null}
              </blockquote>
            ))}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-[var(--lh-muted)]">{DISCLAIMER}</p>
      {footer}
    </section>
  )
}
