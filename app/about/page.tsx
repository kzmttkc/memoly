import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'
import {
  BRAND_LEGACY_NAME,
  BRAND_NAME,
  LEGAL_ENTITY,
  SERVICE_DOMAINS,
  SUPPORT_EMAIL,
} from '@/lib/brand'

export const metadata: Metadata = {
  title: `運営者情報｜${BRAND_NAME}`,
  description:
    '就業規則AIの運営者情報です。旧称・提供ドメイン・問い合わせ先をまとめています。',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/zure" className="text-sm text-neutral-500 hover:text-neutral-700">
            入口に戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">運営者情報</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年8月29日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">サービス</h2>
            <p>
              {BRAND_NAME}は、就業規則のファイルを置くと書いてあること／書いてないことが1枚になるサービスです。運営は{' '}
              {LEGAL_ENTITY}。提供ドメインは {SERVICE_DOMAINS} です。製品は一つで、集客面とSaaS面の役だけが分かれています。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">旧称について</h2>
            <p>
              以前の名称は {BRAND_LEGACY_NAME} です。画面・契約・会計上の対外名は「{BRAND_NAME}」に統一しています。アカウントとデータはそのまま使えます。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">お問い合わせ</h2>
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
                {SUPPORT_EMAIL}
              </a>
              （原則3営業日以内に返信します）
            </p>
            <p className="mt-2">
              事業者情報の開示請求・特商法の詳細は
              <Link href="/tokushoho" className="text-brand-600 underline">
                特定商取引法に基づく表記
              </Link>
              、取扱いの詳細は
              <Link href="/privacy" className="text-brand-600 underline">
                プライバシー
              </Link>
              ・
              <Link href="/terms" className="text-brand-600 underline">
                利用規約
              </Link>
              をご覧ください。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">集客面との関係</h2>
            <p>
              sharoushi-agent.com は同じ事業の集客・解説・カスハラ実務パックの面です。別のAI社労士サービスではありません。ファイルを置いて1枚にする本体は{' '}
              <Link href="/zure" className="text-brand-600 underline">
                banto-roumu.com/zure
              </Link>
              です。
            </p>
          </section>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
