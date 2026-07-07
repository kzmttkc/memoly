import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Brain, Check } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Calculator } from './Calculator'

// ============================================================================
// /tools/yukyu-5nichi-check — 年5日 有給取得義務のセルフ点検ツール（無料・登録不要）
//   計算はクライアント（Calculator.tsx）で行い、会社データはサーバに送らない。
//   本ページ自体は Server Component（metadata + 静的な説明・FAQを初期HTMLに描画）。
//
//   狙うクエリ:「有給 5日 取得義務 チェック 無料」「年5日 有給 取得状況 セルフ点検」
//   「有給 5日 取れていない 確認」。"無料"修飾子＋具体タスクの勝ちパターンを再現。
//
//   /roumu/[slug] と同じライト基調（.company-light + 白背景）に合わせる。
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言をしない。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/tools/yukyu-5nichi-check`

export const metadata: Metadata = {
  title: '年5日の有給取得義務を無料でセルフ点検｜番頭(Banto)',
  description:
    '年5日の有給休暇の取得義務を満たしているか、無料で点検できるツールです。基準日と取得済みの日数を入れると、あと何日取らせる必要があるか、期限はいつかを画面で確認できます。登録不要・会社データは保存しません。',
  alternates: { canonical: URL },
  openGraph: {
    title: '年5日の有給取得義務を無料でセルフ点検｜番頭(Banto)',
    description:
      '基準日と取得済みの日数を入れるだけで、年5日の有給取得義務の充足状況・残り日数・期限を無料でセルフ点検できます。登録不要・会社データは保存しません。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '年5日の有給取得義務セルフ点検' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '年5日の有給取得義務を無料でセルフ点検｜番頭(Banto)',
    description:
      '基準日と取得済みの日数を入れるだけで、年5日の有給取得義務の充足状況・残り日数・期限を無料でセルフ点検できます。登録不要。',
    images: [`${BASE}/og-image.png`],
  },
}

const FAQS = [
  {
    q: '年5日の有給取得義務は、どの社員が対象ですか',
    a: '年10日以上の年次有給休暇が付与される社員が対象です。付与日数の条件を満たせば、パートやアルバイト、管理監督者も含まれます。このツールでは付与日数が10日以上のときに点検の対象として扱います。',
  },
  {
    q: '社員が自分で取った有給は5日にカウントできますか',
    a: '本人が請求して取得した日数と、計画的付与で取得した日数は、年5日から差し引けるのが一般的な考え方です。このツールの「これまでに取得した日数」には、それらを合わせて入力してください。差し引いても5日に足りない分を会社が時季を指定して取らせます。',
  },
  {
    q: 'このツールの結果はそのまま社内判断に使えますか',
    a: 'このツールが示すのは、入力内容にもとづく一般的な目安の整理で、合否や適法性を判定するものではありません。正確な取得状況は自社の就業規則や年次有給休暇管理簿でご確認いただき、個別の判断が必要な場合は専門家にご相談ください。',
  },
  {
    q: '入力した会社や社員のデータは保存されますか',
    a: '保存しません。入力内容はお使いのブラウザの中だけで計算し、サーバーに送信することはありません。ページを閉じると入力は残りません。',
  },
]

export default function YukyuCheckToolPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 2, name: '無料ツール', item: URL },
      { '@type': 'ListItem', position: 3, name: '年5日の有給取得義務セルフ点検', item: URL },
    ],
  }

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

      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <Brain className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight text-neutral-900">番頭(Banto)</span>
          </Link>
          <Link href="/login?next=/company" className="text-sm text-neutral-500 hover:text-brand-700">
            ログイン
          </Link>
        </div>
      </header>

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-400">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">無料ツール</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">無料セルフ点検ツール</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          年5日の有給取得義務を無料でセルフ点検する
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          社員の基準日とこれまでに取得した日数を入れると、年5日の取得義務を満たしているか、あと何日取らせる必要があるか、期限はいつかを画面で確認できます。登録は不要で、入力した会社のデータは保存しません。
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

      {/* ===== 計算ツール（クライアント） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <Calculator />
      </section>

      {/* ===== 制度の説明（静的・クローラブル） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">年5日の有給取得義務とは</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
          <p>
            2019年4月から、年10日以上の年次有給休暇が付与される社員について、会社が年5日を確実に取得させることが求められています。取得が本人任せのままだと、義務を果たせていない状態になりかねません。
          </p>
          <p>
            対象は正社員だけではありません。所定労働日数や勤続年数の条件を満たして年10日以上が付与されるなら、パートやアルバイトの社員も含まれます。管理監督者も対象です。
          </p>
          <p>
            年5日を取らせる期間は、社員ごとの基準日から1年以内です。基準日は、その社員に年次有給休暇が付与された日を指します。本人が請求して取得した日数と、計画的付与で取得した日数は5日から差し引け、差し引いても足りない分を、会社が本人の意見を聴いたうえで時季を指定して取らせます。
          </p>
          <p>
            正確な取得状況や個別の判断は、自社の就業規則や年次有給休暇管理簿でご確認ください。この点検は、確認の出発点としての一般的な目安です。
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12 border-t border-neutral-200">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">よくある質問</h2>
        <div className="mt-5 space-y-4">
          {FAQS.map((f) => (
            <Card key={f.q} padded>
              <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 関連記事への内部リンク ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-12">
        <Card interactive padded={false}>
          <Link href="/roumu/yukyu-5nichi-gimu" className="block p-5 sm:p-6">
            <p className="text-xs font-medium text-brand-700">関連記事</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              年5日の有給休暇取得義務に中小企業が対応する
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              基準日と取得状況を社員ごとに把握する考え方を、もう少し詳しく整理しています。
            </p>
          </Link>
        </Card>
      </section>

      {/* ===== フッタ ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/business" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <Brain className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/business" className="hover:text-brand-700">サービス概要</Link>
              <Link href="/login?next=/company" className="hover:text-brand-700">ログイン</Link>
              <Link href="/terms" className="hover:text-brand-700">利用規約</Link>
              <Link href="/privacy" className="hover:text-brand-700">プライバシー</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">運営：Kizuna Creation</p>
        </div>
      </footer>
    </div>
  )
}
