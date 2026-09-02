import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { VARIANT_HEADER, type LpVariant, isLpVariant } from '@/app/business/_lib/variant-shared'
import { BRAND_LEGACY_NAME, SUPPORT_EMAIL } from '@/lib/brand'
import { OFFER, daysUntilKill } from '@/lib/offer'
import { LinearNav } from '@/linear-house/components/Nav'
import { ZureDrop } from './_components/ZureDrop'

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}${OFFER.path}`

export const metadata: Metadata = {
  title: '就業規則のファイルを置く｜就業規則AI',
  // 製品定義書 v3 §1・§7.4: 獲得面のメタに旧タグライン「ずれが1枚」を使わない
  description:
    '就業規則のファイルがある場合。カスハラの方針・窓口・手順があるかを1枚にします。登録不要。一般的な情報提供と書類の下書きです。不足の断定ではありません。',
  alternates: { canonical: OFFER.path },
  openGraph: {
    title: '就業規則のファイルを置く｜就業規則AI',
    description: '就業規則のファイルがある場合。カスハラの方針・窓口・手順があるかを1枚にします。不足の断定ではありません。',
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
    <div className="company-light zure-surface min-h-[100dvh]">
      {/* 期限はヒーロー見本メタへ。帯は出さない（data-deadline-bar は lock で非表示） */}
      <p className="sr-only" data-deadline-bar>
        2026年10月1日のカスハラ対策義務化まで {days}日
      </p>
      <LinearNav />
      <main>
        <Suspense fallback={<p className="lh-shell py-16 text-sm text-[var(--lh-muted)]">読み込み中...</p>}>
          <ZureDrop variant={variant} days={days} />
        </Suspense>
      </main>
      <PublicFooter showCrossCta={false} omitServiceHrefs={['/zure']} />
      <p className="mx-auto max-w-2xl px-6 pb-8 text-center text-xs text-[var(--lh-muted)]">
        旧称: {BRAND_LEGACY_NAME} · お問い合わせ{' '}
        <a className="underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  )
}
