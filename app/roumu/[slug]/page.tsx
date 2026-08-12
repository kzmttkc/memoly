import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, MessageSquareText } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { getUseCase, USECASE_LIST, USECASE_SLUGS } from '@/lib/usecase'
import LeadCapture from '@/app/business/_components/LeadCapture'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import KasuharaSelfCheck from './_components/KasuharaSelfCheck'
import { PublicFooter } from '@/components/ui/PublicFooter'

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
//   新規訪問者（SEO記事経由）は signup へ直行させる。login 着地だと「新規登録」の
//   小リンクを自力で見つける必要があり、北極星（無料登録）直前の蛇口が細くなる。
const SIGNUP_HREF = '/signup?next=/company'

// 末尾CTAのサブコピー3種。掲載順の輪番で決定的に選ぶ（ビルドごとに揺れない）。
//   核の主張「覚えているから前提の説明が要らない」を、同一文の反復にならないよう言い換える。
const CTA_SUBCOPY = [
  '会社を登録して、最初の相談を投げてみてください。前提を説明し直さない労務相談を、無料で試せます。',
  '会社を登録して、最初の相談を投げてみてください。二度目からは、話が早い。その体験を無料で試せます。',
  '会社を登録して、最初の相談を投げてみてください。昨日の相談の続きから話せる労務AIを、無料で試せます。',
]

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

  // signup CTA の遷移先。LPごとに計測用UTMを持つ場合は ?next=/company に & で連結する
  // （底面ファネル語の流入をチャネル別にCVR分離計測するため）。既定は無UTMのまま。
  const signupHref = u.signupUtm ? `${SIGNUP_HREF}&${u.signupUtm}` : SIGNUP_HREF

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
      { '@type': 'ListItem', position: 2, name: '労務AIの使い方', item: `${BASE}/roumu` },
      { '@type': 'ListItem', position: 3, name: u.ogCategory, item: url },
    ],
  }

  // Article 構造化データ（GEO/AEO：更新日明示）。updatedAt を持つ一次情報LPにだけ出す。
  const articleJsonLd = u.updatedAt
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: u.h1,
        description: u.description,
        inLanguage: 'ja-JP',
        mainEntityOfPage: url,
        datePublished: u.publishedAt || u.updatedAt,
        dateModified: u.updatedAt,
        author: { '@type': 'Organization', name: 'KIZUNA Creation' },
        publisher: {
          '@type': 'Organization',
          name: '番頭(Banto)',
          logo: { '@type': 'ImageObject', url: `${BASE}/og-image.png` },
        },
      }
    : null

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
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      )}

      {/* ===== ヘッダ（2026-07-30 UX監査 #6: 料金・無料登録を常設した共通ヘッダへ） ===== */}
      <PublicHeader />

      {/* ===== パンくず（視覚） ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <Link href="/roumu" className="hover:text-brand-700">労務AIの使い方</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">{u.ogCategory}</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-10">
        <Badge tone="brand" className="mb-5">{u.ogCategory}</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          {u.h1}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-700">{u.lead}</p>
        {u.updatedAt && (
          <p className="mt-3 text-xs text-neutral-500">更新日：{u.updatedAt}</p>
        )}
        {/* ===== 登録不要の軽量導線（2026-08-03・直帰98%対策・重いCTAより上に配置） =====
            対象は kasuhara-gimuka-2026 のみ。他LPの構造は変えない。 */}
        {u.slug === 'kasuhara-gimuka-2026' && <KasuharaSelfCheck />}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {/* 2026-08-10 計測是正: 従来は素の<Link>でsignup_cta_clickedが未計測だった
              （/roumu は本サイト最大の流入面なのに、この記事CTAだけ「クリックされずに
              signupへ着地した」形になり、signup_cta_clicked=0 と signup_started>0の
              矛盾の主因だった）。/business と同じ TrackedCTA に揃える（href/見た目は不変）。 */}
          <TrackedCTA
            location="roumu_article_top"
            href={signupHref}
            className={buttonClass({ variant: 'primary', size: 'lg' })}
          >
            無料で会社を登録して試す
            <ArrowRight className="h-4 w-4" aria-hidden />
          </TrackedCTA>
          <Link
            href="/business"
            className={buttonClass({ variant: 'secondary', size: 'lg' })}
          >
            番頭の全体像を見る
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> クレジットカード不要で試せる
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 企業ごとにデータ分離保管
          </span>
        </div>
      </section>

      {/* ===== 本文セクション群（クローラブル・静的描画） =====
          2026-07-24 P09: 本文の可読性底上げは .article-prose（globals.css）で一括。
          本文 <p> は16px・行間広め・neutral-700（AAA）へ。個別上書きは付けない。 */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <div className="article-prose space-y-10">
          {u.sections.map((sec) => (
            <div key={sec.heading}>
              {/* 2026-08-11 UI監査#8: 本文が16px(.article-prose)に対しh2が18pxで2px差しか
                  なく階層が読めなかった。text-xl(20px)へ（下位のh2も同時に統一）。 */}
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">{sec.heading}</h2>
              <div className="mt-3 space-y-3">
                {sec.body.map((p, i) => (
                  <p key={i} className="leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 関連の無料ツールへの内部リンク（記事→ツール送客・relatedToolを持つslugのみ） ===== */}
      {u.relatedTool && (
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <Card interactive padded={false}>
            <Link href={u.relatedTool.href} className="block p-5 sm:p-6">
              <p className="text-xs font-medium text-brand-700">無料ツール</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {u.relatedTool.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                この記事の内容を、自社の数字を入れて画面で確認できます。登録不要・会社データは保存しません。
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                無料で点検する
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </Card>
        </section>
      )}

      {/* ===== sharoushi-agent.com の同一テーマ記事への外部リンク
          （Focus2製品間のトピッククラスタ権威補強・relatedArticleを持つslugのみ・2026-07-25） ===== */}
      {u.relatedArticle && (
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <Card interactive padded={false}>
            <Link
              href={u.relatedArticle.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-5 sm:p-6"
            >
              <p className="text-xs font-medium text-brand-700">あわせて読みたい解説記事</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {u.relatedArticle.label}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                sharoushi-agent.com で読む
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </Card>
        </section>
      )}

      {/* ===== 番頭がどう答えるか（具体例） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">番頭はこう答えます</h2>
        <p className="mt-2 text-xs text-neutral-500">
          サンプルの会社情報を覚えた状態での、回答のイメージです。数値や規程の内容は説明用の例です。
          番頭の答えは一般的な情報の整理であり、個別の法的助言ではありません。
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
                    <BantoMark className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-base leading-relaxed text-neutral-700">{ex.answer}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== FAQ（本文＝FAQPage構造化と一致） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12 border-t border-neutral-200">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">よくある質問</h2>
        <div className="mt-5 space-y-4">
          {u.faqs.map((f) => (
            <Card key={f.q} padded>
              <h3 className="text-base font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-2 text-base leading-relaxed text-neutral-700">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 末尾CTA =====
          サブコピーは3バリアントを掲載順の輪番で決定的に選ぶ（全LP同一文の反復を避ける。
          「前提を説明し直さない」の言い換え＝二度目からは話が早い/昨日の続き）。 */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            自社を覚えるAIを、今日から
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            {CTA_SUBCOPY[
              // 掲載順の輪番（i % 3）。ハッシュ配分だと直近5本中3本が同一締めに
              // 寄ったため、リスト順の交互割当で連続同一を構造的に防ぐ。
              Math.max(USECASE_SLUGS.indexOf(u.slug), 0) % CTA_SUBCOPY.length
            ]}
          </p>
          <div className="mt-6 flex justify-center">
            {/* 2026-08-10 計測是正: 記事末尾CTAも同様に未計測だった（上記コメント参照）。 */}
            <TrackedCTA
              location="roumu_article_bottom"
              href={signupHref}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              無料で会社を登録して試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
        </Card>
      </section>

      {/* ===== メール獲得（無料PDF・2026-07-30 PMF修理#2） =====
          実測: sitemap の51URLのうち索引される42ページ（/roumu 33本を含む）に
          input[type=email] が1つも無く、メール獲得は /business の1か所だけだった。
          記事を最後まで読んだ人は、いま最も渡しやすい相手。登録という重い一歩の前に
          「メアドだけ」の軽い一歩を、読み終わりの位置に置く。
          既存の signup CTA（直上）は主導線として不変で、これはその下の受け皿。
          送信先・PDF・honeypot は /business と同一コンポーネント（新経路を増やさない）。 */}
      <LeadCapture placement="article" context={u.slug} />

      {/* ===== 関連LPへの内部リンク（クラスタ内部リンク） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-500">
          ほかの使い方も見る
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/roumu/${o.slug}`}
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 sm:min-h-0 sm:py-2"
            >
              {o.ogCategory}
            </Link>
          ))}
        </div>
        {/* 無料ツール一覧（ハブ）への内部リンク。relatedTool を持たないLPからも
            /tools クラスタへ経路をつなぎ、クロールと回遊を確立する。 */}
        <p className="mt-6 text-center">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            自社の数字で確かめる無料ツール一覧
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}
