import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ShieldCheck, Trash2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PLANS, billingEnabled } from '@/lib/plans'
import { FAQ_ITEMS } from '@/lib/faq'
import { PLAN_COPY } from './_lib/plan-copy'
import { TrackedCTA } from '../business/_components/TrackedCTA'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// ============================================================================
// /pricing — 料金の単独ページ（2026-07-30 PMF修理#1・新設）
// ----------------------------------------------------------------------------
//   なぜ必要か（実測）: 2026-07-30 時点で /pricing /plans /price /ryokin はすべて
//   404 で、料金は /business の id="pricing" アンカー1か所にしか存在しなかった。
//   sitemap.xml の51URLにも料金ページが無い。つまり「番頭 料金」「労務AI 料金 比較」
//   という**最も購買意欲の高いクエリ**に対して着地先が1枚も無く、直打ちは404だった。
//   モバイルでは #pricing は全長21,278pxのうち y=16,101（76%地点）で、ヘッダの
//   「料金」リンクは 640px 未満だと hidden sm:inline-flex で消える。
//   有料契約0件・company_leads 0行は、この入口が閉じている状態と一致する。
//
//   設計:
//     - 金額・席数・上限は lib/plans.ts（課金の正本）、訴求文は
//       app/pricing/_lib/plan-copy.ts（/business と共有）。ここでは何も二重管理しない。
//     - /business#pricing は残す（既存の内部リンク・計測を壊さない）。LP側の
//       料金セクション見出しからこのページへリンクして、検索の着地先を1枚に集める。
//     - FAQ は lib/faq.ts の「料金・契約」3問をそのまま可視表示し、同じ内容で
//       FAQPage 構造化データを出す（可視とJSON-LDを必ず一致させる）。
//
//   Phase1 厳守: 「社労士監修 / AI社労士 / 法的精度」は使わない。断定的な個別助言を
//   しない。絵文字アイコン・強調記号(**)・AI生成画像は使わない。
//
//   force-dynamic の理由: 課金の受付状態（billingEnabled）は環境変数で切り替わる。
//   静的生成するとビルド時の値が焼き込まれ、受付停止/再開が /tokushoho の表記と
//   ずれる（2026-07-29 L3監査#6と同じ事故）。/business と同じく毎リクエストで読む。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/pricing`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '番頭の料金｜月額3,980円から・無料プランあり｜会社を覚える労務AI',
  description:
    'Entry 3,980円/月（1社5名まで）、Standard 9,800円/月（20名まで）、士業 29,800円/月（1席）。無料プランから始められ、クレジットカード登録は不要です。',
  alternates: {
    canonical: URL,
    languages: {
      ja: URL,
      'x-default': URL,
    },
  },
  openGraph: {
    title: '番頭の料金｜月額3,980円から・無料プランあり',
    description:
      'Entry 3,980円/月（1社5名まで）、Standard 9,800円/月（20名まで）、士業 29,800円/月（1席）。無料プランから始められ、クレジットカード登録は不要です。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-banto-main.png`, width: 1200, height: 630, alt: '番頭(Banto) の料金' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '番頭の料金｜月額3,980円から・無料プランあり',
    description:
      'Entry 3,980円/月、Standard 9,800円/月、士業 29,800円/月（1席）。無料プランから始められ、クレジットカード登録は不要です。',
    images: [`${BASE}/og-banto-main.png`],
  },
}

// 料金の意思決定に直結する3問だけをこのページに置く（SSOT: lib/faq.ts）。
//   /faq の全問はページ末尾からリンクする。可視本文と FAQPage 構造化データは同一。
const PRICING_FAQ = FAQ_ITEMS.filter((f) => f.category === '料金・契約')

