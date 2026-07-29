'use client'

import dynamic from 'next/dynamic'
import { EN_INDUSTRIES } from '../_lib/industries.en'

// ============================================================================
// TryDemoEnLazy — same rationale as TryDemoLazy.tsx (JP), for the English demo.
//   Keeps the scripted demo state-machine out of the initial /business/en
//   bundle; ssr:false is fine since it's a non-SEO interactive element below
//   the fold content.
//
//   2026-07-29 CTO修正（UX監査Round6#2の横展開）: JP版(TryDemoLazy.tsx)と同じ
//   CLS起因のクリック無反応リスクをEN版でも解消する（loading fallbackを実体と
//   同じ見出し・業種タブ行・カード外枠の骨格にする）。詳細はTryDemoLazy.tsxの
//   コメント参照。
// ============================================================================

const TryDemoEn = dynamic(() => import('./TryDemoEn'), {
  ssr: false,
  loading: () => (
    <section id="demo" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">Try it</p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          See how Banto answers, with a sample company
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Pick an industry, then click a question to see how Banto answers based on that sample
          company&apos;s premises.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl" aria-hidden>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-neutral-500">Industry</span>
          {EN_INDUSTRIES.map(i => (
            <span
              key={i.key}
              className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs text-neutral-300 motion-safe:animate-pulse"
            >
              {i.label}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-md ring-1 ring-neutral-200/60 motion-safe:animate-pulse">
          <div className="h-[26rem] w-full bg-neutral-50" />
        </div>
      </div>
    </section>
  ),
})

export default function TryDemoEnLazy() {
  return <TryDemoEn />
}
