import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { BRAND_NAME, BRAND_TRANSITION_NOTE } from '@/lib/brand'
import { PLANS } from '@/lib/plans'
import { OfferViewTrack } from './OfferViewTrack'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import { buttonClass } from '@/components/ui/Button'

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/offer`

export const metadata: Metadata = {
  title: `${BRAND_NAME}で使えるもの｜無料と有料の違い`,
  description:
    '相談・計算・ずれ1枚は0円。カスハラ実務パックは19,800円、会社記憶の継続は月額プラン。手続きSaaSの代替ではありません。',
  alternates: { canonical: URL },
  openGraph: {
    title: `${BRAND_NAME}で使えるもの｜無料と有料の違い`,
    description:
      '何が無料で、何がいくらかを1枚で確認できます。最初の一歩は就業規則のファイルを置くことです。',
    url: URL,
    siteName: BRAND_NAME,
    locale: 'ja_JP',
    type: 'website',
  },
}

const ENTRY = PLANS.starter.monthlyJpy.toLocaleString()
const STANDARD = PLANS.standard.monthlyJpy.toLocaleString()
const SHIGYO = PLANS.shigyo.monthlyJpy.toLocaleString()

const ROWS: { layer: string; what: string; price: string; where: string }[] = [
  {
    layer: '無料ツール・記事・相談AI',
    what: '計算・ガイド・ひな形・その場のずれ1枚',
    price: '¥0（登録不要。保存は登録）',
    where: 'sharoushi-agent.com / 本サイト /zure',
  },
  {
    layer: 'カスハラ実務パック',
    what: 'Word書式一式（10措置対応）',
    price: '¥19,800 一括',
    where: 'sharoushi-agent.com/kasuhara-pack.html',
  },
  {
    layer: '記録台帳',
    what: '店舗と本部で発生・研修記録を共有',
    price: '¥1,980/月',
    where: 'sharoushi-agent.com',
  },
  {
    layer: '会社記憶SaaS',
    what: '保存・継続相談・規程本数に応じたプラン',
    price: `無料枠あり / Entry ¥${ENTRY}〜 / Standard ¥${STANDARD} / 士業 ¥${SHIGYO}`,
    where: '本サイト /pricing',
  },
]

export default function OfferBoundaryPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <OfferViewTrack />
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">売り物の境界</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {BRAND_NAME}で使えるもの（無料と有料）
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          初見でも「何がいくらで、どこで始めるか」が分かるようにまとめています。
          手続きシステム（入退社・給与・電子申請）の代替ではありません。SmartHR や freee
          などと併用できます。
        </p>

        <div className="mt-8 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 font-medium">層</th>
                <th className="px-4 py-3 font-medium">内容</th>
                <th className="px-4 py-3 font-medium">料金</th>
                <th className="px-4 py-3 font-medium">場所</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.layer} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{r.layer}</td>
                  <td className="px-4 py-3 text-neutral-700">{r.what}</td>
                  <td className="px-4 py-3 text-neutral-700">{r.price}</td>
                  <td className="px-4 py-3 text-neutral-600">{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">最初にやること</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            登録の前に、就業規則の PDF・Word、または本文を置けます。足りない条項と矛盾が1枚になります。相談は、そのあとの話です。
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <TrackedCTA
              location="offer_zure"
              href="/zure"
              className={buttonClass({ variant: 'primary', className: 'justify-center' })}
            >
              就業規則のファイルを置く
            </TrackedCTA>
            <TrackedCTA
              location="offer_pricing"
              href="/pricing"
              className={buttonClass({ variant: 'secondary', className: 'justify-center' })}
            >
              月額プランの詳細
            </TrackedCTA>
            <a
              href="https://sharoushi-agent.com/kasuhara-pack.html?utm_source=banto&utm_medium=offer&utm_campaign=boundary"
              className={buttonClass({ variant: 'ghost', className: 'justify-center' })}
              rel="noopener noreferrer"
            >
              カスハラ実務パック
            </a>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">やらないこと</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>入退社・給与計算・電子申請の代行や置換を名乗らない</li>
            <li>社労士の独占業務の代替、個別の法的助言を名乗らない</li>
            <li>あとから隠れた請求が来る「全部無料」表現をしない</li>
          </ul>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-neutral-500">
          {BRAND_TRANSITION_NOTE}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          本ページの情報は一般的なご案内です。最終的な判断は、必要に応じて専門家にご確認ください。
          詳細な料金条件は <Link href="/pricing" className="underline hover:text-brand-700">料金ページ</Link>
          と <Link href="/tokushoho" className="underline hover:text-brand-700">特定商取引法に基づく表記</Link>
          をご覧ください。
        </p>
      </main>
      <PublicFooter omitServiceHrefs={['/offer']} />
    </div>
  )
}
