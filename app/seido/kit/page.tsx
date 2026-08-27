import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, FileText, Calculator as CalcIcon, ClipboardCheck } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  SEIDO_KIT_NAME,
  SEIDO_KIT_PRICE_JPY,
  KIT_LETTERS,
  KIT_CHECKLIST_ITEM_COUNT,
  KIT_DISCLAIMER,
} from '@/lib/seido-kit'
import { BuyButton } from './_components/BuyButton'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido/kit — 有料キットの販売LP（公開・SSG）。2026-08-13 新設（AQ-023承認）。
//   核の訴求: 経過措置縮小を理由とする再交渉の「そのまま使える文面」は
//   無料・有料とも市場に無い（実査済み）。解説ではなく文面そのものを売る。
//   特商法: 価格は SSOT(lib/seido-kit.ts) を参照。買い切り・返金不可
//   （デジタルコンテンツ）を購入ボタン近傍に明示し、/tokushoho にも同商品を記載。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/seido/kit`
const PRICE = `¥${SEIDO_KIT_PRICE_JPY.toLocaleString('ja-JP')}`

export const metadata: Metadata = {
  title: `${SEIDO_KIT_NAME}（${PRICE}・買い切り）｜就業規則AI`,
  description:
    '経過措置80%から70%への縮小に対応する再交渉文面5通（買手用・売手用、公正取引委員会等Q&Aの枠組み準拠）、影響額計算ツール、39項目の実務チェックリスト。2026年10月1日の期日までに使える実務キットです。',
  alternates: { canonical: URL },
  openGraph: {
    title: `${SEIDO_KIT_NAME}（${PRICE}・買い切り）｜就業規則AI`,
    description:
      '再交渉文面5通・影響額計算ツール・39項目の実務チェックリスト。2026年10月1日の期日までに使える実務キットです。',
    url: URL,
    siteName: '就業規則AI',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: SEIDO_KIT_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SEIDO_KIT_NAME}（${PRICE}・買い切り）｜就業規則AI`,
    description:
      '再交渉文面5通・影響額計算ツール・39項目の実務チェックリスト。',
    images: [`${BASE}/og-image.png`],
  },
}

export default function SeidoKitPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '就業規則AI', item: `${BASE}/zure` },
      { '@type': 'ListItem', position: 2, name: '制度対応', item: `${BASE}/seido` },
      { '@type': 'ListItem', position: 3, name: SEIDO_KIT_NAME, item: URL },
    ],
  }

  const kaite = KIT_LETTERS.filter((l) => l.side === '買手用')
  const urite = KIT_LETTERS.filter((l) => l.side === '売手用')

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        <Link href="/seido" className="hover:text-brand-700">制度対応</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">完全キット</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">有料キット・買い切り{PRICE}</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          {SEIDO_KIT_NAME}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          2026年10月1日、インボイス経過措置の控除割合が80%から70%に変わります。
          このタイミングで必要になるのに、探してもなかなか見つからないものがあります。
          取引先との価格の話をどう切り出すか、どう返すかの、そのまま使える文面です。
          解説記事は無料で読めます。このキットは、実際に手を動かす段階の道具をまとめたものです。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 公正取引委員会等Q&amp;Aの枠組みに沿った文面
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 買い切り・追加課金なし
          </span>
        </div>
      </section>

      {/* ===== 中身 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">キットの中身</h2>
        <ul className="mt-4 space-y-4">
          <li>
            <Card padded className="space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">1. 再交渉文面セット（5通・コピーしてすぐ使える）</p>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-neutral-600">
                    {kaite.map((l) => (
                      <li key={l.id}>買手用 {l.title} — {l.usage}</li>
                    ))}
                    {urite.map((l) => (
                      <li key={l.id}>売手用 {l.title} — {l.usage}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                    財務省・公正取引委員会など5省庁連名Q&amp;A（一方的な引き下げは優越的地位の濫用・下請法違反のおそれ）の枠組みに沿って設計。使用上の注意を同梱しています。
                  </p>
                </div>
              </div>
            </Card>
          </li>
          <li>
            <Card padded className="space-y-2">
              <div className="flex items-start gap-2">
                <CalcIcon className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">2. 影響額計算ツール</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    免税事業者等からの年間仕入額を入れると、70%・50%・30%・廃止の各段階での控除額と負担増（年・月）を一覧表示。仕入先別の1億円ルール該当チェックつき。入力値は保存されません。
                  </p>
                </div>
              </div>
            </Card>
          </li>
          <li>
            <Card padded className="space-y-2">
              <div className="flex items-start gap-2">
                <ClipboardCheck className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    3. 実務チェックリスト完全版（全{KIT_CHECKLIST_ITEM_COUNT}項目・手順つき）
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    無料版（15項目）に実務手順を付け、経理の共通段取り・1億円ルール該当社向けなど6グループ{KIT_CHECKLIST_ITEM_COUNT}項目に拡張。制度の数字はすべて国税庁・財務省の一次資料の範囲で作っています。
                  </p>
                </div>
              </div>
            </Card>
          </li>
        </ul>
      </section>

      {/* ===== 文面の冒頭サンプル ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">文面の冒頭サンプル（売手用 文面A）</h2>
        <div className="mt-3 rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
          <p>まず制度の前提として、2026年10月1日以後も、貴社は当社からの仕入について消費税額の70%を控除できると理解しております（変更されるのは80%から70%への10ポイント分で、当初予定の50%への引き下げは令和8年度税制改正で緩和されています）。</p>
          {/* 2026-08-19 UXペルソナ監査 I-4: text-neutral-400 (#94a3b8) on bg-neutral-50
              (#f8fafc) はコントラスト比 約2.45:1 で WCAG AA(通常テキスト4.5:1)未達を実測で確認
              （前回R-9と同型の再発）。R-9と同じ是正基準の text-neutral-500 (#64748b) に置換
              （同背景で約4.55:1・AA適合）。 */}
          <p className="mt-2 text-xs text-neutral-500">（続きと残り4通は購入後にすべて読めます）</p>
        </div>
      </section>

      {/* ===== 購入 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Card className="bg-brand-600 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {PRICE}・買い切り
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            クレジットカード決済（Stripe）。決済完了後、すぐにすべての内容をご利用いただけます。
            就業規則AIの無料登録（ログイン）が必要です。
          </p>
          <div className="mt-6 flex justify-center">
            <BuyButton location="kit_lp" label={`${PRICE}で購入する`} />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-brand-100">
            デジタルコンテンツの性質上、決済完了後の返金には応じられません。
            {/* 2026-08-20 正典整合（business-facts.md 2026-07-30 Takeshi確定）:
                「適格請求書を発行できない旨を購入前に明記する」。ここは価格と購入ボタンを
                持つ販売面なのにその開示が無く、機械ゲート（scripts/business_facts_gate.py）が
                本番で検出した。本商品はインボイス制度対応キットで購入者が税務に敏感なため
                特に重要。文面は /tokushoho の適格請求書欄と sharoushi の販売ページにある
                既存の確定文言から同趣旨で流用する（新規の創作をしない）。 */}
            当方は消費税の免税事業者で、適格請求書発行事業者の登録がないため、適格請求書（インボイス）を発行できません。
            仕入税額控除を受ける必要がある場合は、この点をご確認のうえご判断ください。
            販売条件の詳細は<Link href="/tokushoho" className="underline hover:text-white">特定商取引法に基づく表記</Link>をご確認ください。
          </p>
          <p className="mt-2 text-xs text-brand-100">
            購入済みの方は<Link href="/seido/kit/honbun" className="underline hover:text-white">こちらから開けます</Link>
          </p>
        </Card>
      </section>

      {/* ===== 無料面への導線（買わない人も逃さない） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <Card interactive padded={false}>
          <Link href="/seido" className="block p-5 sm:p-6">
            <p className="text-xs font-medium text-brand-700">まず無料で読む</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">制度対応シリーズの解説記事（無料）</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              経過措置のスケジュール・2割特例の終了・1億円ルールの解説は、無料記事で全文読めます。チェックリスト（15項目版）も無料登録で読めます。
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              無料記事を読む
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </Card>
      </section>

      {/* ===== 免責 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="rounded-xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-500">
          {KIT_DISCLAIMER}
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}
