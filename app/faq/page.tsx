import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Disclosure } from '@/components/ui/Disclosure'
import { FAQ_CATEGORIES, FAQ_ITEMS, JARGON_TERMS } from '@/lib/faq'

// ============================================================================
// /faq — 独立FAQページ（SSG・クローラブル）。2026-07-22 新設。
//   /business 本文内のFAQ(7問)はLPの一部として抜粋掲載しているのに対し、
//   ここは料金/セキュリティ/製品の仕組み/規程管理/導入の5カテゴリで
//   14問を網羅する独立ページ。FAQPage構造化データを持ち、検索・GEO双方で
//   単体の参照先になれるようにする。
//   Phase1 厳守: 社労士監修/AI社労士/法的精度の断定表現は使わない。個別助言をしない。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/faq`

export const metadata: Metadata = {
  title: 'よくある質問｜番頭(Banto)',
  description:
    '番頭(Banto)の料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。会社の規程を覚える労務AIについて、検討時の疑問に答えます。',
  alternates: { canonical: URL },
  openGraph: {
    title: 'よくある質問｜番頭(Banto)',
    description: '番頭(Banto)の料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '番頭(Banto) よくある質問' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'よくある質問｜番頭(Banto)',
    description: '番頭(Banto)の料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function FaqPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: 'よくある質問', item: URL },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight text-neutral-900">番頭(Banto)</span>
          </Link>
          <Link href="/login?next=/company" className="text-sm text-neutral-500 hover:text-brand-700">
            ログイン
          </Link>
        </div>
      </header>

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-400">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">よくある質問</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">よくある質問</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          番頭(Banto)についてよくある質問
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          料金、セキュリティ、製品の仕組み、規程管理、導入にかかる時間まで、検討時によくいただく質問をまとめました。
          個別の状況に応じた判断が必要な場合は、必要に応じて専門家にご確認ください。
        </p>
      </section>

      {/* ===== カテゴリ別FAQ ===== */}
      {FAQ_CATEGORIES.map((cat) => (
        <section key={cat} className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-700">{cat}</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.filter((f) => f.category === cat).map((f) => (
              <Card key={f.q} padded>
                <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* 2026-07-29 CTO修正（UX監査Round4#9・軽微）: /business トップページの
          FAQプレビューにのみ存在した専門用語補足アコーディオンが、この独立
          /faqページには複製されておらず、検索・GEO経由で直接ここに着地する初心者
          読者（社労士事務所の新人など）が用語補足に出会えなかった（ペルソナ10指摘）。
          文言・トーン（lib/faq.ts の JARGON_TERMS）は/businessと同一・複製配置のみ。 */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Disclosure
          className="group rounded-2xl border border-neutral-200 bg-white"
          summaryClassName="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-5 text-sm font-semibold text-neutral-700"
          summary={
            <>
              はじめて読む方へ — よく出てくる労務用語の補足
              <ChevronDown
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </>
          }
        >
          <dl className="space-y-3 px-5 pb-5">
            {JARGON_TERMS.map((j) => (
              <div key={j.term}>
                <dt className="text-sm font-semibold text-neutral-900">{j.term}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-neutral-600">{j.body}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </section>

      {/* ===== 番頭本体・関連コンテンツへの導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            気になる疑問が解消したら、無料で試せます
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録すれば、自社の規程や過去のやり取りを踏まえて番頭に続けて相談できます。無料で試せます。
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/business" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
              番頭の全体像を見る
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/blog"
            className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            規程管理・組織の記憶ブログを読む
          </Link>
          <Link
            href="/roumu"
            className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            目的別の使い方一覧を見る
          </Link>
        </div>
      </section>

      {/* ===== フッタ ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/business" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <BantoMark className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/business" className="hover:text-brand-700">サービス概要</Link>
              <Link href="/blog" className="hover:text-brand-700">ブログ</Link>
              <Link href="/roumu" className="hover:text-brand-700">使い方一覧</Link>
              <Link href="/contact" className="hover:text-brand-700">お問い合わせ</Link>
              <Link href="/login?next=/company" className="hover:text-brand-700">ログイン</Link>
              <Link href="/terms" className="hover:text-brand-700">利用規約</Link>
              <Link href="/privacy" className="hover:text-brand-700">プライバシー</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">運営：KIZUNA Creation</p>
        </div>
      </footer>
    </div>
  )
}
