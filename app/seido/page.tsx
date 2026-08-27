import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ClipboardCheck } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SEIDO_POSTS, SEIDO_DISCLAIMER, SEIDO_CHECKLIST_ITEM_COUNT } from '@/lib/seido'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido — 制度対応シリーズのハブ（SSG・クローラブル）。2026-08-13 新設。
//   /roumu ハブと同型（ItemList/BreadcrumbList JSON-LD・SSOTから全列挙）。
//   シリーズの約束: 期日が確定している制度改正を、一次資料に当たって整理し、
//   やることに落とす。第1弾はインボイス2026年10月改正。
//   Phase1 厳守・§11 禁止表現・評価系JSON-LDなし（/roumu と同一の規律）。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/seido`

export const metadata: Metadata = {
  title: '制度対応｜期日のある制度改正を一次資料で整理する｜就業規則AI',
  description:
    'インボイス経過措置の80%から70%への縮小、2割特例の終了と3割特例。期日が確定している制度改正を、国税庁・財務省などの一次資料に当たって整理し、中小企業のバックオフィスがやることに落とすシリーズです。',
  alternates: { canonical: URL },
  openGraph: {
    title: '制度対応｜期日のある制度改正を一次資料で整理する｜就業規則AI',
    description:
      '期日が確定している制度改正を、一次資料に当たって整理し、中小企業のバックオフィスがやることに落とすシリーズです。',
    url: URL,
    siteName: '就業規則AI',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '制度対応シリーズ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '制度対応｜期日のある制度改正を一次資料で整理する｜就業規則AI',
    description:
      '期日が確定している制度改正を、一次資料に当たって整理し、中小企業のバックオフィスがやることに落とすシリーズです。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function SeidoIndexPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '就業規則AI', item: `${BASE}/zure` },
      { '@type': 'ListItem', position: 2, name: '制度対応', item: URL },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '制度対応シリーズの記事一覧',
    itemListElement: SEIDO_POSTS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: `${BASE}/seido/${p.slug}`,
    })),
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">制度対応</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">制度対応シリーズ</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          期日のある制度改正を、一次資料で整理する
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          制度改正の解説は、改正のたびに古くなります。検索上位の記事が改正前の情報のまま残っていることも珍しくありません。
          このシリーズでは、期日が確定している制度改正を国税庁・財務省・厚生労働省などの一次資料に当たって整理し、
          中小企業のバックオフィスが期日までにやることへ落とします。すべての記事に出典と参照日を明記します。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 出典は一次資料のみ
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 期日から逆算した実務手順
          </span>
        </div>
      </section>

      {/* ===== 第1弾の説明 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Card padded className="space-y-2">
          <p className="text-sm font-semibold text-neutral-900">
            第1弾: インボイス2026年10月改正
          </p>
          <p className="text-sm leading-relaxed text-neutral-600">
            2026年10月1日に、免税事業者等からの仕入に係る経過措置の控除割合が80%から70%に変わります。
            あわせて小規模事業者の2割特例が適用期限を迎え、個人事業者には3割特例が設けられます。
            改正前の「50%になる」という古い情報が検索結果に残っているため、現行制度との差分を一次資料で確かめられる形にまとめました。
          </p>
        </Card>
      </section>

      {/* ===== 記事一覧 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <ul className="space-y-4">
          {SEIDO_POSTS.map((p) => (
            <li key={p.slug}>
              <Card interactive padded={false}>
                <Link href={`/seido/${p.slug}`} className="block p-5 sm:p-6">
                  <p className="text-xs font-medium text-brand-700">{p.category}</p>
                  <p className="mt-1 text-base font-semibold text-neutral-900">{p.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{p.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                    <time dateTime={p.publishedAt}>{p.publishedAt}</time>
                    <span>読了目安 {p.readingMinutes}分</span>
                  </div>
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

      {/* ===== チェックリスト（登録特典） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <Card interactive padded={false}>
          <Link href="/seido/checklist" className="block p-5 sm:p-6">
            <div className="flex items-start gap-2">
              <ClipboardCheck className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  インボイス2026年10月対応チェックリスト（全{SEIDO_CHECKLIST_ITEM_COUNT}項目・無料）
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                  買手（本則課税）・売手（個人・法人・免税継続）の立場別に、期日までに確認することをまとめました。就業規則AIの無料登録で全項目を読めます。
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

      {/* ===== 有料キット（AQ-023承認・2026-08-13） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Card interactive padded={false}>
          <Link href="/seido/kit" className="block p-5 sm:p-6">
            <p className="text-xs font-medium text-brand-700">実務で手を動かす段階の方へ</p>
            <p className="mt-1 text-base font-semibold text-neutral-900">
              インボイス2026年10月対応 完全キット（¥2,980・買い切り）
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              取引先との価格協議にそのまま使える再交渉文面5通（買手用・売手用）、影響額計算ツール、39項目の実務チェックリスト。文面は公正取引委員会等Q&amp;Aの枠組みに沿って設計しています。
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              キットの内容を見る
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </Card>
      </section>

      {/* ===== 免責 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <p className="rounded-xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-500">
          {SEIDO_DISCLAIMER}
        </p>
      </section>

      {/* ===== 就業規則AI本体への導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            制度の次は、就業規則のファイルから
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            登録の前に、PDF・Wordを置くか、本文を貼れます。ずれの1枚のあとで、相談が開きます。
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
