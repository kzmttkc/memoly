import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Disclosure } from '@/components/ui/Disclosure'
import { FAQ_CATEGORIES, FAQ_ITEMS, JARGON_TERMS } from '@/lib/faq'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import BackToTop from '@/components/ui/BackToTop'

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
  title: 'よくある質問｜就業規則AI',
  description:
    '就業規則AIの料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。就業規則のファイルからずれを1枚にする流れについて、検討時の疑問に答えます。',
  alternates: { canonical: URL },
  openGraph: {
    title: 'よくある質問｜就業規則AI',
    description: '就業規則AIの料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。',
    url: URL,
    siteName: '就業規則AI',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '就業規則AI よくある質問' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'よくある質問｜就業規則AI',
    description: '就業規則AIの料金・セキュリティ・製品の仕組み・規程管理・導入に関するよくある質問をまとめました。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function FaqPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '就業規則AI', item: `${BASE}/zure` },
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

      {/* ===== ヘッダ（2026-08-11 UI監査: 独自ヘッダ（ログインのみ・CTA/料金導線なし）を
          /tools /roumu と同じ PublicHeader へ統一。検索・GEO経由の初見客がこのページに
          直接着地しても、料金と無料登録にヘッダから到達できるようにする） ===== */}
      {/* 2026-08-12 UXペルソナ監査 R-13: /faq は 375px で 6,056px あるのに
          「先頭へ戻る」が /business にしか付いていなかった（検索着地の主戦場はこちら）。 */}
      <BackToTop />
      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">よくある質問</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">よくある質問</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          就業規則AIについてよくある質問
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          料金、セキュリティ、製品の仕組み、規程管理、導入にかかる時間まで、検討時によくいただく質問をまとめました。
          個別の状況に応じた判断が必要な場合は、必要に応じて専門家にご確認ください。
        </p>

        {/* 2026-08-12 UXペルソナ監査 R-12: 375px で 6,056px あるのに現在地も残量も
            分からず、「今どこを読んでいるか」を見失った読者が閉じていた。
            カテゴリ数は5つと少ないので、目次はアンカーの並びだけで足りる。 */}
        <nav aria-label="このページの目次" className="mt-6 flex flex-wrap gap-2">
          {FAQ_CATEGORIES.map((cat, i) => (
            <a
              key={cat}
              href={`#faq-${i}`}
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-4 text-xs text-neutral-700 transition-colors hover:border-brand-300 hover:text-brand-700 sm:min-h-0 sm:py-2"
            >
              {cat}
            </a>
          ))}
        </nav>
      </section>

      {/* ===== カテゴリ別FAQ ===== */}
      {FAQ_CATEGORIES.map((cat, i) => (
        <section key={cat} id={`faq-${i}`} className="mx-auto max-w-3xl px-6 pb-4 scroll-mt-20">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-700">{cat}</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.filter((f) => f.category === cat).map((f) => (
              <Card key={f.q} padded>
                {/* 2026-08-11 UI監査: 質問見出しは /pricing /roumu のFAQと同じ text-base に統一
                    （このページだけ text-sm で本文と同サイズ＝階層が消えていた）。 */}
                <h3 className="text-base font-semibold text-neutral-900">{f.q}</h3>
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
                className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
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

      {/* ===== 就業規則AI本体・関連コンテンツへの導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            疑問が解けたら、就業規則のファイルを置く
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            登録の前に置けます。ずれの1枚のあとで、相談が開きます。
          </p>
          {/* 2026-08-12 UXペルソナ監査 R-5（離脱級）: 「無料で試せます」という見出しの
              直下に置かれていた3つのボタンが /business・/blog・/roumu の回遊リンクだけで、
              このページ本文に /signup が1本も無かった（本文リンク17本中0本）。
              検索から /faq に直接着地した検討者は、疑問が解けた瞬間に次の行動を
              取れずページ内を回遊させられていた。主ボタンを登録に差し替え、
              /business は副次リンクへ降格する（見出し・説明文は変更しない）。 */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <TrackedCTA
              location="faq_footer"
              href="/zure"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              ファイルを置く
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
            <Link
              href="/business"
              className="inline-flex min-h-11 items-center text-sm text-brand-100 underline underline-offset-4 hover:text-white"
            >
              先に就業規則AIの全体像を見る
            </Link>
          </div>
        </Card>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 sm:min-h-0 sm:py-2"
          >
            規程管理・組織の記憶ブログを読む
          </Link>
          <Link
            href="/roumu"
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 sm:min-h-0 sm:py-2"
          >
            目的別の使い方一覧を見る
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
