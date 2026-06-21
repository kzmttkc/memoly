import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">← トップに戻る</Link>
        <h1 className="text-2xl font-bold text-white mt-4">プライバシーポリシー</h1>
        <p className="text-gray-500 text-sm mt-1">最終更新：2026年6月21日</p>
      </div>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-white font-semibold text-base mb-3">1. 収集する情報</h2>
          <p>Memolyは以下の情報を収集します：</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>メールアドレス（アカウント作成時）</li>
            <li>チャットの会話内容</li>
            <li>AIが抽出した記憶・プロファイル属性（職業・趣味・課題等）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">2. 情報の利用目的</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>サービスの提供・改善</li>
            <li>AIによる個人化された回答の生成</li>
            <li>長期記憶機能の実現</li>
            <li>週次ダイジェストメールの送信（配信停止可能）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">3. 第三者への情報提供</h2>
          <p>以下のサービスを利用しており、データが送信される場合があります：</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li><strong className="text-gray-300">Anthropic（Claude API）</strong>：AI回答生成のため会話内容を送信します。Anthropicのプライバシーポリシーが適用されます。</li>
            <li><strong className="text-gray-300">Supabase</strong>：データベース・認証サービス（米国）</li>
            <li><strong className="text-gray-300">Vercel</strong>：ホスティング・匿名アクセス解析サービス（米国）。Vercel Analyticsによりページビュー等の匿名統計情報を収集することがあります。</li>
            <li><strong className="text-gray-300">Resend</strong>：メール配信サービス（米国）。週次ダイジェストメールの送信に使用します。</li>
          </ul>
          <p className="mt-2 text-gray-500">これらの企業への情報提供は、本サービス提供のために必要な範囲に限定されます。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">4. データの保持期間</h2>
          <p>収集した記憶・プロファイルデータはアカウントが存在する限り保持されます。アカウント削除と同時に全データを削除します。なお、最終ログインから2年間アクティビティがない場合、事前にメールで通知したうえでアカウントおよびデータを削除します。</p>
          <p className="mt-2">Memory Dashboardから個別の記憶・属性をいつでも削除できます。アカウントの完全削除はMemory Dashboard内のアカウント削除機能から実行できます。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">5. メール配信の停止</h2>
          <p>週次ダイジェストメールの配信は、メール末尾の配信停止リンク、または<Link href="/unsubscribe" className="text-violet-400 underline">配信停止ページ</Link>からいつでも停止できます。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">6. Cookieについて</h2>
          <p>本サービスはログイン状態の維持にセッションCookieを使用します。Vercel Analyticsは匿名のページビュー統計を収集することがあります。個人を特定するCookieによるトラッキングは行っていません。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">7. セキュリティ</h2>
          <p>行レベルセキュリティ（RLS）により、ユーザーは自分のデータにのみアクセスできます。通信はHTTPS/TLSで暗号化されています。</p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-base mb-3">8. お問い合わせ</h2>
          <p>プライバシーに関するご質問は <a href="mailto:kazumototakeshi@gmail.com" className="text-violet-400 underline">kazumototakeshi@gmail.com</a> までご連絡ください。</p>
        </section>
      </div>
    </div>
  )
}
