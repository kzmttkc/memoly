'use client'

import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { track } from '@/lib/analytics'
import { KABAU_PACK_URL, KABAU_PACK_COPY } from '@/lib/kabau-pack'

// ============================================================================
// KabauPackCta — /roumu/[slug] のカスハラ関連記事の末尾に置く 就業規則AI 実務パック導線
//   (WORK_ORDERS.md Trust Stack v2 #3 就業規則AI側・PDCA H45・2026-08-21)
//
//   - 1記事に1箇所（FAQ の直後＝記事本文の末尾）。出し分けは lib/kabau-pack.ts の
//     isKasuharaUseCase（slug＋h1）。
//   - 文言は 就業規則AI側 site/kasuhara-*-guide.html の .pack-cta 既存文（lib/kabau-pack.ts）。
//     新規コピーは書かない。
//   - セット割引・同梱課金は作らない（外部リンクのみ。決済コードに触れない）。
//   - 計測: 既存の Plausible 計測（lib/analytics track）で
//     kabau_pack_cta_click { source: 'roumu_article', slug }。遷移は計測失敗でも必ず起きる。
//   - client 境界はこのカードだけ。記事本体（SSG・metadata・JSON-LD）は無傷。
// ============================================================================

export default function KabauPackCta({ slug }: { slug: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-4">
      <Card interactive padded={false} className="border-brand-100 bg-brand-50/60">
        <a
          href={KABAU_PACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('kabau_pack_cta_click', { source: 'roumu_article', slug })}
          className="block p-5 sm:p-6"
        >
          <p className="text-sm font-semibold text-neutral-900">{KABAU_PACK_COPY.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{KABAU_PACK_COPY.sub}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
            {KABAU_PACK_COPY.button}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </a>
      </Card>
    </section>
  )
}
