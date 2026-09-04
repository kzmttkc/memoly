import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { BRAND_NAME } from '@/lib/brand'
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
    layer: '登録前',
    what: '計算・ガイド・ひな形・その場のずれ1枚',
    price: '¥0（登録不要。保存は登録）',
    where: 'sharoushi-agent.com / 本サイト /zure',
  },
  {
    layer: '会社記憶SaaS',
    what: '保存・継続相談・規程本数に応じたプラン',
    price: `無料枠あり / Entry ¥${ENTRY} / Standard ¥${STANDARD} / 士業 ¥${SHIGYO}`,
    where: '本サイト /pricing',
  },
  {
    layer: 'カスハラ実務パック',
    what: 'Word書式一式（10措置対応）',
    price: '¥19,800 一括',
    where: 'sharoushi-agent.com/kasuhara-pack.html',
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
          などと併用できます。記録台帳（¥1,980/月）の新規受付は停止しています（既存契約はポータルで解約可）。
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
          {/* 製品定義書 v3 §7.6: 一字一句 */}
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            規定例ガイドか基本方針ガイドで、自社の人数・組合・規則の有無を選ぶ。<br />
            足す条文と届出までの順番がその場で出る。残すならメール1つ。<br />
            ファイルが既にあるときだけ、就業規則のファイルを置く。
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://sharoushi-agent.com/kasuhara-shugyokisoku-kitei-guide.html?utm_source=banto&utm_medium=offer&utm_campaign=doc_first#pd-box"
              className={buttonClass({ variant: 'primary', className: 'justify-center' })}
              rel="noopener noreferrer"
            >
              足す条文と届出までの順番を出す（無料）
            </a>
            <TrackedCTA
              location="offer_zure"
              href="/zure"
              className={buttonClass({ variant: 'secondary', className: 'justify-center' })}
            >
              就業規則のファイルを置く
            </TrackedCTA>
            <TrackedCTA
              location="offer_pricing"
              href="/pricing"
              className={buttonClass({ variant: 'ghost', className: 'justify-center' })}
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
