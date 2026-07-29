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
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年7月30日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">事業者情報</h2>
            <ul className="space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">事業者名：</span>KIZUNA Creation（責任者 / Kazumoto Takeshi）</li>
              <li><span className="text-neutral-800">代表者：</span>Kazumoto Takeshi</li>
              {/* 2026-07-30 法務追加（法務監査 軸E）: 「所在地：日本」だけでは、個人情報の
                  取扱事業者の所在地を確認したい稟議担当者が行き止まりになる。所在地は
                  /tokushoho の請求開示方式（特商法の省略特例）で開示しているので、そこへ
                  導線を1行足す。新たな個人情報の常時掲載は行わない（Takeshi 決裁の既定を維持）。 */}
              <li>
                <span className="text-neutral-800">所在地：</span>日本（個人事業者のため常時表示はしていません。
                <Link href="/tokushoho" className="text-brand-600 underline">特定商取引法に基づく表記</Link>
                に記載の方法でご請求いただければ、遅滞なく開示します）
              </li>
              <li><span className="text-neutral-800">お問い合わせ：</span><a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. 収集する情報</h2>
            <p>番頭（Banto）は以下の情報を収集します：</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li>メールアドレス（アカウント作成時）</li>
              <li>会社プロファイル・チャットの相談内容</li>
              <li>AIが抽出した記憶・属性（所定労働時間・休日・規程の状況等）</li>
              {/* 2026-07-30 法務追加（法務監査 軸E）: 番頭は「関係者ごとの状況（人ごとに
                  覚えていること）」を保持する設計（lib/prompts.ts）で、実際には契約者本人では
                  ない従業員等の個人情報を扱う。ところが本項にその類型が1つも書かれておらず、
                  実装と収集項目の開示が食い違っていた。労務相談の性質上、要配慮個人情報が
                  含まれうることも明記する（黙っているほうが重い不利益になる）。 */}
              <li>
                お客様（会社）が入力する従業員・役員その他の関係者の個人情報（氏名または呼称、所属・勤務や在籍の状況、相談の経緯等）。
                労務相談の性質上、<span className="text-warning-700">休職・傷病・ハラスメント相談など、法令上とくに配慮を要する個人情報（要配慮個人情報）が含まれる場合があります。</span>
                これらは、お客様からの委託を受けて取り扱います（<Link href="/terms" className="text-brand-600 underline">利用規約 第5条</Link>）。
              </li>
              <li>サービス利用状況（匿名の統計情報）</li>
            </ul>
            <p className="mt-2 text-neutral-500">なお、会話から長期記憶を作成する際は、対象者のラベルに生の氏名・住所・マイナンバー等を残さず、イニシャルや役割で記録するようAIに指示しています（AIによる処理のため、完全な自動仮名化を保証するものではありません）。マイナンバー（個人番号）およびこれを含む書類の内容は入力しないでください。</p>
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
              <li><strong className="text-neutral-800">Vercel</strong>：ホスティング（米国）</li>
              <li><strong className="text-neutral-800">Plausible Analytics</strong>：匿名アクセス解析（EU）。Cookieを使用せず、個人を特定しない形でページビュー等の統計のみを収集します。<a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Plausibleのデータポリシー</a></li>
              <li><strong className="text-neutral-800">Resend</strong>：お知らせメールの送信（米国）</li>
              <li><strong className="text-neutral-800">Dify</strong>：法令ナレッジベースへの照会（米国）。相談内容のうち法令に関する質問テキストを送信する場合があります。</li>
              <li><strong className="text-neutral-800">OpenAI</strong>：記憶の意味検索用のベクトル化（米国）。記憶の要約テキストを送信します。APIで送信されたデータは既定でAIモデルの学習に使用されません。<a href="https://openai.com/policies/api-data-usage-policies" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">OpenAIのAPIデータ利用ポリシー</a></li>
              <li><strong className="text-neutral-800">Stripe</strong>：有料プランの決済処理（米国）。カード情報はStripeが直接取り扱い、番頭のサーバーには保存されません。<a href="https://stripe.com/jp/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Stripeのプライバシーポリシー</a></li>
            </ul>
            <p className="mt-2 text-neutral-500">これらの第三者への情報提供は本サービス提供に必要な範囲に限定されます。EU/EEA在住の方：上記の第三国移転はGDPR第46条に基づく標準契約条項（SCC）に準拠します。</p>
            {/* 2026-07-28 CTO修正（L1監査#9）: 日本の個人情報保護法が求める外国第三者提供の
                説明（本人同意・移転先の制度水準）が欠けていた（ペルソナ4/10指摘）。 */}
            {/* 2026-07-30 法務修正（法務監査 軸E）: 外国第三者提供の根拠を「登録者の同意」
                単独で構成していたが、番頭が保持する個人データには、同意した登録者本人では
                ない従業員等のデータが含まれる（lib/prompts.ts の人単位の記憶）。
                登録者の同意は、その第三者である従業員等については論理的に根拠にならない。
                そこで、従業員等のデータについては「お客様（会社）からの委託＋委託先の
                体制確認」を主たる構成とし、登録者本人の情報についての同意の記述は残す
                （二層構成）。実装事実（/signup の consentOk チェックボックス）は変更しない。 */}
            <p className="mt-2 text-neutral-500">
              日本の個人情報保護法（外国にある第三者への提供）に基づく説明: 上記の委託先はいずれも米国に所在します。取扱いの根拠は、対象となる情報によって次のとおり異なります。
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-500">
              <li>
                <span className="text-neutral-800">お客様（会社）が入力する従業員等の個人情報</span>：お客様からの
                <span className="text-neutral-800">委託</span>に基づいて取り扱います（<Link href="/terms" className="text-brand-600 underline">利用規約 第5条</Link>）。
                上記の各社への提供は、この委託に伴う再委託として、サービス提供に必要な範囲に限って行います。
                運営者は、各社が個人情報の取扱いについて適切な措置を継続的に講じる体制にあることを、各社の契約上の義務づけ（データ処理契約・標準契約条項等）により確認したうえで利用しています。
                ご本人（従業員等）に対する利用目的の通知・公表や、必要な場合の同意の取得は、委託元であるお客様（会社）が行うものとします。
                ご本人からの開示・訂正・利用停止等のご請求は、まずご所属の会社の窓口へお申し出ください。
              </li>
              <li>
                <span className="text-neutral-800">ご登録者ご本人の情報（メールアドレス等）</span>：本サービスへのご登録時に、利用規約とあわせて本ポリシーへの同意をチェックボックスによる能動的な操作で取得しており、
                この明示的な同意に基づいて取り扱います。同意の撤回・詳細の確認をご希望の場合は、下記お問い合わせ窓口までご連絡ください。
              </li>
            </ul>
            <p className="mt-2 text-neutral-500">
              いずれの場合も、提供先での個人情報の取扱いに関する情報（各社のプライバシーポリシー・所在国）は上記のとおり開示しており、追加のご確認をご希望の場合はお問い合わせ窓口で承ります。
            </p>
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
            <p>本サービスはログイン状態の維持にセッションCookieを使用します。個人を特定するCookieによる追跡は行っていません。アクセス解析にはPlausible Analyticsを使用しており、Cookieを使わず匿名のページビュー統計のみを収集します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. お客様の権利</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>個人情報の開示・訂正・削除の請求</li>
              <li>処理の制限・異議申立て（GDPR対象者）</li>
              <li>データポータビリティ（GDPR対象者）</li>
            </ul>
            <p className="mt-2">上記権利の行使は <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> までご連絡ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. セキュリティ</h2>
            <p>行レベルセキュリティ（RLS）により、会社・ユーザーは自分のデータにのみアクセスできます。通信はHTTPS/TLSで暗号化されています。対策の詳細は<Link href="/security" className="text-brand-600 underline">セキュリティとデータ保護</Link>のページをご覧ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. お問い合わせ</h2>
            <p><a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>（メールでのお問い合わせを受け付けています。原則3営業日以内に返信します）</p>
          </section>
        </div>
      </div>
    </div>
  )
}
