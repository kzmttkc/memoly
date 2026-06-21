import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">← トップに戻る</Link>
        <h1 className="text-2xl font-bold text-white mt-4">利用規約</h1>
        <p className="text-gray-500 text-sm mt-1">最終更新：2026年6月21日</p>
      </div>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-3">1. サービス概要</h2>
          <p>Memoly（以下「本サービス」）は、長期記憶を持つAIチャットアシスタントです。Claude API（Anthropic）を使用してAI回答を生成します。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">2. AIの回答について</h2>
          <p className="text-yellow-400/80">AIの回答は参考情報であり、正確性・完全性を保証するものではありません。医療・法律・財務等の専門的判断が必要な事項については、必ず専門家にご相談ください。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">3. 禁止事項</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>違法行為・犯罪に関する情報の取得</li>
            <li>他者への誹謗中傷・ハラスメント</li>
            <li>未成年者に有害なコンテンツの生成</li>
            <li>本サービスの不正利用・システムへの攻撃</li>
            <li>商業目的での大量利用（事前許可なし）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">4. 免責事項</h2>
          <p>本サービスの利用により生じた損害について、運営者は一切の責任を負いません。サービスは予告なく変更・停止される場合があります。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">5. 知的財産</h2>
          <p>ユーザーが入力したコンテンツの権利はユーザーに帰属します。AIが生成したコンテンツの利用はAnthropicの利用規約に従います。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">6. 準拠法</h2>
          <p>本規約は日本法に準拠します。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">7. お問い合わせ</h2>
          <p><a href="mailto:kazumototakeshi@gmail.com" className="text-violet-400 underline">kazumototakeshi@gmail.com</a></p>
        </section>
      </div>
    </div>
  )
}
