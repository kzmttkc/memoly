import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Brain, Check, MessageSquareText } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getUseCase, USECASE_LIST, USECASE_SLUGS } from '@/lib/usecase'

// ============================================================================
// /roumu/[slug] — 検索意図ランディング（SSG・クローラブル）
//   スコープを /roumu/ に切ることで、トップレベルの既存ルート
//   (/business /privacy /terms 等)を奪わない。本文・FAQ・JSON-LD を初期HTMLに
//   描画して CSR空殻にしない。generateStaticParams で全slugを静的生成。
//
//   ルート app/layout.tsx の <body> は消費者Memoly向けにダーク強制
//   (bg-gray-950 text-gray-100)。本LPはBtoB労務向けライト基調が要件のため、
//   最外要素に .company-light（globals.css 定義のライト再マップ + 白背景）を当てる。
//   /business と同じ手法。
//
//   Phase1 厳守: 「社労士監修 / AI社労士 / 法的精度○点」不使用。断定的な個別助言を
//   しない。免責は本文・FAQ に織り込み済み（SSOT: lib/usecase.ts）。
//   aggregateRating（レビュー星）は持たせない（捏造禁止）。
// ============================================================================

const BASE = 'https://banto-roumu.com'

// CTA = 番頭 無料登録（会社登録の入口）。/business と同一導線。
const SIGNUP_HREF = '/login?next=/company'

export function generateStaticParams() {
  return USECASE_SLUGS.map((slug) => ({ slug }))
}

// 未定義slugは404（SSGページのみ許可）
export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const u = getUseCase(slug)
  if (!u) return {}
  const url = `${BASE}/roumu/${u.slug}`
  const title = `${u.titleKeyword}｜番頭(Banto)`
  return {
    title,
    description: u.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: u.description,
      url,
      siteName: '番頭(Banto)',
      locale: 'ja_JP',
      type: 'website',
      images: [
        {
          url: `${BASE}/og-image.png`,
          width: 1200,
          height: 630,
          alt: u.h1,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: u.description,
      images: [`${BASE}/og-image.png`],
    },
  }
}

export default async function RoumuUseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const u = getUseCase(slug)
  if (!u) notFound()

  const url = `${BASE}/roumu/${u.slug}`

  // FAQPage 構造化データ（リッチリザルト適格・本文と一致）
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: u.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  // BreadcrumbList 構造化データ
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: '労務AIの活用', item: `${BASE}/roumu/${u.slug}` },
      { '@type': 'ListItem', position: 3, name: u.ogCategory, item: url },
    ],
  }

  const others = USECASE_LIST.filter((x) => x.slug !== u.slug)

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <Brain className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight text-neutral-900">番頭(Banto)</span>
          </Link>
          <Link href="/login?next=/company" className="text-sm text-neutral-500 hover:text-brand-700">
            ログイン
          </Link>
        </div>
      </header>

      {/* ===== パンくず（視覚） ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-400">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">{u.ogCategory}</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-10">
        <Badge tone="brand" className="mb-5">{u.ogCategory}</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          {u.h1}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">{u.lead}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={SIGNUP_HREF}
            className={buttonClass({ variant: 'primary', size: 'lg' })}
          >
            無料で会社を登録して試す
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/business"
            className={buttonClass({ variant: 'secondary', size: 'lg' })}
          >
            番頭の全体像を見る
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> クレカ不要で試せる
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 企業ごとにデータ分離保管
          </span>
        </div>
      </section>

      {/* ===== 本文セクション群（クローラブル・静的描画） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <div className="space-y-10">
          {u.sections.map((sec) => (
            <div key={sec.heading}>
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">{sec.heading}</h2>
              <div className="mt-3 space-y-3">
                {sec.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-neutral-600">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 番頭がどう答えるか（具体例） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">番頭はこう答えます</h2>
        <p className="mt-2 text-xs text-neutral-500">
          自社の規程を覚えた状態での相談のイメージです。答えは一般的な情報の整理であり、個別の法的助言ではありません。
        </p>
        <ul className="mt-5 space-y-4">
          {u.examples.map((ex) => (
            <li key={ex.ask}>
              <Card padded className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                    <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-sm font-semibold text-neutral-900">{ex.ask}</p>
                </div>
                <div className="flex items-start gap-2 border-t border-neutral-100 pt-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-600 text-white">
                    <Brain className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-sm leading-relaxed text-neutral-600">{ex.answer}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== FAQ（本文＝FAQPage構造化と一致） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12 border-t border-neutral-200">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">よくある質問</h2>
        <div className="mt-5 space-y-4">
          {u.faqs.map((f) => (
            <Card key={f.q} padded>
              <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 末尾CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            自社を覚えるAIを、今日から
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録して、最初の相談を投げてみてください。前提を説明し直さない労務相談を、無料で試せます。
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href={SIGNUP_HREF}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              無料で会社を登録して試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      </section>

      {/* ===== 関連LPへの内部リンク（クラスタ内部リンク） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-400">
          ほかの使い方も見る
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/roumu/${o.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {o.ogCategory}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== フッタ ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/business" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <Brain className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/business" className="hover:text-brand-700">サービス概要</Link>
              <Link href="/login?next=/company" className="hover:text-brand-700">ログイン</Link>
              <Link href="/terms" className="hover:text-brand-700">利用規約</Link>
              <Link href="/privacy" className="hover:text-brand-700">プライバシー</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">運営：Kizuna Creation</p>
        </div>
      </footer>
    </div>
  )
}
