import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">プライバシーポリシー</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年6月21日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">事業者情報</h2>
            <ul className="space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">事業者名：</span>Kizuna Creation（責任者 / Kazumoto Takeshi）</li>
              <li><span className="text-neutral-800">代表者：</span>Kazumoto Takeshi</li>
              <li><span className="text-neutral-800">所在地：</span>日本</li>
              <li><span className="text-neutral-800">お問い合わせ：</span><a href="mailto:kazumototakeshi@gmail.com" className="text-brand-600 underline">kazumototakeshi@gmail.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. 収集する情報</h2>
            <p>番頭（Banto）は以下の情報を収集します：</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li>メールアドレス（アカウント作成時）</li>
              <li>会社プロファイル・チャットの相談内容</li>
              <li>AIが抽出した記憶・属性（所定労働時間・休日・規程の状況等）</li>
              <li>サービス利用状況（匿名の統計情報）</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. 情報の利用目的と法的根拠</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>サービスの提供・改善（契約の履行）</li>
              <li>会社ごとに個別化された回答の生成（契約の履行）</li>
              <li>長期記憶機能の実現（契約の履行）</li>
              <li>お知らせメールの送信（正当な利益・配信停止可能）</li>
              <li>セキュリティの確保・不正利用の防止（正当な利益）</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">3. 第三者への情報提供</h2>
            <p>以下のサービスを利用しており、データが送信される場合があります：</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li><strong className="text-neutral-800">Anthropic（Claude API）</strong>：AI回答生成のため相談内容を送信します。<a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropicのプライバシーポリシー</a>が適用されます。</li>
              <li><strong className="text-neutral-800">Supabase</strong>：データベース・認証サービス（米国）。<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Supabaseのプライバシーポリシー</a></li>
              <li><strong className="text-neutral-800">Vercel</strong>：ホスティング・匿名アクセス解析（米国）。Vercel Analyticsによりページビュー等の匿名統計を収集することがあります。</li>
              <li><strong className="text-neutral-800">Resend</strong>：お知らせメールの送信（米国）</li>
            </ul>
            <p className="mt-2 text-neutral-500">これらの第三者への情報提供は本サービス提供に必要な範囲に限定されます。EU/EEA在住の方：上記の第三国移転はGDPR第46条に基づく標準契約条項（SCC）に準拠します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. データの保持期間</h2>
            <p>収集したデータはアカウントが存在する限り保持されます。アカウント削除と同時に全データを削除します。最終ログインから2年間アクティビティがない場合、事前にメールで通知したうえでアカウントおよびデータを削除します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. メール配信の停止</h2>
            <p>お知らせメールの配信は、メール末尾の配信停止リンク、または<Link href="/unsubscribe" className="text-brand-600 underline">配信停止ページ</Link>からいつでも停止できます。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. Cookieについて</h2>
            <p>本サービスはログイン状態の維持にセッションCookieを使用します。個人を特定するCookieによる追跡は行っていません。Vercel Analyticsは匿名のページビュー統計を収集することがあります。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. お客様の権利</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>個人情報の開示・訂正・削除の請求</li>
              <li>処理の制限・異議申立て（GDPR対象者）</li>
              <li>データポータビリティ（GDPR対象者）</li>
            </ul>
            <p className="mt-2">上記権利の行使は <a href="mailto:kazumototakeshi@gmail.com" className="text-brand-600 underline">kazumototakeshi@gmail.com</a> までご連絡ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. セキュリティ</h2>
            <p>行レベルセキュリティ（RLS）により、会社・ユーザーは自分のデータにのみアクセスできます。通信はHTTPS/TLSで暗号化されています。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. お問い合わせ</h2>
            <p><a href="mailto:kazumototakeshi@gmail.com" className="text-brand-600 underline">kazumototakeshi@gmail.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
