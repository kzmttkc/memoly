'use client'

import { useState, type ReactNode } from 'react'
import type { GapSheet } from '@/lib/gap-engine/engine/types'
import {
  blockLine,
  groupByPriority,
  isOpenBlock,
  sheetTitle,
  sortFollowups,
} from '@/lib/gap-engine/ui/renderSheet'
import { DISCLAIMER } from '@/lib/gap-engine/taxonomy/items'
import { daysUntilKill } from '@/lib/offer'

const STATUS_CLASS: Record<string, string> = {
  written: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
  ops_missing: 'bg-[var(--lh-fill)] text-[var(--lh-ink)]',
  unmentioned: 'bg-[var(--lh-fill)] text-[var(--lh-ink)]',
  unread: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
  not_applicable: 'bg-[var(--lh-fill)] text-[var(--lh-muted)]',
}

/** Stripe型: 計測値だけ。飾りグラフ・導入社数なし */
export function GapSheetView({
  sheet,
  days,
  topActions,
  footer,
}: {
  sheet: GapSheet
  days?: number
  /** 結果の上部に置く「次の行動」。2026-09-05 まで導線は y=6,662 の1箇所しか無かった。 */
  topActions?: ReactNode
  footer?: ReactNode
}) {
  const [openOnly, setOpenOnly] = useState(false)
  const d = days ?? daysUntilKill()
  const doc = sheet.document
  const pageCount = doc?.page_count ?? 0
  const pagesRead = doc?.pages_read ?? 0
  const pagesUnread = doc?.pages_unread?.length ?? 0
  const charCount = doc?.char_count ?? 0
  const unmentioned = sheet.summary?.unmentioned_count ?? 0
  const headline = sheet.summary?.headline?.trim() ?? ''
  const followups = sortFollowups(sheet.followups ?? [])
  const groups = groupByPriority(sheet)
  const openCount = sheet.blocks.filter(isOpenBlock).length

  return (
    <section className="outline-none" aria-live="polite" tabIndex={-1}>
      <h2 className="text-lg font-semibold tracking-tight text-[var(--lh-ink)]">{sheetTitle(sheet)}</h2>

      {/* 2026-09-05: headline は34項目すべてに生成されていたのに1件も画面に出ていなかった。
          結論を最初に置く（読む人がスクロールして自分で結論を組み立てなくて済む）。 */}
      {headline && (
        <p className="mt-3 rounded-[var(--lh-radius)] border border-[var(--lh-line)] bg-[var(--lh-fill)] px-4 py-3 text-base leading-relaxed text-[var(--lh-ink)]">
          {headline}
        </p>
      )}

      {/* 2026-09-05: followups も0件表示だった。業種に触れた一文を先頭へ寄せて結論の隣に置く。 */}
      {followups.length > 0 && (
        <div className="mt-4 rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--lh-muted)]">この規則から読み取れたこと</p>
          <ul className="mt-2 space-y-1.5">
            {followups.slice(0, 4).map((f, i) => (
              <li key={i} className="text-sm leading-relaxed text-[var(--lh-ink)]">
                ・{f}
              </li>
            ))}
          </ul>
          {followups.length > 4 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-[var(--lh-muted)] underline underline-offset-2">
                残り{followups.length - 4}件を見る
              </summary>
              <ul className="mt-2 space-y-1.5">
                {followups.slice(4).map((f, i) => (
                  <li key={i} className="text-sm leading-relaxed text-[var(--lh-ink)]">
                    ・{f}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">施行まで</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{d}日</dd>
        </div>
        {/* 2026-09-05: 貼り付け入力ではページ数が構造上0になる。それを「読めたページ 0／未読 0」と
            出していたので、初見は「0ページしか読めなかった」と読む。ページが無い入力では
            読んだ文字数を出す（実際に読めた量を、読める形で言う）。 */}
        {pageCount > 0 ? (
          <>
            <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
              <dt className="text-xs text-[var(--lh-muted)]">読めたページ</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{pagesRead}</dd>
            </div>
            <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
              <dt className="text-xs text-[var(--lh-muted)]">未読</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{pagesUnread}</dd>
            </div>
          </>
        ) : (
          <div className="col-span-1 rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2 sm:col-span-2">
            <dt className="text-xs text-[var(--lh-muted)]">読んだ本文</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">
              {charCount.toLocaleString('ja-JP')}字
            </dd>
          </div>
        )}
        <div className="rounded-[var(--lh-radius)] border border-[var(--lh-line)] px-3 py-2">
          <dt className="text-xs text-[var(--lh-muted)]">触れていない</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--lh-ink)]">{unmentioned}</dd>
        </div>
      </dl>
      {sheet.summary?.unread_note && (
        <p className="mt-3 text-sm text-[var(--lh-muted)]">{sheet.summary.unread_note}</p>
      )}

      {topActions}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--lh-ink)]">
          {sheet.blocks.length}項目のうち、手当てが要るもの {openCount}件
        </p>
        <button
          type="button"
          className="zure-drop-chrome text-xs text-[var(--lh-ink)] underline underline-offset-2"
          aria-pressed={openOnly}
          onClick={() => setOpenOnly(v => !v)}
        >
          {openOnly ? 'すべての項目を出す' : '手当てが要るものだけ出す'}
        </button>
      </div>

      {groups.map(group => {
        const blocks = openOnly ? group.blocks.filter(isOpenBlock) : group.blocks
        if (blocks.length === 0) return null
        return (
          <div key={group.priority} className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--lh-ink)]">
              {group.label}
              <span className="ml-2 text-xs font-normal text-[var(--lh-muted)]">{blocks.length}件</span>
            </h3>
            {group.note && <p className="mt-0.5 text-xs text-[var(--lh-muted)]">{group.note}</p>}
            <ol className="mt-3 divide-y divide-[var(--lh-line)] border-y border-[var(--lh-line)]">
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
                  {/* 2026-09-05: why_it_matters は34項目すべてに生成されていたのに0件表示だった。
                      「なぜ直すのか」は判定そのものより先に知りたい情報なので、原文引用と並べて出す。 */}
                  {block.why_it_matters ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--lh-ink)]">
                      <span className="text-[var(--lh-muted)]">なぜ: </span>
                      {block.why_it_matters}
                    </p>
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
          </div>
        )
      })}

      <p className="mt-4 text-xs leading-relaxed text-[var(--lh-muted)]">{DISCLAIMER}</p>
      {footer}
    </section>
  )
}
