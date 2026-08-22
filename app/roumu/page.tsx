import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { USECASE_LIST } from '@/lib/usecase'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /roumu — 検索意図ランディング（/roumu/[slug]）のハブ・キーストーン（SSG・クローラブル）
//   目的（2026-07-14・SEO内部リンク強化）: /roumu/* は18本のLPクラスタだが、
//   束ねるハブ本体が無く（app/roumu/ は [slug] のみ）、sitemap も個別slugだけを
//   列挙してハブを載せていなかった。ハブ不在だとクラスタが「トピック権威」として
//   束ねられず、/business のドメイン権威がスポーク間に薄く循環するだけになる。
//   ここをキーストーンに据え、ItemList/BreadcrumbList JSON-LD で18本を1枚に束ね、
//   /business・各 /roumu/[slug] のパンくず・/tools から相互リンクしてクロール経路を確立する。
//   一覧の中身は SSOT(lib/usecase.ts) から全列挙する（/tools ハブと同型）。
//
//   /roumu/[slug]・/tools と同じライト基調（.company-light + 白背景）。
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言をしない。
//   評価系(aggregateRating/review)は実データ無しのため持たせない（捏造禁止）。
//   §11 禁止表現（——/とても/皆さん/絶対/markdown太字）を含めない。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/roumu`

export const metadata: Metadata = {
  title: '労務AIの目的別の使い方一覧｜番頭(Banto)',
  description:
    '就業規則の運用、労務の引き継ぎ、36協定の上限、有給5日の取得義務、入退社手続き、法改正への対応。中小企業の総務が労務でつまずきやすい論点ごとに、就業規則のファイルからずれを1枚にする番頭がどう役立つかをまとめた一覧です。',
  alternates: { canonical: URL },
  openGraph: {
    title: '労務AIの目的別の使い方一覧｜番頭(Banto)',
    description:
      '中小企業の総務が労務でつまずきやすい論点ごとに、就業規則のファイルからずれを1枚にする番頭がどう役立つかをまとめた一覧です。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '労務AIの目的別の使い方一覧' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '労務AIの目的別の使い方一覧｜番頭(Banto)',
    description:
      '中小企業の総務が労務でつまずきやすい論点ごとに、就業規則のファイルからずれを1枚にする番頭がどう役立つかをまとめた一覧です。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function RoumuIndexPage() {
  // BreadcrumbList（番頭 → 目的別の使い方）
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/zure` },
      { '@type': 'ListItem', position: 2, name: '労務AIの使い方', item: URL },
    ],
  }

  // ItemList（一覧に並ぶ各LPを列挙。順序つき）
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '労務AIの目的別の使い方一覧',
    itemListElement: USECASE_LIST.map((u, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: u.h1,
      url: `${BASE}/roumu/${u.slug}`,
    })),
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* ===== ヘッダ ===== */}
      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">労務AIの使い方</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">目的別の使い方</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          労務AIの目的別の使い方一覧
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          中小企業の総務が労務でつまずきやすい論点を、目的ごとに整理しました。
          就業規則の運用、労務の引き継ぎ、36協定や有給の管理、法改正への対応まで、
          就業規則のファイルからずれを1枚にする番頭が、それぞれどう役立つかを具体例とあわせて読めます。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 気になる論点から読める
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> ファイルを置いて試せる
          </span>
        </div>
      </section>

      {/* ===== 一覧（クローラブルな内部リンク集） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <ul className="space-y-4">
          {USECASE_LIST.map((u) => (
            <li key={u.slug}>
              <Card interactive padded={false}>
                <Link href={`/roumu/${u.slug}`} className="block p-5 sm:p-6">
                  <p className="text-xs font-medium text-brand-700">{u.ogCategory}</p>
                  <p className="mt-1 text-base font-semibold text-neutral-900">{u.h1}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{u.lead}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                    詳しく読む
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== 番頭本体への導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            気になる論点は、就業規則のファイルから
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            登録の前に、PDFまたはWordを置くか、本文を貼れます。ずれの1枚のあとで、相談が開きます。
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/zure" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
              ファイルを置く
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      </section>

      <PublicFooter />
    </div>
  )
}
