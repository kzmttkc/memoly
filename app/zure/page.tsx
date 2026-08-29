import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { VARIANT_HEADER, type LpVariant, isLpVariant } from '@/app/business/_lib/variant-shared'
import { BRAND_LEGACY_NAME, SUPPORT_EMAIL } from '@/lib/brand'
import { OFFER, daysUntilKill } from '@/lib/offer'
import { ZureDrop } from './_components/ZureDrop'

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}${OFFER.path}`

export const metadata: Metadata = {
  title: '就業規則のファイルを置く｜就業規則AI',
  description:
    'ファイルを置くと、ずれが1枚になります。2026年10月1日のカスハラ対策義務化に向け、登録の前にPDF・Word・テキストを置けます。',
  alternates: { canonical: OFFER.path },
  openGraph: {
    title: 'ファイルを置くと、ずれが1枚になる。｜就業規則AI',
    description: '登録不要。書いてあること／書いてないこと／運用不足が1枚になります。不足の断定ではありません。',
    url: URL,
    siteName: '就業規則AI',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '就業規則のファイルを置く' }],
  },
}

export default async function ZurePage() {
  const h = await headers()
  const hv = h.get(VARIANT_HEADER)
  const variant: LpVariant = isLpVariant(hv) ? hv : 'B'
  const days = daysUntilKill()

  return (
    <div className="company-light zure-surface min-h-[100dvh] text-[var(--zure-ink)]">
      <p className="zure-deadline-band">
        2026年10月1日のカスハラ対策義務化まで <strong>{days}</strong>日 · まず自社のファイルを置く
      </p>
      <PublicHeader showPrimaryCta={false} />
      <main>
        <Suspense fallback={<p className="px-6 py-16 text-sm text-[var(--zure-ink-soft)]">読み込み中...</p>}>
          <ZureDrop variant={variant} />
        </Suspense>
      </main>
      <PublicFooter showCrossCta={false} omitServiceHrefs={['/zure']} />
      <p className="zure-drop-chrome mx-auto max-w-2xl px-6 pb-8 text-center text-xs text-[var(--zure-ink-soft)]">
        旧称: {BRAND_LEGACY_NAME} · お問い合わせ{' '}
        <a className="underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  )
}
