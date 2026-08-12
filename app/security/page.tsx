import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

// ============================================================================
// /security — セキュリティとデータ保護の説明ページ（F05・2026-07-23 新設）
// ----------------------------------------------------------------------------
//   目的: 「会社の労務データを預けて大丈夫か」という導入前の最大の不安に、
//   実装済みの事実だけで答える公開ページ（Phase1コンプラ・誇張禁止）。
//   認証や第三者機関の取得を示唆する表現（ISO/SOC2等）は一切使わない。
//   記載は本リポジトリの実装（RLS・CSP/HSTS・監査ログ・エクスポート・削除API）と
//   プライバシーポリシーの記載に一致させる。実装が変わったらここも必ず更新する。
// ============================================================================

export const metadata: Metadata = {
  title: 'セキュリティとデータ保護 | 番頭(Banto)',
  description:
    '番頭(Banto)のセキュリティ対策の説明。会社ごとのデータ分離(RLS)、暗号化、AI学習への不使用、データの保持期間・エクスポート・削除、委託先の一覧。',
  alternates: { canonical: '/security' },
}

export default function SecurityPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      {/* 2026-08-12 UXペルソナ監査 R-1/R-2: 規約・セキュリティ系のページだけ
          ヘッダが無く、ここへ着地した稟議担当が料金にも登録にも進めない
          行き止まりだった。公開面と同じ PublicHeader を置く。 */}
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">セキュリティとデータ保護</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年7月23日</p>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600">
            番頭は、会社の規程や労務相談という機微な情報をお預かりするサービスです。このページでは、実際に実装している保護の仕組みを、誇張なくそのまま説明します。
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. 会社ごとのデータ分離（RLS）</h2>
            <p>
              番頭のデータベースは、行レベルセキュリティ（RLS：Row Level Security）という仕組みで、データの1行1行に「どの会社のものか」を持たせ、データベース自体が「その会社のメンバー以外は読めない・書けない」を強制しています。
            </p>
            <p className="mt-2">
              たとえるなら、ビルの入口の鍵（ログイン）とは別に、部屋ごとの金庫（各社のデータ）にそれぞれ鍵がかかっている状態です。アプリケーションの不具合があっても、データベース層の権限チェックが最後の壁として他社データへのアクセスを遮断します。自社ルール・相談履歴・取込済み規程・期限・監査ログのすべてがこの分離の対象です。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. AIの学習に使われません</h2>
            <p>
              AI回答の生成にはAnthropic社のClaude APIを使用しています。Anthropic社の商用API規約では、APIで送信されたデータは既定でAIモデルの学習に使用されません。お客様の相談内容や規程が、他社への回答やAIモデルの改善に流用されることはありません。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">3. 通信と基盤の保護</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>通信はすべてHTTPS/TLSで暗号化しています。HSTS（HTTP Strict Transport Security）を有効にし、ブラウザに常時HTTPS接続を強制しています。</li>
              <li>Content Security Policy（CSP）等のセキュリティヘッダを設定し、第三者スクリプトの実行やクリックジャッキングを制限しています。</li>
              <li>AIを呼び出すAPIには利用回数の上限（レート制限）を設け、異常な連続アクセスを遮断します。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. プロンプトインジェクションへの方針</h2>
            <p>
              アップロードされた規程や登録データの中に「これまでの指示を無視して」のようなAIへの指示文が紛れ込んでいても、番頭はそれを指示として実行せず、点検・参照対象のデータとしてのみ扱うよう、AIへの指示を明示的に分離・防御しています。外部から取り込んだ文書がAIの動作を乗っ取ることを防ぐための多層的な対策で、継続的に強化しています。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. データの保持期間と削除</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>お預かりしたデータは、アカウントが存在する限り保持されます。</li>
              <li>アカウントを削除すると、会社のデータ（相談履歴・記憶・規程・期限）は他のメンバーが残っていない限り即時に削除されます。</li>
              <li>最終ログインから2年間利用がない場合は、事前にメールで通知したうえでアカウントとデータを削除します。</li>
              <li>削除のご依頼・ご相談は <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> でも受け付けています。</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. データはお客様のものです（エクスポート）</h2>
            <p>
              管理者は、設定画面（プランと設定）からいつでも自社データ一式（自社ルール・記憶・取込規程・期限・相談履歴）をJSON形式でダウンロードできます。解約を難しくするためのデータの抱え込みはしません。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. 操作の監査ログ</h2>
            <p>
              メンバーの招待、規程・記憶の削除、データのエクスポート、APIキーの発行・失効などの重要な操作は、追記専用（後から書き換え・削除ができない）の監査ログに記録され、管理者が設定画面から確認できます。
            </p>
            <p className="mt-2">
              公開API（読み取り専用）のAPIキーは管理者のみが発行でき、サーバーにはハッシュ化した値だけを保存します（発行後の再表示はできません）。Slack連携のWebhook URLも秘匿情報として扱い、画面への再表示・エクスポートの対象にはしません。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. 委託先の一覧</h2>
            <p>サービスの提供に必要な範囲で、次の外部サービスを利用しています。</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li><span className="font-medium text-neutral-800">Supabase</span>（米国）：データベース・認証</li>
              <li><span className="font-medium text-neutral-800">Anthropic</span>（米国）：AI回答の生成（Claude API・学習不使用）</li>
              <li><span className="font-medium text-neutral-800">Dify</span>（米国）：法令ナレッジへの照会（相談テキストの該当部分を送信）</li>
              <li><span className="font-medium text-neutral-800">OpenAI</span>（米国）：記憶の意味検索用のベクトル化（APIデータは既定で学習不使用）</li>
              <li><span className="font-medium text-neutral-800">Vercel</span>（米国）：ホスティング</li>
              <li><span className="font-medium text-neutral-800">Resend</span>（米国）：メール送信</li>
              <li><span className="font-medium text-neutral-800">Stripe</span>（米国）：決済（有料プラン利用時。カード番号は番頭のサーバーを通りません）</li>
              <li><span className="font-medium text-neutral-800">Plausible Analytics</span>（EU）：匿名のアクセス解析（Cookie不使用）</li>
            </ul>
            {/* 2026-08-12 法務追加（越境移転レビュー E）: 本ページの所在国表記は実測と一致
                しており（Plausible は EU）修正不要。ただし移転先国の制度・運営者の措置・
                ご本人への情報提供窓口は /privacy に新設した節にしか無いので導線を張る。 */}
            <p className="mt-2 text-neutral-500">
              詳細は<Link href="/privacy" className="text-brand-600 underline">プライバシーポリシー</Link>をご覧ください。上記のうち米国所在の各社への個人データの移転については、<Link href="/privacy#cross-border" className="text-brand-600 underline">「外国にある第三者への提供（越境移転）について」</Link>をご覧ください。
            </p>
          </section>

          {/* 2026-08-13 UXペルソナ監査 2-5 の是正:
              このページには「第三者の監査を受けているのか」に答える記述が1件も無く、
              導入検討者から見ると触れていないこと自体が隠しているように読める
              （grep 実測: 該当語 0件）。取得の有無ではなく **この記述の根拠** を
              明示する形で答える。ブランド規定（brand.md）により、運営者自身の
              資格・監修・登録状態には肯定形でも否定形でも触れない。 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. この記載の根拠について</h2>
            <p>
              本ページの内容は、いずれも当社が実装済みの内容を自ら記載したものです。外部機関による監査・認証を受けたものではありません。記載の裏付けが必要な場合は、下記の窓口へご照会ください。実装が変わった際は本ページも更新します。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. 脆弱性のご報告・お問い合わせ</h2>
            <p>
              セキュリティ上の問題を発見された場合や、データの取り扱いについてのご質問は <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> までご連絡ください。確認のうえ誠実に対応します。
            </p>
          </section>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
