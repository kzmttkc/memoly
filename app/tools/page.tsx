import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TOOL_LIST } from '@/lib/tools'

// ============================================================================
// /tools — 無料セルフ点検ツールの一覧（ハブ・SSG・クローラブル）
//   目的（2026-07-12・SEO内部リンク強化）: /tools/* 5本は内部リンク不足で
//   クロール経路が細く、インデックスされていない。ここをハブに据え、
//   /business・/roumu・各ツールから相互リンクしてクロール経路を確立する。
//   一覧の中身は SSOT(lib/tools.ts) から全列挙する。
//
//   /roumu/[slug] と同じライト基調（.company-light + 白背景）。
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言をしない。
//   評価系(aggregateRating/review)は実データ無しのため持たせない（捏造禁止）。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/tools`

// ============================================================================
// 「よくある確認」上位強調（G-g・2026-07-23 W3.5d）
//   ツール完了イベントの実績集計はまだ母数が無い（2026-07-23時点・funnel台帳に
//   ツール別完了実績なしを実測確認）ため、実務頻度順の静的順位で表示する。
//   根拠: 年5日有給=全社が毎年必ず対象／残業代=毎月の給与計算で発生、に対し
//   社保加入=パート採用時・36協定=年次締結時・柔軟な働き方=2025年10月の新義務。
//   実績が貯まったら tool別の完了イベント集計で並べ替えに切り替える。
//   SSOT(lib/tools.ts)の順序は他面（相互リンク・sitemap）と共有のため触らず、
//   表示順はこのページ内でのみ確定する。
// ============================================================================
const DISPLAY_ORDER = [
  'yukyu-5nichi-check',
  'zangyodai-check',
  'saitei-chingin-check',
  'syaho-kanyu-taisho-check',
  '36kyotei-jougen-check',
  'jyunan-hatarakikata-check',
]
const FREQUENT_SLUGS = new Set(['yukyu-5nichi-check', 'zangyodai-check', 'saitei-chingin-check'])
const ORDERED_TOOLS = [...TOOL_LIST].sort(
  (a, b) => DISPLAY_ORDER.indexOf(a.slug) - DISPLAY_ORDER.indexOf(b.slug),
)

export const metadata: Metadata = {
  title: '労務の無料セルフ点検ツール一覧｜番頭(Banto)',
  description:
    '有給5日の取得義務、36協定の上限、残業代の計算、パート従業員の社会保険加入、柔軟な働き方の措置。中小企業の労務を自社の数字で確認できる無料ツールの一覧です。登録不要・会社データは保存しません。',
  alternates: { canonical: URL },
  openGraph: {
    title: '労務の無料セルフ点検ツール一覧｜番頭(Banto)',
    description:
      '中小企業の労務を自社の数字で確認できる無料セルフ点検ツールの一覧です。登録不要・会社データは保存しません。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '労務の無料セルフ点検ツール一覧' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '労務の無料セルフ点検ツール一覧｜番頭(Banto)',
    description:
      '中小企業の労務を自社の数字で確認できる無料セルフ点検ツールの一覧です。登録不要・会社データは保存しません。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function ToolsIndexPage() {
  // BreadcrumbList（番頭 → 無料ツール）
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${BASE}/business` },
      { '@type': 'ListItem', position: 2, name: '無料ツール', item: URL },
    ],
  }

  // ItemList（一覧に並ぶ各ツールを列挙。順序つき）
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '労務の無料セルフ点検ツール一覧',
    itemListElement: ORDERED_TOOLS.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      url: `${BASE}/tools/${t.slug}`,
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
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">無料ツール</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">無料セルフ点検ツール</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          労務の無料セルフ点検ツール一覧
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          中小企業の労務でつまずきやすい論点を、自社の数字を入れて画面で確認できる無料ツールをまとめました。
          いずれも登録は不要で、入力した会社のデータは保存しません。結果は一般的な目安の整理で、
          合否や適法性を判定するものではありません。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 登録不要ですぐ使える
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 会社のデータは保存しない
          </span>
        </div>
      </section>

      {/* ===== ツール一覧（クローラブルな内部リンク集） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <ul className="space-y-4">
          {ORDERED_TOOLS.map((t) => {
            const frequent = FREQUENT_SLUGS.has(t.slug)
            return (
              <li key={t.slug}>
                <Card
                  interactive
                  padded={false}
                  className={frequent ? 'border-brand-200 ring-1 ring-brand-100' : undefined}
                >
                  <Link href={`/tools/${t.slug}`} className="block p-5 sm:p-6">
                    <p className="flex items-center gap-2 text-xs font-medium text-brand-700">
                      無料ツール
                      {frequent && <Badge tone="brand">よくある確認</Badge>}
                    </p>
                    <p
                      className={
                        frequent
                          ? 'mt-1.5 text-lg font-bold text-neutral-900'
                          : 'mt-1 text-base font-semibold text-neutral-900'
                      }
                    >
                      {t.name}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{t.blurb}</p>
                    <span className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                      無料で点検する
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ===== 番頭本体への導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            点検の先は、自社を覚えるAIに
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            点検で気になった点は、会社を登録すれば番頭に続けて相談できます。二度目からは前提を説明し直さずに話せます。無料で試せます。
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/business" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
              番頭の全体像を見る
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
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
          <p className="mt-2 text-xs text-neutral-500">運営：KIZUNA Creation</p>
        </div>
      </footer>
    </div>
  )
}
