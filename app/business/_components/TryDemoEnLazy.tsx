'use client'

import dynamic from 'next/dynamic'

// ============================================================================
// TryDemoEnLazy — same rationale as TryDemoLazy.tsx (JP), for the English demo.
//   Keeps the scripted demo state-machine out of the initial /business/en
//   bundle; ssr:false is fine since it's a non-SEO interactive element below
//   the fold content.
// ============================================================================

const TryDemoEn = dynamic(() => import('./TryDemoEn'), {
  ssr: false,
  loading: () => (
    <section id="demo" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-16">
      <div
        aria-hidden
        className="h-[26rem] w-full rounded-2xl border border-neutral-200 bg-neutral-50 motion-safe:animate-pulse"
      />
    </section>
  ),
})

export default function TryDemoEnLazy() {
  return <TryDemoEn />
}
