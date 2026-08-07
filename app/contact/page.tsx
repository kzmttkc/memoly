import Link from 'next/link'

// 2026-08-08 UXペルソナ監査で発見: サイト内にナビ・フッターから辿れる問い合わせ導線が
// 存在せず、/contact は404だった（サポート窓口はtokushoho.tsxの中にしか記載が無かった）。
// 既存のSUPPORT_EMAILをそのまま案内する最小限のページを新設する。

const SUPPORT_EMAIL = 'support@banto-roumu.com'

export const metadata = {
  title: 'お問い合わせ | 番頭',
  description: '番頭（Banto）へのお問い合わせ窓口です。',
}

export default function ContactPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
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
    </div>
  )
}
