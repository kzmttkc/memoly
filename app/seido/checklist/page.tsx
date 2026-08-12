import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardCheck, Lock } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SEIDO_CHECKLIST, SEIDO_CHECKLIST_ITEM_COUNT, SEIDO_DISCLAIMER } from '@/lib/seido'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido/checklist — 無料チェックリストのLP（公開・SSG）。2026-08-13 新設。
//   番頭無料登録の特典（引き継ぎ書 設計骨子2）。このページは中身の見出しと
//   項目数だけを見せ、全文は /seido/checklist/zenbun（要ログイン）で読ませる。
//   登録ゲートの計測: CTA → /signup?next=/seido/checklist/zenbun&
//   utm_source=seido&utm_campaign=checklist → signup_completed(props.source=seido)。
//   静的ページを保つため、ログイン状態のサーバー判定はしない（登録済みの人には
//   zenbun への直接リンクを併記。未ログインなら zenbun 側が signup へ流し返す）。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/seido/checklist`
const SIGNUP_HREF = '/signup?next=/seido/checklist/zenbun&utm_source=seido&utm_campaign=checklist'

export const metadata: Metadata = {
  title: 'インボイス2026年10月対応チェックリスト（無料）｜番頭(Banto)',
  description:
    '2026年10月のインボイス経過措置縮小（80%から70%へ）と2割特例終了に向けて、買手・売手の立場別に確認することをまとめた無料チェックリストです。番頭の無料登録で全項目を読めます。',
  alternates: { canonical: URL },
  openGraph: {
    title: 'インボイス2026年10月対応チェックリスト（無料）｜番頭(Banto)',
    description:
      '2026年10月のインボイス改正に向けて、買手・売手の立場別に確認することをまとめた無料チェックリストです。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: 'インボイス2026年10月対応チェックリスト' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'インボイス2026年10月対応チェックリスト（無料）｜番頭(Banto)',
    description:
      '2026年10月のインボイス改正に向けて、買手・売手の立場別に確認することをまとめた無料チェックリストです。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function SeidoChecklistPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: '制度対応', item: `${BASE}/seido` },
      { '@type': 'ListItem', position: 3, name: 'インボイス2026年10月対応チェックリスト', item: URL },
    ],
  }

  // 冒頭グループの先頭2項目だけを公開プレビューとして見せる（全文は登録特典）
  const previewGroup = SEIDO_CHECKLIST[0]
  const previewItems = previewGroup.items.slice(0, 2)

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <Link href="/seido" className="hover:text-brand-700">制度対応</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">チェックリスト</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">無料チェックリスト</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          インボイス2026年10月対応チェックリスト
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          2026年10月1日の経過措置縮小（80%から70%へ）と2割特例の終了に向けて、期日までに確認することを立場別にまとめました。
          全{SEIDO_CHECKLIST_ITEM_COUNT}項目、すべて国税庁・財務省・公正取引委員会の一次資料の範囲で作っています。
          番頭に無料で会社を登録すると、全項目を読めます。
        </p>
      </section>

      {/* ===== 中身の構成（見出しと項目数のみ公開） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">チェックリストの構成</h2>
        <ul className="mt-4 space-y-3">
          {SEIDO_CHECKLIST.map((g) => (
            <li key={g.heading}>
              <Card padded className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-900">{g.heading}</p>
                  <span className="flex-none text-xs text-neutral-500">{g.items.length}項目</span>
                </div>
                <p className="text-xs leading-relaxed text-neutral-500">対象: {g.who}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== プレビュー（先頭2項目） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">項目の例</h2>
        <ul className="mt-4 space-y-3">
          {previewItems.map((item) => (
            <li key={item.text} className="flex items-start gap-2.5">
              <ClipboardCheck className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden />
              <div>
                <p className="text-sm leading-relaxed text-neutral-900">{item.text}</p>
                {item.note && <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{item.note}</p>}
              </div>
            </li>
          ))}
          <li className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 flex-none text-neutral-400" aria-hidden />
            <p className="text-sm leading-relaxed text-neutral-500">
              残り{SEIDO_CHECKLIST_ITEM_COUNT - previewItems.length}項目は、無料登録後に全文を読めます。
            </p>
          </li>
        </ul>
      </section>

      {/* ===== 登録CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            無料登録して、全{SEIDO_CHECKLIST_ITEM_COUNT}項目を読む
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            番頭は、自社の規程や決めごとを覚えて労務の相談に乗るAIです。登録は無料で、チェックリストの全文が読めるようになります。
          </p>
          <div className="mt-6 flex justify-center">
            <TrackedCTA
              location="seido_checklist_gate"
              href={SIGNUP_HREF}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              無料で登録して全文を読む
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
          <p className="mt-4 text-xs text-brand-100">
            登録済みの方は
            <Link href="/login?next=/seido/checklist/zenbun" className="underline hover:text-white">ログインして全文を開けます</Link>
          </p>
        </Card>
      </section>

      {/* ===== 免責 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="rounded-xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-500">
          {SEIDO_DISCLAIMER}
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}
