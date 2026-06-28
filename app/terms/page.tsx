import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">利用規約</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年6月21日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. サービス概要</h2>
            <p>番頭（Banto、以下「本サービス」）は、会社のルール・規程・労務を覚えて回答するAIアシスタントです。運営は Kizuna Creation（Kazumoto Takeshi 個人事業）。<a href="https://www.anthropic.com/legal/consumer-usage-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropic（Claude API）</a>を使用してAI回答を生成します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. 利用資格・年齢制限</h2>
            <p className="font-medium text-warning-700">本サービスは13歳以上の方のみご利用いただけます。13歳未満の方はご利用いただけません。</p>
            <p className="mt-2">18歳未満の方は、保護者の同意のもとでご利用ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">3. AIの回答について</h2>
            <p className="text-warning-700">AIの回答は参考情報であり、正確性・完全性を保証するものではありません。医療・法律・財務・労務・社会保険等の専門的判断が必要な事項については、必ず専門家にご相談ください。本サービスを通じて得た労務・社会保険に関する情報は個別の法的判断の根拠とはなりません。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. データの保持期間</h2>
            <p>収集したデータはアカウントが存在する限り保持されます。アカウント削除と同時に全データを削除します。最終ログインから2年間未使用の場合、事前通知の後にデータを削除します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. 禁止事項</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>違法行為・犯罪に関する情報の取得</li>
              <li>他者への誹謗中傷・ハラスメント</li>
              <li>未成年者に有害なコンテンツの生成</li>
              <li>本サービスの不正利用・システムへの攻撃</li>
              <li>商業目的での大量利用（事前許可なし）</li>
              <li>AIの回答を専門的助言として第三者に提供すること</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. AIコンテンツの報告</h2>
            <p>不適切なAIの回答はチャット画面内の「報告」ボタンから報告できます。報告内容は改善のために使用されます。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. 免責事項</h2>
            <p>本サービスの利用により生じた損害について、運営者は一切の責任を負いません。サービスは予告なく変更・停止される場合があります。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. 知的財産</h2>
            <p>ユーザーが入力したコンテンツの権利はユーザーに帰属します。AIが生成したコンテンツの利用は<a href="https://www.anthropic.com/legal/consumer-usage-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropicの利用規約</a>に従います。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. 準拠法</h2>
            <p>本規約は日本法に準拠します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. お問い合わせ</h2>
            <p><a href="mailto:kzmttkc314@gmail.com" className="text-brand-600 underline">kzmttkc314@gmail.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
