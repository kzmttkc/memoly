import Link from 'next/link'

export default function TokushohoPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">特定商取引法に基づく表記</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年7月20日</p>
        </div>

        <div className="space-y-4 text-sm leading-relaxed text-neutral-700">
          <p>
            番頭（Banto）は現在、無料モニター期間として提供しています。有料プランの提供を開始する際に、特定商取引法に基づく事項（事業者名・所在地・連絡先・価格・支払方法・解約条件等）を本ページに掲載します。
          </p>
          <p>
            それ以前でも運営者情報の開示をご希望の場合は、
            <a href="mailto:kzmttkc314@gmail.com" className="text-brand-600 underline">
              kzmttkc314@gmail.com
            </a>
            までご請求いただければ遅滞なくお知らせします。
          </p>
          <p className="text-neutral-500">
            事業者名（屋号）：Kizuna Creation（個人事業者）。代表者の氏名・番地を含む所在地・電話番号は、ご請求があった場合に遅滞なく開示いたします。
          </p>
        </div>
      </div>
    </div>
  )
}
