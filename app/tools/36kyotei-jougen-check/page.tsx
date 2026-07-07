import type { Metadata } from 'next'
import Link from 'next/link'
import { Brain, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Calculator } from './Calculator'

// ============================================================================
// /tools/36kyotei-jougen-check — 36協定 時間外・休日労働の上限セルフ点検（無料・登録不要）
//   計算はクライアント（Calculator.tsx）で行い、会社データはサーバに送らない。
//   本ページ自体は Server Component（metadata + 静的な説明・FAQを初期HTMLに描画）。
//
//   狙うクエリ:「36協定 上限 無料 チェック」「36協定 時間外労働 上限 点検」
//   「特別条項 月45時間 年720時間 確認」。"無料"修飾子＋具体タスクの勝ちパターンを再現。
//
//   /roumu/[slug] と同じライト基調（.company-light + 白背景）に合わせる。
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言をしない。
// ============================================================================

const BASE = 'https://banto-roumu.com'
const URL = `${BASE}/tools/36kyotei-jougen-check`

export const metadata: Metadata = {
  title: '36協定の時間外・休日労働の上限を無料でセルフ点検｜番頭(Banto)',
  description:
    '36協定の時間外労働の上限（月45時間・年360時間・特別条項の年720時間・単月100時間未満・複数月平均80時間・年6か月）に自社の残業実績が収まっているか、無料でセルフ点検できるツールです。分かる範囲の数字を入れると、確認が要りそうな箇所を画面で整理できます。登録不要・会社データは保存しません。',
  alternates: { canonical: URL },
  openGraph: {
    title: '36協定の時間外・休日労働の上限を無料でセルフ点検｜番頭(Banto)',
    description:
      '自社の残業実績を入れるだけで、36協定の上限（月45時間・年720時間・単月100時間未満ほか）に照らして確認が要りそうな箇所を無料でセルフ点検できます。登録不要・会社データは保存しません。',
    url: URL,
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: `${BASE}/og-image.png`, width: 1200, height: 630, alt: '36協定 時間外・休日労働の上限セルフ点検' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '36協定の時間外・休日労働の上限を無料でセルフ点検｜番頭(Banto)',
    description:
      '自社の残業実績を入れるだけで、36協定の上限に照らして確認が要りそうな箇所を無料でセルフ点検できます。登録不要。',
    images: [`${BASE}/og-image.png`],
  },
}

const FAQS = [
  {
    q: '36協定を結んでいれば残業は何時間でもさせられますか',
    a: '結べば無制限になるわけではありません。時間外労働には原則として1か月45時間・1年360時間という上限があります。繁忙期などにこれを超える見込みがあるときは特別条項付きで一定の範囲まで引き上げられますが、その特別条項でも超えられない線が別に定められています。',
  },
  {
    q: '特別条項でも超えられない上限にはどんなものがありますか',
    a: '一般的な枠組みとして、時間外労働は年720時間以内、時間外労働と休日労働の合計は単月100時間未満、連続する2〜6か月のいずれの平均も月80時間以内、原則の月45時間を超えられるのは年6か月まで、とされています。このツールはこの目安に照らして確認が要りそうな箇所を整理します。',
  },
  {
    q: 'このツールの結果はそのまま社内判断に使えますか',
    a: 'このツールが示すのは、入力した数字にもとづく一般的な目安の整理で、合否や適法性を判定するものではありません。実際の集計期間や休日労働の扱い、複数月平均の取り方によって見え方は変わります。正確な状況は自社の36協定や勤怠記録でご確認いただき、個別の判断が必要な場合は専門家にご相談ください。',
  },
  {
    q: '入力した会社のデータは保存されますか',
    a: '保存しません。入力内容はお使いのブラウザの中だけで計算し、サーバーに送信することはありません。ページを閉じると入力は残りません。',
  },
]

export default function Kyotei36JougenToolPage() {
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
      { '@type': 'ListItem', position: 3, name: '36協定 時間外・休日労働の上限セルフ点検', item: URL },
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
          36協定の時間外・休日労働の上限を無料でセルフ点検する
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          自社の残業の実績を分かる範囲で入れると、36協定の上限（月45時間・年360時間・特別条項の年720時間・単月100時間未満・複数月平均80時間・年6か月）に照らして、確認が要りそうな箇所を画面で整理できます。登録は不要で、入力した会社のデータは保存しません。
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
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">36協定の時間外・休日労働の上限とは</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
          <p>
            36協定（時間外・休日労働に関する協定）を結んで労働基準監督署に届け出ると、法定労働時間を超えて働いてもらうことができます。ただし、協定を結べば残業が無制限になるわけではありません。時間外労働には、原則として1か月45時間・1年360時間という上限が定められています。
          </p>
          <p>
            繁忙期などに原則の上限を超える見込みがある場合は、特別条項付きの36協定を結ぶことで一定の範囲まで引き上げられます。ただし、特別条項を付けても超えられない線が別に定められています。時間外労働は年720時間以内、時間外労働と休日労働の合計は単月100時間未満、連続する2〜6か月のいずれの平均も月80時間以内、そして原則の月45時間を超えられるのは年6か月まで、という枠組みです。
          </p>
          <p>
            このツールは、自社の残業の実績を分かる範囲で入れると、これらの上限の目安に照らして確認が要りそうな箇所を整理します。示すのは違反の判定ではなく、確認の出発点です。実際の集計期間や休日労働の扱い、複数月平均の取り方によって見え方は変わります。
          </p>
          <p>
            正確な状況や個別の判断は、自社の36協定の内容や勤怠記録でご確認ください。この点検は、確認の出発点としての一般的な目安です。
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
          <Link href="/roumu/36kyotei-jougen" className="block p-5 sm:p-6">
            <p className="text-xs font-medium text-brand-700">関連記事</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              36協定の上限規制に中小企業が備える
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              特別条項と月45時間の関係を、自社の前提に当てはめて整理する考え方を、もう少し詳しくまとめています。
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
