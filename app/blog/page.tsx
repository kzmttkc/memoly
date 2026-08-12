import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BLOG_POSTS } from '@/lib/blog'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// ============================================================================
// /blog — 番頭のブログ一覧（SSG・クローラブル）。2026-07-22 新設。
//   位置づけ: /roumu/* が検索意図LP（短め・キーワード起点）なのに対し、
//   /blog は「組織の記憶・社内規程管理」というテーマを深掘りする読み物。
//   sharoushi-agent.com とのテーマ重複回避・相互リンクは各記事(lib/blog.ts)側で
//   externalLink として1本ずつ持たせている。
//   /roumu ハブと同じライト基調(.company-light)・Phase1 コンプラ・§11 禁止表現ルール。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/blog`

export const metadata: Metadata = {
  title: '規程管理・組織の記憶ブログ｜番頭(Banto)',
  description:
    '社内規程が参照されない理由、改定履歴の管理、規程と現場運用の乖離。会社を覚えるAI「番頭」が向き合う、労務の"記憶"にまつわるテーマを掘り下げるブログです。',
  alternates: { canonical: URL },
  openGraph: {
    title: '規程管理・組織の記憶ブログ｜番頭(Banto)',
    description:
      '社内規程が参照されない理由、改定履歴の管理、規程と現場運用の乖離。組織の"記憶"にまつわるテーマを掘り下げます。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '番頭(Banto) ブログ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '規程管理・組織の記憶ブログ｜番頭(Banto)',
    description: '社内規程が参照されない理由、改定履歴の管理、規程と現場運用の乖離を掘り下げます。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function BlogIndexPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: URL },
    ],
  }

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: '番頭(Banto) 規程管理・組織の記憶ブログ',
    url: URL,
    publisher: { '@type': 'Organization', name: 'KIZUNA Creation' },
    blogPost: BLOG_POSTS.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${URL}/${p.slug}`,
      datePublished: p.publishedAt,
    })),
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">ブログ</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">規程管理・組織の記憶</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          規程管理・組織の記憶ブログ
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          社内規程は整備するだけでは終わりません。参照されているか、改定履歴が残っているか、現場の運用とずれていないか。
          会社を覚えるAI「番頭」が向き合っている、規程と組織の「記憶」にまつわるテーマを掘り下げます。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 中小企業の総務・経営者向け
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 一般的な情報提供・個別助言ではありません
          </span>
        </div>
      </section>

      {/* ===== 一覧 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <ul className="space-y-4">
          {BLOG_POSTS.map((p) => (
            <li key={p.slug}>
              <Card interactive padded={false}>
                <Link href={`/blog/${p.slug}`} className="block p-5 sm:p-6">
                  <p className="text-xs font-medium text-brand-700">{p.category}</p>
                  <p className="mt-1 text-base font-semibold text-neutral-900">{p.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{p.description}</p>
                  <div className="mt-2.5 flex items-center gap-3 text-xs text-neutral-500">
                    <time dateTime={p.publishedAt}>{p.publishedAt}</time>
                    <span>読了目安 {p.readingMinutes}分</span>
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                    続きを読む
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
            規程を、覚えているAIに相談できます
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録すれば、自社の規程や過去の判断を踏まえて番頭に続けて相談できます。無料で試せます。
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/business" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
              番頭の全体像を見る
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      </section>

      <PublicFooter />
    </div>
  )
}
