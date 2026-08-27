import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

export default function PrivacyPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      {/* 2026-08-12 UXペルソナ監査 R-1/R-2: 規約・セキュリティ系のページだけ
          ヘッダが無く、ここへ着地した稟議担当が料金にも登録にも進めない
          行き止まりだった。公開面と同じ PublicHeader を置く。 */}
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/zure" className="text-sm text-neutral-500 hover:text-neutral-700">
            入口に戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">プライバシーポリシー</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年8月22日</p>
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
            <p>就業規則AIは以下の情報を収集します：</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li>メールアドレス（アカウント作成時）</li>
              <li>会社プロファイル・チャットの相談内容</li>
              <li>AIが抽出した記憶・属性（所定労働時間・休日・規程の状況等）</li>
              {/* 2026-07-30 法務追加（法務監査 軸E）: 就業規則AIは「関係者ごとの状況（人ごとに
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
            <p className="mt-2 text-neutral-600">
              入口で置いた就業規則の本文、または貼った本文は、残す操作の前にサーバへ保存しません。同じブラウザに24時間だけ控え、残す操作のあとで会社の書類へ移します。共有のパソコンでは、残す操作まで画面を閉じないでください。入口の「この控えを消す」で、控えをすぐ消せます。
            </p>
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
              <li><strong className="text-neutral-800">Anthropic（Claude API・米国）</strong>：AI回答生成のため相談内容を送信します。<a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropicのプライバシーポリシー</a>が適用されます。</li>
              <li><strong className="text-neutral-800">Supabase</strong>：データベース・認証サービス（米国）。<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Supabaseのプライバシーポリシー</a></li>
              <li><strong className="text-neutral-800">Vercel</strong>：ホスティング（米国）</li>
              <li><strong className="text-neutral-800">Plausible Analytics</strong>：匿名アクセス解析（EU）。Cookieを使用せず、個人を特定しない形でページビュー等の統計のみを収集します。<a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Plausibleのデータポリシー</a></li>
              <li><strong className="text-neutral-800">Resend</strong>：お知らせメールの送信（米国）</li>
              <li><strong className="text-neutral-800">Dify</strong>：法令ナレッジベースへの照会（米国）。相談内容のうち法令に関する質問テキストを送信する場合があります。</li>
              <li><strong className="text-neutral-800">OpenAI</strong>：記憶の意味検索用のベクトル化（米国）。記憶の要約テキストを送信します。APIで送信されたデータは既定でAIモデルの学習に使用されません。<a href="https://openai.com/policies/api-data-usage-policies" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">OpenAIのAPIデータ利用ポリシー</a></li>
              <li><strong className="text-neutral-800">Stripe</strong>：有料プランの決済処理（米国）。カード情報はStripeが直接取り扱い、就業規則AIのサーバーには保存されません。<a href="https://stripe.com/jp/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Stripeのプライバシーポリシー</a></li>
              {/* 2026-07-30 法務追加（法務監査#6）: weekly-email / deadline-reminder が
                  lib/slack.ts 経由で hooks.slack.com へ本文を送っているのに、本一覧にも
                  /terms 5.3 にも Slack が無かった。実際に外部へ出る経路は必ず書く。 */}
              <li><strong className="text-neutral-800">Slack（米国）</strong>：お客様（会社）が管理画面で Incoming Webhook を設定した場合に限り、週次ダイジェストおよび期限リマインドの本文（会社名および労務の要点の要約を含みます）を、お客様が指定した Slack ワークスペースへ送信します。設定を解除すればいつでも停止できます。送信先はお客様がご指定になるため、当該ワークスペースにおける取扱いはお客様の管理下にあります。</li>
            </ul>
            <p className="mt-2 text-neutral-500">これらの第三者への情報提供は本サービス提供に必要な範囲に限定されます。上記のうち日本国外の事業者への移転については、<a href="#cross-border" className="text-brand-600 underline">4. 外国にある第三者への提供（越境移転）について</a>をご覧ください。</p>
          </section>

          {/* 2026-07-28 CTO修正（L1監査#9）: 日本の個人情報保護法が求める外国第三者提供の
              説明（本人同意・移転先の制度水準）が欠けていた（ペルソナ4/10指摘）。 */}
          {/* 2026-07-30 法務修正（法務監査 軸E）: 外国第三者提供の根拠を「登録者の同意」
              単独で構成していたが、就業規則AIが保持する個人データには、同意した登録者本人では
              ない従業員等のデータが含まれる（lib/prompts.ts の人単位の記憶）。
              登録者の同意は、その第三者である従業員等については論理的に根拠にならない。
              そこで、従業員等のデータについては「お客様（会社）からの委託＋委託先の
              体制確認」を主たる構成とし、登録者本人の情報についての同意の記述は残す
              （二層構成）。実装事実（/signup の consentOk チェックボックス）は変更しない。 */}
          {/* 2026-08-12 法務修正（越境移転レビュー A/B/E）:
              A) 「上記の委託先はいずれも米国に所在します」は事実に反していた。直前の一覧に
                 Plausible Analytics（エストニア・EU）が含まれる。EUは十分性認定国であり、
                 書き分けたほうが規律も軽く自社に有利。各社の所在国は一次情報で確認済み
                 （台帳: docs/compliance/vendor-dpa-register.md）。
              B) 移転先国の個人情報保護制度に関する情報が無く、同意ルートを併記している以上
                 規則17条2項の要求を満たさない疑いがあった。(2) を新設して補う。
              E) この説明は §3 末尾の text-neutral-500 の小さい灰色文字に埋没しており、
                 稟議担当者の目次走査で「無い」と判断されていた（実際に監査が見落とした）。
                 独立した節へ格上げする。以降の節番号を1つずつ繰り下げた。
              ※公開文言では条・項・号の番号を書かない方針を維持する（/terms の注記と同じ理由。
                 誤記は虚偽表示になる）。 */}
          <section id="cross-border" className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. 外国にある第三者への提供（越境移転）について</h2>
            <p>
              本サービスの提供にあたり、お預かりした情報の一部は日本国外の事業者へ移転されます。移転の状況と、運営者が講じている措置は次のとおりです。
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(1) 移転先の国</h3>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">米国</span>：Anthropic、OpenAI、Dify、Supabase、Vercel、Resend、Stripe（およびお客様が Slack 連携を設定した場合の Slack）</li>
              <li><span className="text-neutral-800">エストニア（EU）</span>：Plausible Analytics（Cookie を使用しない匿名の統計のみで、個人を特定する情報は送信されません）</li>
            </ul>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(2) 移転先の国の個人情報の保護に関する制度について</h3>
            <p className="text-neutral-600">
              米国には、日本の個人情報保護法や EU の GDPR のような、民間部門を横断する包括的な個人情報保護法は存在せず、分野別の連邦法と、カリフォルニア州消費者プライバシー法（CCPA／CPRA）をはじめとする州法によって規律されています。また米国は、個人情報保護法上、日本と同等の水準にあると認められる外国（十分性の認定を受けた国）としては指定されていません。加えて、米国では、法執行機関等が一定の要件のもとで事業者に対しデータの開示を求めうる制度（CLOUD Act、外国情報監視法（FISA）第702条等）が存在します。
            </p>
            <p className="mt-2 text-neutral-600">
              EU（エストニア）は、個人情報保護法上、日本と同等の水準にあると認められる外国として指定されています。
            </p>

            {/* 2026-08-12 法務修正（越境移転レビュー D）: ここは元々「各社との契約により
                確認したうえで利用しています」と断定していたが、確認の記録がリポジトリに
                1件も無く、記述の裏付けが取れなかった。そこで一次情報で9社の DPA を実測し
                docs/compliance/vendor-dpa-register.md に台帳化したところ、
                  ・7社は利用規約に DPA が自動組込み（Anthropic/OpenAI/Supabase/Resend/
                    Stripe/Plausible。Slack は再委託先でなく顧客指定の送信先のため対象外）
                  ・Dify は別途署名・メール送付が必要で **未締結**
                  ・Vercel は DPA の適用対象が Enterprise/Pro 限定で、就業規則AIは Hobby プラン
                    のため **未適用の疑い**
                であることが判明した。つまり「いずれも確認済み」は事実に反する（A と同じ
                類型の誤り）。断定を消し、実態どおりに書き分ける。締結手続は Takeshi 手番
                （契約署名・有料プラン移行）として台帳に起票済み。手続完了後にこの段落を
                元の断定形へ戻せる。 */}
            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(3) 運営者が講じている措置</h3>
            <p className="text-neutral-600">
              運営者は、上記の各社について、個人情報の取扱いに関する契約上の定め（データ処理契約・標準契約条項等）の有無と内容を確認し、確認日とともに記録しています（最終確認日：2026年8月12日）。これらの定めの多くは、各社の利用規約の一部として本サービスの利用に自動的に適用されます。一方、別途の締結手続を要する事業者があり、その手続が完了していないものが含まれます。運営者は、確認の状況を少なくとも年1回見直し、相当措置の実施に支障が生じた場合には必要な対応をとり、改善が困難な場合には当該事業者への個人データの提供を停止します。個別の事業者ごとの締結状況は、下記(5)の窓口でご確認いただけます。
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(4) 取扱いの根拠</h3>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>
                <span className="text-neutral-800">お客様（会社）が入力する従業員等の個人情報</span>：お客様からの委託に基づいて取り扱います（<Link href="/terms" className="text-brand-600 underline">利用規約 第5条</Link>）。
                上記の各社への提供は、この委託に伴う再委託として、サービス提供に必要な範囲に限って行います。
                ご本人（従業員等）に対する利用目的の通知・公表や、必要な場合の同意の取得は、委託元であるお客様（会社）が行うものとします。
                ご本人からの開示・訂正・利用停止等のご請求は、まずご所属の会社の窓口へお申し出ください。
              </li>
              <li>
                <span className="text-neutral-800">ご登録者ご本人の情報（メールアドレス等）</span>：上記(3)の体制確認を根拠として取り扱います。あわせて、ご登録時に、利用規約と本ポリシーへの同意をチェックボックスによる能動的な操作で取得しています。
              </li>
            </ul>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(5) ご本人のお求めに応じた情報提供</h3>
            <p className="text-neutral-600">
              ご本人からお求めがあった場合、運営者は、移転先の第三者による相当措置に関して、移転先の国名、当該国の個人情報の保護に関する制度の有無および概要、移転先が講ずる措置の概要、運営者による確認の頻度および方法、相当措置の実施に支障が生じた場合はその内容および運営者が講じた措置について、<a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> にて情報提供します。
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(6) EU/EEA にお住まいの方へ</h3>
            {/* 2026-08-12 法務修正（D の波及）: 「上記の第三国移転は SCC に準拠します」と
                無条件に書いていたが、(3) のとおり DPA が未締結の事業者では SCC も発効して
                いない。同じ誤りをここで繰り返さないよう、(3) と同じ限定を掛ける。 */}
            <p className="text-neutral-600">
              上記の第三国移転のうち、標準契約条項（SCC）を含むデータ処理契約が適用されている事業者への移転は、GDPR 第46条に基づく標準契約条項に準拠します。上記(3)のとおり締結手続が完了していない事業者については、手続の完了をもって同様に取り扱います。なお Plausible Analytics（エストニア）は EU 域内の事業者であり、第三国移転には当たりません。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. データの保持期間</h2>
            <p>収集したデータはアカウントが存在する限り保持されます。アカウント削除と同時に全データを削除します。最終ログインから2年間アクティビティがない場合、事前にメールで通知したうえでアカウントおよびデータを削除します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. メール配信の停止</h2>
            <p>お知らせメールの配信は、メール末尾の配信停止リンク、または<Link href="/unsubscribe" className="text-brand-600 underline">配信停止ページ</Link>からいつでも停止できます。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. Cookieについて</h2>
            <p>本サービスはログイン状態の維持にセッションCookieを使用します。個人を特定するCookieによる追跡は行っていません。アクセス解析にはPlausible Analyticsを使用しており、Cookieを使わず匿名のページビュー統計のみを収集します。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. お客様の権利</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>個人情報の開示・訂正・削除の請求</li>
              <li>処理の制限・異議申立て（GDPR対象者）</li>
              <li>データポータビリティ（GDPR対象者）</li>
            </ul>
            <p className="mt-2">上記権利の行使は <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> までご連絡ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. セキュリティ</h2>
            <p>行レベルセキュリティ（RLS）により、会社・ユーザーは自分のデータにのみアクセスできます。通信はHTTPS/TLSで暗号化されています。対策の詳細は<Link href="/security" className="text-brand-600 underline">セキュリティとデータ保護</Link>のページをご覧ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. お問い合わせ</h2>
            <p><a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>（メールでのお問い合わせを受け付けています。原則3営業日以内に返信します）</p>
          </section>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