export default function PricingPage() {
  const paidSignupOpen = billingEnabled()

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PRICING_FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: '料金', item: URL },
    ],
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <PublicHeader ctaLocation="pricing_page_header" showPricingLink={false} />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">料金</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-6 text-center">
        <Badge tone="brand" className="mb-5">料金</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          番頭の料金
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          会社の規程を覚える労務AI「番頭」の料金です。無料プランから始められ、登録にクレジットカードは要りません。
          有料プランは月額3,980円（Entry・1社5名まで）からで、上限人数までは何人で使っても料金は変わりません。
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 無料プランあり
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden /> クレジットカード登録不要
          </span>
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3.5 w-3.5 text-brand-600" aria-hidden /> やめるときはデータごと全削除
          </span>
        </div>
      </section>

      {/* ===== 料金カード（訴求文は /business と共有の PLAN_COPY） ===== */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="mx-auto mb-10 max-w-2xl rounded-2xl border border-brand-200 bg-brand-50/50 p-6 text-center sm:p-8">
            <p className="text-lg font-semibold text-neutral-900">
              無料プランから始められます。そして番頭は、使うほど御社専用に育ちます。
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              規程や相談の記憶が貯まるほど、答えは自社の実態に近づいていきます。
              だからこそ先にお伝えします。合わないと感じたら、預けたデータごと全削除してやめられます。
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              {paidSignupOpen ? (
                <>
                  下記は有料プランに切り替えた場合の月額料金です。ご自身で有料プランを選び、
                  お申し込みの操作をしたときだけ課金されます。登録しただけで自動的に課金が始まることはありません。
                </>
              ) : (
                <>
                  有料プランへの切り替えは、現在お申し込みの受付を一時的に停止しています（無料プランは引き続きご利用いただけます）。
                  受付を再開する際は、このページと特定商取引法に基づく表記でお知らせします。
                </>
              )}
            </p>
          </div>

          <div className="grid min-w-0 items-start gap-5 sm:grid-cols-3">
            {PLAN_COPY.map((p) => (
              <Card
                key={p.name}
                className={'min-w-0 ' + (p.featured ? 'border-brand-300 shadow-md ring-1 ring-brand-200' : '')}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{p.name}</h2>
                  {p.badge && <Badge tone={p.featured ? 'brand' : 'neutral'}>{p.badge}</Badge>}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{p.tagline}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                    &yen;{p.price}
                  </span>
                  <span className="text-sm text-neutral-500">{p.unit}</span>
                </p>
                {/* 2026-07-30 PMF修理#7: 年額は既存の値（lib/plans.ts）のまま、
                    12pxグレー1行から可読なバッジ表記へ。価格の新設・トグルはしない
                    （Stripeの価格を増やす＝Takeshi承認事項のため実装しない）。 */}
                {p.yearly && (
                  <p className="mt-2 inline-flex flex-wrap items-baseline gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm text-brand-800">
                    <span className="font-semibold tabular-nums">年額 &yen;{p.yearly.toLocaleString()}</span>
                    <span className="text-xs text-brand-700">（月払いより2ヶ月分お得）</span>
                  </p>
                )}
                {p.anchor && <p className="mt-2 text-xs leading-relaxed text-neutral-600">{p.anchor}</p>}
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
                <TrackedCTA
                  location={`pricing_page_${p.name}`}
                  href={p.signupHref}
                  className={buttonClass({
                    variant: p.featured ? 'primary' : 'secondary',
                    className: 'mt-6 w-full whitespace-normal text-center',
                  })}
                >
                  {p.cta}
                </TrackedCTA>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
            EntryとStandardは1社あたりの月額です。プランの上限人数までは、何人で使っても料金は変わりません。
            士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。顧問先の登録数の上限は{PLANS.shigyo.maxCompanies}社までで、これとは別に、事務所の利用メンバー数（席）の上限は{PLANS.shigyo.seatCap}席までです（顧問先数と席数は別々の上限です）。
            年払い（月払いより2ヶ月分お得）は現在Entryプランのみのご用意で、Standardと士業プランは月払いのみです。
            複数店舗をお持ちの場合は、1社の契約にまとめて店舗ごとの前提を登録する方法と、
            士業プランの複数会社管理機能で店舗ごとに記憶を分ける方法のどちらも選べます。
            {/* 2026-07-30 PMF修理#1: 税・支払い・解約の表記は /tokushoho（特定商取引法に基づく表記）の
                確定文言に一致させる。ここだけ独自に言い換えると表示が食い違う。
                2026-08-20 正典整合（business-facts.md 2026-07-30 Takeshi確定）: 当社は消費税の
                免税事業者。価格の表示に消費税区分を名乗らない。あわせて
                「適格請求書を発行できない旨を購入前に明記する」という正典の要件を満たすため、
                /tokushoho の適格請求書欄と sharoushi の販売ページにある既存の開示文と同じ趣旨の
                一文をここ（購入導線のある面）にも置く。数字と追加料金なしの事実は変えていない。 */}
            表示価格はいずれもお支払い総額で、表示価格以外の追加料金はかかりません。
            当方は消費税の免税事業者で、適格請求書発行事業者の登録がないため、適格請求書（インボイス）を発行できません。
            仕入税額控除を受ける必要がある場合は、この点をご確認のうえご判断ください。
            お支払いはクレジットカード（決済代行：Stripe）で、月額プランは初回決済日を基準に1か月ごとの自動更新です。
            {/* 2026-08-12 UXペルソナ監査 R-7: /tokushoho にある「次回請求日の7日前まで」が
                この面だけ落ちており、期限を知らずに直前に申し出た利用者が次期分を課金される。
                正典（/tokushoho の解約欄）と同じ条件をここにも書く。 */}
            解約に最低利用期間の縛りはありません。管理画面の「アカウント・データ管理」にある「お支払いと解約の管理」から、ご自身で解約手続きを完了できます（解約は現在の請求期間の終了時に適用され、お支払い済みの請求期間の末日まではご利用いただけます）。
            管理画面から手続きできない場合はお問い合わせ窓口へメールでお申し出いただければ当方が処理します（原則3営業日以内。処理に日数を要するため、次回の請求日の7日前までにご連絡ください）。
            詳しい条件は
            <Link href="/tokushoho" className="underline underline-offset-2 hover:text-brand-700">特定商取引法に基づく表記</Link>
            をご覧ください。
          </p>
        </div>
      </section>

      {/* ===== 無料プランで何ができるか ===== */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">無料プランでできること</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            会社の登録、規程{PLANS.free.documentCap}本の記憶、日々の労務相談は無料プランのままお試しいただけます。
            まず「二度目の相談が前回の続きから始まる」ところまで、費用をかけずに確かめてください。
          </p>
          <ul className="mt-5 space-y-2.5">
            {[
              `AIチャット相談 1日${PLANS.free.limits.chat}回まで`,
              `自社の規程を${PLANS.free.documentCap}本まで記憶（就業規則1本を丸ごと試せます）`,
              `労務リスク・セルフ診断、規程ドラフトの下書き・レビュー 各1日${PLANS.free.limits.risk_audit}回まで`,
              `利用メンバー ${PLANS.free.seatCap}名まで`,
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-neutral-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                <span className="leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-neutral-500">
            賃金規程・育児介護規程と会社の実運用に載せていく段で、上限が足りなくなったら有料プランへ切り替えられます。
            切り替えはご自身の操作でのみ発生し、無料のまま使い続けることもできます。
          </p>
        </div>
      </section>

      {/* ===== 料金のFAQ（可視本文＝FAQPage構造化データと一致） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">料金についてよくある質問</h2>
        <div className="mt-5 space-y-4">
          {PRICING_FAQ.map((f) => (
            <Card key={f.q} padded>
              <h3 className="text-base font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
            </Card>
          ))}
        </div>
        <p className="mt-5 text-center">
          <Link href="/faq" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
            料金以外のよくある質問も見る
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </p>
      </section>

      {/* ===== 末尾CTA ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            まず無料で、自社を覚えるところまで
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録して、最初の相談を投げてみてください。クレジットカードの登録は不要です。
          </p>
          <div className="mt-6 flex justify-center">
            <TrackedCTA
              location="pricing_page_footer"
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              無料で会社を登録して試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
          <p className="mt-4 text-xs text-brand-100">
            <Link href="/business" className="underline underline-offset-2 hover:text-white">
              番頭がどう答えるかを先に見る（サービス概要）
            </Link>
          </p>
        </Card>
      </section>

      <PublicFooter />
    </div>
  )
}
