import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowUpRight, ClipboardCheck } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SEIDO_POSTS, SEIDO_SLUGS, SEIDO_DISCLAIMER, getSeidoPost } from '@/lib/seido'
import { OFFER } from '@/lib/offer'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// ============================================================================
// /seido/[slug] — 制度対応シリーズの記事詳細（SSG・クローラブル）。2026-08-13 新設。
//   /blog/[slug] と同型（Article JSON-LD ＋ BreadcrumbList を初期HTMLに描画）。
//   シリーズ固有の差分:
//   - 一次資料の出典ブロック（sources・参照日つき）を記事末尾に必ず描画する。
//     制度記事の信頼はここで担保する（訂正型記事の根拠提示）。
//   - 免責文（SEIDO_DISCLAIMER）を全記事に固定描画（税理士法の線引き）。
//   - CTA は utm_source=seido&utm_campaign=<slug> を明示して signup_completed の
//     帰属を作る（90日反証条件の計測。decisions/2026-08.md 2026-08-13）。
//   - チェックリスト（登録特典）への導線カードを本文直後に置く。
// ============================================================================

const BASE = 'https://banto-roumu.com'

export function generateStaticParams() {
  return SEIDO_SLUGS.map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const p = getSeidoPost(slug)
  if (!p) return {}
  const url = `${BASE}/seido/${p.slug}`
  return {
    title: `${p.title}｜就業規則AI`,
    description: p.description,
    alternates: { canonical: url },
    openGraph: {
      title: p.title,
      description: p.description,
      url,
      siteName: '就業規則AI',
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

export default async function SeidoPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = getSeidoPost(slug)
  if (!p) notFound()

  const url = `${BASE}/seido/${p.slug}`
  const others = SEIDO_POSTS.filter((x) => x.slug !== p.slug)
  const signupHref = `/zure?utm_source=seido&utm_campaign=${p.slug}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: p.title,
    description: p.description,
    url,
    datePublished: p.publishedAt,
    dateModified: p.publishedAt,
    inLanguage: 'ja',
    author: { '@type': 'Organization', name: 'KIZUNA Creation' },
    publisher: {
      '@type': 'Organization',
      name: '就業規則AI',
      logo: { '@type': 'ImageObject', url: `${BASE}/icon-512.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: `${BASE}/og-image.png`,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '就業規則AI', item: `${BASE}/zure` },
      { '@type': 'ListItem', position: 2, name: '制度対応', item: `${BASE}/seido` },
      { '@type': 'ListItem', position: 3, name: p.title, item: url },
    ],
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        <Link href="/seido" className="hover:text-brand-700">制度対応</Link>
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
                {sec.table && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-sm">
                      <caption className="sr-only">{sec.table.caption}</caption>
                      <thead>
                        <tr className="border-b border-neutral-300 text-left">
                          {sec.table.headers.map((h) => (
                            <th key={h} scope="col" className="py-2 pr-4 font-semibold text-neutral-900">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.table.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-neutral-200">
                            {row.map((cell, ci) => (
                              <td key={ci} className="py-2 pr-4 leading-relaxed text-neutral-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ===== チェックリスト（登録特典）への導線 ===== */}
        <section className="mx-auto max-w-3xl px-6 py-10">
          <Card interactive padded={false}>
            <Link href="/seido/checklist" className="block p-5 sm:p-6">
              <div className="flex items-start gap-2">
                <ClipboardCheck className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    インボイス2026年10月対応チェックリスト（無料）
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                    この記事の内容を、買手・売手（個人・法人・免税継続）の立場別のチェックリストにまとめました。就業規則AIの無料登録で全項目を読めます。
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                    チェックリストを見る
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
            </Link>
          </Card>
        </section>

        {/* ===== 出典（一次資料・参照日つき） ===== */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-sm font-bold tracking-tight text-neutral-900">出典（一次資料）</h2>
          <ul className="mt-3 space-y-3">
            {p.sources.map((s) => (
              <li key={s.href} className="text-sm leading-relaxed">
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-1 font-medium text-brand-700 hover:underline"
                >
                  {s.label}
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                </a>
                {s.note && <p className="mt-0.5 text-xs text-neutral-500">{s.note}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">
            出典の参照日: {p.sourcesCheckedAt}。制度の内容は改正で変わることがあります。適用にあたっては最新の一次資料をご確認ください。
          </p>
        </section>

        {/* ===== 免責（税理士法の線引き・全記事固定） ===== */}
        <section className="mx-auto max-w-3xl px-6 py-6">
          <p className="rounded-xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-500">
            {SEIDO_DISCLAIMER}
          </p>
        </section>
      </article>

      {/* ===== 末尾CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            就業規則のファイルを置く
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            登録の前に、就業規則のファイルを置けます。ずれの1枚のあとで、相談が開きます。
          </p>
          <div className="mt-6 flex justify-center">
            <TrackedCTA
              location="seido_article_bottom"
              href={signupHref}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              {OFFER.cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
        </Card>
      </section>

      {/* ===== ほかの記事 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-500">制度対応シリーズのほかの記事</p>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/seido/${o.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {o.title}
            </Link>
          ))}
          <Link
            href="/seido"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300"
          >
            制度対応の一覧を見る
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
