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
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年7月28日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. サービス概要</h2>
            <p>番頭（Banto、以下「本サービス」）は、会社のルール・規程・労務を覚えて回答するAIアシスタントです。運営は KIZUNA Creation（Kazumoto Takeshi 個人事業）。<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropic（Claude API）</a>を使用してAI回答を生成します。運営者情報（代表者名・所在地・連絡先）の開示方法は<Link href="/tokushoho" className="text-brand-600 underline">特定商取引法に基づく表記</Link>をご覧ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. 利用資格</h2>
            <p className="font-medium text-warning-700">本サービスは、事業のために利用する18歳以上の事業者（法人および個人事業主を含みます）のみご利用いただけます。</p>
            <p className="mt-2">消費者としての個人利用は対象外です。登録時に「事業者として利用します（18歳以上）」への同意をお願いしています。</p>
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
            <p>不適切なAIの回答は、お問い合わせ先（<a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>）へのご連絡で報告できます。報告内容は改善のために使用されます。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. 免責事項</h2>
            {/* 2026-07-28 CTO修正（L2監査#8）: 「一切の責任を負いません」という無制限の
                完全免責は、内部統制を重視する検討者（ペルソナ4）にとって懸念材料になる
                だけでなく、事業者間契約でも過度に一方的な免責は無効と判断されうる。
                個人事業として提供できる常識的な水準（故意・重過失は免責しない／
                賠償額はお支払いいただいた利用料金相当額を上限とする）へ改める。 */}
            <p>
              運営者の故意または重過失による場合を除き、本サービスの利用により生じた損害についての
              運営者の賠償責任は、損害の原因となった事由が発生した月に貴社が本サービスに対してお支払い
              いただいた利用料金相当額（無料プランでのご利用の場合は0円）を上限とします。
              サービスは予告なく変更・停止される場合があります。
            </p>
            <p className="mt-2">
              障害対応の方針（稼働率保証(SLA)は提供していないこと・障害検知から通知までの目安時間）は
              <Link href="/tokushoho" className="text-brand-600 underline">特定商取引法に基づく表記</Link>の「障害対応の方針」に記載しています。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. 知的財産</h2>
            <p>ユーザーが入力したコンテンツの権利はユーザーに帰属します。AIが生成したコンテンツの利用は<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropicの商用利用規約</a>に従います。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. 準拠法・合意管轄</h2>
            <p>本規約は日本法に準拠します。</p>
            {/* 2026-07-28 CTO修正（L2監査#8）: 裁判管轄の指定がなく、紛争時にどの
                裁判所を利用するかが不明だった（ペルソナ4指摘）。個人事業の所在地を
                基準に専属的合意管轄を定める。 */}
            <p className="mt-2">
              本サービスに関して運営者とユーザーとの間に生じた紛争については、
              東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. お問い合わせ</h2>
            <p><a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
