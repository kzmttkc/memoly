'use client'

import { useState } from 'react'
import { MessageSquareText, Check, X } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// CompareToggleEn — English counterpart of CompareToggle.tsx for /business/en
//   (2026-07-29 CTO, L3 audit #1). Same mechanism and same underlying facts
//   (both answers reproduce the JP version's content in English) — a generic
//   AI asks clarifying questions first; Kabau answers directly because it
//   remembers the company's 36 Agreement status. No new claims are made.
// ============================================================================

const QUESTION = "Can we have staff work overtime next week?"

type Side = 'generic' | 'banto'

export default function CompareToggleEn() {
  const [side, setSide] = useState<Side>('generic')

  const select = (next: Side) => {
    if (next === side) return
    setSide(next)
    track('demo_question_clicked', { source: 'compare_en', industry: 'seizo' })
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        role="tablist"
        aria-label="Compare answers to the same question"
        className="mx-auto mb-4 flex w-fit rounded-full border border-neutral-500 bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={side === 'generic'}
          onClick={() => select('generic')}
          className={
            side === 'generic'
              ? 'flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-semibold text-white'
              : 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:text-neutral-800'
          }
        >
          <MessageSquareText className="h-4 w-4" aria-hidden />
          Ask a generic AI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'banto'}
          onClick={() => select('banto')}
          className={
            side === 'banto'
              ? 'flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white'
              : 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:text-brand-700'
          }
        >
          <BantoMark className="h-4 w-4" aria-hidden />
          Ask Kabau
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="space-y-3 px-4 py-4">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
              {QUESTION}
            </p>
          </div>

          <div className={side === 'generic' ? 'flex items-start gap-2' : 'hidden'}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-600">
              It depends on your company&apos;s situation. To judge this, could you tell me: (1) your
              industry and headcount, (2) your standard hours and days off, (3) whether you have a
              filed 36 Agreement, and (4) if so, its overtime cap. With those, I can look into it.
            </div>
          </div>

          <div className={side === 'banto' ? 'flex items-start gap-2' : 'hidden'}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
              Your company <span className="font-semibold text-neutral-900">has not filed a 36 Agreement</span>,
              so having staff work overtime as things stand could violate the Labor Standards Act. The
              first step is electing a majority representative and filing the agreement. Want the
              steps? <span className="text-neutral-500">(General information.)</span>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-2.5">
          <p className={side === 'generic' ? 'flex items-center gap-1.5 text-xs text-neutral-600' : 'hidden'}>
            <X className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />
            Before you get an answer, you go through this back-and-forth every time.
          </p>
          <p className={side === 'banto' ? 'flex items-center gap-1.5 text-xs text-neutral-600' : 'hidden'}>
            <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
            The one-page sheet from your file is already there, so the first message answers from your company&apos;s situation.
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-neutral-600">
        Both sides are example answers. Kabau&apos;s answer is general information, not individualized legal advice.
      </p>
    </div>
  )
}
