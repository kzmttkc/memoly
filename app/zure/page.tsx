import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { VARIANT_HEADER, type LpVariant, isLpVariant } from '@/app/business/_lib/variant-shared'
import { OFFER } from '@/lib/offer'
import { ZureDrop } from './_components/ZureDrop'

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}${OFFER.path}`

export const metadata: Metadata = {
  title: '就業規則のファイルを置く｜Kabau（カバウ）',
  description:
    '就業規則のPDF・Wordを置くか、本文を貼ると、書いてあることと書いてないことが1枚になります。登録の前に置けます。相談は、そのあとです。',
  alternates: { canonical: OFFER.path },
  openGraph: {
    title: '就業規則のファイルを置く｜Kabau（カバウ）',
    description: 'ファイルを置くと、ずれが1枚になります。登録はそのあとです。',
    url: URL,
    siteName: 'Kabau（カバウ）',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '就業規則のファイルを置く' }],
  },
}

export default async function ZurePage() {
  const h = await headers()
  const hv = h.get(VARIANT_HEADER)
  const variant: LpVariant = isLpVariant(hv) ? hv : 'B'

  return (
    <div className="company-light min-h-[100dvh] bg-white text-neutral-900">
      <PublicHeader showPrimaryCta={false} />
      <main>
        <Suspense fallback={<p className="px-6 py-16 text-sm text-neutral-500">読み込み中...</p>}>
          <ZureDrop variant={variant} />
        </Suspense>
      </main>
      <PublicFooter showCrossCta={false} omitServiceHrefs={['/zure']} />
    </div>
  )
}
