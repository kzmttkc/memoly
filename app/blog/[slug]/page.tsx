import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BLOG_POSTS, BLOG_SLUGS, getBlogPost } from '@/lib/blog'
import { getUseCase } from '@/lib/usecase'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// ============================================================================
// /blog/[slug] — ブログ記事詳細（SSG・クローラブル）。2026-07-22 新設。
//   BlogPosting JSON-LD ＋ BreadcrumbList を初期HTMLに描画（CSR空殻にしない）。
//   /roumu/[slug] と同じライト基調(.company-light)・Phase1 コンプラ・§11 禁止表現ルール。
//   各記事は relatedUsecase(内部) と externalLink(sharoushi-agent.com・外部)を
//   1本ずつ持ち、テーマクラスタとして相互リンクする（lib/blog.ts 参照）。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const SIGNUP_HREF = '/zure'

export function generateStaticParams() {
  return BLOG_SLUGS.map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = getBlogPost(slug)
  if (!p) return {}
  const url = `${BASE}/blog/${p.slug}`
  return {
    title: `${p.title}｜番頭(Banto)`,
    description: p.description,
    alternates: { canonical: url },
    openGraph: {
      title: p.title,
      description: p.description,
      url,
      siteName: '番頭(Banto)',
      locale: 'ja_JP',
      type: 'article',
      publishedTime: p.publishedAt,
      images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: p.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: p.title,
      description: p.description,
      images: [`${BASE}/og-image.png`],
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = getBlogPost(slug)
  if (!p) notFound()

  const url = `${BASE}/blog/${p.slug}`
  const related = getUseCase(p.relatedUsecase.slug)
  const others = BLOG_POSTS.filter((x) => x.slug !== p.slug)

  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.description,
    url,
    datePublished: p.publishedAt,
    dateModified: p.publishedAt,
    inLanguage: 'ja',
    author: { '@type': 'Organization', name: 'KIZUNA Creation' },
    publisher: {
      '@type': 'Organization',
      name: '番頭(Banto)',
      logo: { '@type': 'ImageObject', url: `${BASE}/icon-512.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: `${BASE}/og-image.png`,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/zure` },
      { '@type': 'ListItem', position: 2, name: 'ブログ', item: `${BASE}/blog` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url },
    ],
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <Link href="/blog" className="hover:text-brand-700">ブログ</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">{p.category}</span>
      </nav>

      {/* ===== 記事ヘッダ ===== */}
      <article>
        <header className="mx-auto max-w-3xl px-6 pt-8 pb-8">
          <Badge tone="brand" className="mb-5">{p.category}</Badge>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
            {p.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
            <time dateTime={p.publishedAt}>{p.publishedAt}</time>
            <span>読了目安 {p.readingMinutes}分</span>
          </div>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">{p.lead}</p>
        </header>

        {/* ===== 本文 ===== */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="space-y-10">
            {p.sections.map((sec) => (
              <div key={sec.heading}>
                <h2 className="text-lg font-bold tracking-tight text-neutral-900">{sec.heading}</h2>
                <div className="mt-3 space-y-3">
                  {sec.body.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-neutral-600">{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 番頭がどう役立つか ===== */}
        <section className="mx-auto max-w-3xl px-6 py-10">
          <Card padded className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-600 text-white">
                <BantoMark className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-neutral-900">番頭はこの課題にこう接続します</p>
            </div>
            {p.productTieIn.map((t, i) => (
              <p key={i} className="text-sm leading-relaxed text-neutral-600">{t}</p>
            ))}
          </Card>
        </section>

        {/* ===== 関連LP（/roumu クラスタへの内部リンク） ===== */}
        {related && (
          <section className="mx-auto max-w-3xl px-6 pb-4">
            <Card interactive padded={false}>
              <Link href={`/roumu/${related.slug}`} className="block p-5 sm:p-6">
                <p className="text-xs font-medium text-brand-700">関連する使い方</p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{related.h1}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{related.lead}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                  詳しく読む
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </Card>
          </section>
        )}

        {/* ===== 外部リンク（sharoushi-agent.com・相互リンク） ===== */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <Card interactive padded={false}>
            <a
              href={p.externalLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-5 sm:p-6"
            >
              <p className="text-xs font-medium text-neutral-500">あわせて読みたい（外部）</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{p.externalLink.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                一般的な労務Tipsやセルフ点検ツールは、sharoushi-agent.com にまとまっています。
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                外部サイトで読む
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </a>
          </Card>
        </section>

        {/* ===== 問いかけ（closing） ===== */}
        <section className="mx-auto max-w-3xl px-6 py-6">
          <p className="text-sm leading-relaxed text-neutral-500">{p.closingQuestion}</p>
        </section>
      </article>

      {/* ===== 末尾CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            就業規則のファイルを置く
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            就業規則のファイルを置くと、ずれが1枚になります。登録はそのあとです。
          </p>
          <div className="mt-6 flex justify-center">
            {/* 2026-08-10 計測是正: 素の<Link>でsignup_cta_clickedが未計測だった
                （/roumu/[slug] と同じ欠落。/business の TrackedCTA に揃える）。 */}
            <TrackedCTA
              location="blog_article_bottom"
              href={SIGNUP_HREF}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              ファイルを置く
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
        </Card>
      </section>

      {/* ===== ほかの記事 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-500">ほかの記事も読む</p>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/blog/${o.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {o.title}
            </Link>
          ))}
          <Link
            href="/blog"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300"
          >
            ブログ一覧を見る
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
