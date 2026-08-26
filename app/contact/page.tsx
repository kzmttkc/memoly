import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// 2026-08-08 UXペルソナ監査で発見: サイト内にナビ・フッターから辿れる問い合わせ導線が
// 存在せず、/contact は404だった（サポート窓口はtokushoho.tsxの中にしか記載が無かった）。
// 既存のSUPPORT_EMAILをそのまま案内する最小限のページを新設する。

const SUPPORT_EMAIL = 'support@banto-roumu.com'

// 2026-08-09 SEO/AEO/LLMO監査で発見: canonical/OG/Twitterを一切定義しておらず、
//   ルートlayout.tsx(消費者Memoly向けの既定値)がそのまま出ていた
//   （実測: 本番HTMLの canonical が /contact ではなく https://banto-roumu.com
//   ＝重複コンテンツ扱いのリスク、og:title/descriptionも「Kabau — 会社を覚える労務AI」の
//   トップページ用文言のまま）。他の主要ページ(/faq等)と同じ構造に揃える。
const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/contact`
const TITLE = 'お問い合わせ｜Kabau（カバウ）'
const DESC = 'Kabau（カバウ）へのお問い合わせ窓口です。サービスに関するご質問・不具合のご報告は、下記メールアドレス宛にご連絡ください。'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    siteName: 'Kabau（カバウ）',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: 'Kabau（カバウ） お問い合わせ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: [`${BASE}/og-image.png`],
  },
}

export default function ContactPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      {/* 2026-08-12 UXペルソナ監査 R-1/R-2: 規約・セキュリティ系のページだけ
          ヘッダが無く、ここへ着地した稟議担当が料金にも登録にも進めない
          行き止まりだった。公開面と同じ PublicHeader を置く。 */}
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/zure" className="text-sm text-neutral-500 hover:text-neutral-700">
            入口に戻る
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">お問い合わせ</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          サービスに関するご質問・不具合のご報告・その他お問い合わせは、下記メールアドレス宛にご連絡ください。
          原則3営業日以内に返信します。
        </p>
        <p className="mt-6 text-base">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="mt-8 text-sm leading-relaxed text-neutral-500">
          個人情報の開示・訂正・削除のご請求、解約に関するお申し出も同じ窓口で承ります。詳しくは
          <Link href="/tokushoho" className="text-brand-600 underline">
            特定商取引法に基づく表記
          </Link>
          をご確認ください。
        </p>
      </div>
      <PublicFooter />
    </div>
  )
}
