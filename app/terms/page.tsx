import Link from 'next/link'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { PublicHeader } from '@/components/ui/PublicHeader'

export default function TermsPage() {
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
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">利用規約</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年8月23日</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. サービス概要</h2>
            <p>Kabau（カバウ。旧称: 番頭(Banto)。以下「本サービス」）は、就業規則のファイル（または本文）を置くと、書いてあることと書いてないことを1枚にするサービスです。残す操作のあと、その書類を会社の前提として保存し、以後の回答はその書類と労務の事実を前提にします。運営は KIZUNA Creation（Kazumoto Takeshi 個人事業）。<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropic（Claude API）</a>を使用してAI回答を生成します。運営者情報（代表者名・所在地・連絡先）の開示方法は<Link href="/tokushoho" className="text-brand-600 underline">特定商取引法に基づく表記</Link>をご覧ください。</p>
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

          {/* 2026-07-30 法務追加（法務監査 軸E）: Kabauは顧客企業の「従業員等」＝契約者本人
              ではない第三者の個人データを保持する設計（lib/prompts.ts の
              【関係者ごとの状況】ブロックが実在し、AIが人単位で参照する）。労務相談は
              休職・傷病・ハラスメントを含みうるため、要配慮個人情報が入る前提で書く必要がある。
              にもかかわらず本規約には個人データの取扱い委託に関する条項が1つも無く、
              法人の稟議で必須とされる「委託先としての義務の明文化」が欠けていた＝購買ブロッカー。
              本条でその穴を塞ぐ。
              ※条番号の扱い: 個人情報保護法の「委託」「外国にある第三者への提供」「基準適合体制」は
                制度名で記載し、条・項・号の番号は意図的に書いていない（誤記＝虚偽表示になるため、
                外部弁護士の確認が取れるまで番号は入れない方針）。番号を入れる場合は要レビュー。 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. 個人データの取扱い（お客様の従業員等の情報の委託）</h2>
            <p>本サービスは、労務の相談を扱う性質上、お客様（会社）の従業員・役員その他の関係者（以下「従業員等」）に関する情報をお預かりします。その取扱いは以下のとおりです。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.1 委託としての位置づけ</h3>
            <p>お客様が本サービスに入力・登録する従業員等の個人データについて、個人情報取扱事業者としての取扱いの主体はお客様であり、運営者は、お客様から当該個人データの取扱いの委託を受けた委託先として、本サービスの提供に必要な範囲およびお客様の指示の範囲内でのみこれを取り扱います（個人情報保護法上、委託に伴う提供は第三者提供に当たらない類型として扱われるものです）。運営者は、当該個人データを運営者自身の目的のために利用せず、本サービスの提供と無関係な第三者へ提供しません。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.2 お預かりする情報の範囲</h3>
            <p>お客様が入力した従業員等の氏名または呼称、所属・勤務や在籍の状況、相談の経緯などが対象となります。労務相談の性質上、<span className="text-warning-700">休職・傷病・ハラスメント相談など、法令上とくに配慮を要する個人情報（要配慮個人情報）が含まれる場合があります。</span></p>
            {/* 実装事実に基づく記載（lib/memory.ts の抽出プロンプトが、記憶として保存する
                subject に生の氏名・住所・マイナンバー等を書かないようモデルへ明示指示している）。
                「必ず仮名化される」とは書かない（LLM出力のため保証はできない＝過大表示になる）。 */}
            <p className="mt-2">なお、会話から長期記憶を作成する際は、対象者のラベルに生の氏名・住所・マイナンバー等を残さず、イニシャルや役割で記録するようAIに指示しています（AIによる処理のため完全な自動仮名化を保証するものではありません）。マイナンバー（個人番号）およびこれを含む書類の内容は、本サービスに入力しないでください。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.3 再委託先（外部サービス）と目的</h3>
            <p>運営者は、本サービスの提供に必要な範囲で、以下の外部事業者に取扱いを再委託します。各社の所在地・詳細は<Link href="/privacy" className="text-brand-600 underline">プライバシーポリシー</Link>に記載しています。</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">Anthropic・OpenAI（米国）</span>：AIによる回答生成および記憶の意味検索。両社の商用API規約上、送信内容は既定でAIモデルの学習に利用されません。</li>
              <li><span className="text-neutral-800">Dify（米国）</span>：法令ナレッジベースへの照会（法令に関する質問テキストを送信する場合があります）。</li>
              <li><span className="text-neutral-800">Supabase（米国）</span>：データベースおよび認証基盤。</li>
              <li><span className="text-neutral-800">Vercel（米国）</span>：本サービスのホスティング。</li>
              <li><span className="text-neutral-800">Resend（米国）</span>：お知らせ・ダイジェストメールの送信（本文に会社の状況の要約を含む場合があります）。</li>
              <li><span className="text-neutral-800">Stripe（米国）</span>：有料プランの決済処理（決済に必要な情報のみを扱い、相談内容は送信されません）。</li>
              {/* 2026-07-30 法務追加（法務監査#6）: /api/company/weekly-email と
                  /api/company/deadline-reminder が lib/slack.ts 経由で hooks.slack.com へ
                  本文（会社名＋労務の要点）を送るのに、委託先一覧に Slack が無かった。
                  実際に個人データを含みうる本文が国外へ出る経路が、規約にもプライバシー
                  ポリシーにも載っていない状態＝説明した取扱いと実装の不一致。 */}
              <li><span className="text-neutral-800">Slack（米国）</span>：お客様（会社）が管理画面で Incoming Webhook を設定した場合に限り、週次ダイジェストおよび期限リマインドの本文（会社名および労務の要点の要約を含みます）を、お客様が指定した Slack ワークスペースへ送信します。設定を解除すればいつでも停止できます。送信先はお客様がご指定になるため、当該ワークスペースにおける取扱いはお客様の管理下にあります。</li>
            </ul>
            {/* 2026-08-12 法務追加（越境移転レビュー B/E）: 本項の各社はすべて米国所在で
                あり、この記述自体に事実誤りは無い（プライバシーポリシー §3 の一覧には
                Plausible Analytics（エストニア・EU）も含まれるため、そちらは所在国を
                書き分けた）。ただし移転先国の制度に関する情報の開示先が無かったので、
                新設した /privacy の「外国にある第三者への提供（越境移転）について」へ
                導線を張り、3面（日本語/英語のポリシーと本規約）の記載を一致させる。 */}
            <p className="mt-2">これらはいずれも外国にある事業者であるため、外国にある第三者への個人データの提供として、運営者は各社の個人情報の取扱いに関する契約上の定め（データ処理契約・標準契約条項等）の有無と内容を確認し、確認日とともに記録しています。移転先の国、当該国の個人情報の保護に関する制度、運営者が講じている措置（締結手続が完了していない事業者がある旨を含みます）およびご本人のお求めに応じた情報提供については、<Link href="/privacy#cross-border" className="text-brand-600 underline">プライバシーポリシー「外国にある第三者への提供（越境移転）について」</Link>に記載しています。再委託先を変更する場合は、本規約またはプライバシーポリシーの記載を更新します。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.4 安全管理措置</h3>
            <p>運営者は、行レベルセキュリティ（RLS）による会社単位のデータ分離、通信のHTTPS/TLS暗号化、運営者側のアクセス権限の限定などの安全管理措置を講じます。詳細は<Link href="/security" className="text-brand-600 underline">セキュリティとデータ保護</Link>のページをご覧ください。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.5 従業員等ご本人からの請求の窓口</h3>
            <p>従業員等ご本人からの開示・訂正・利用停止・削除等のご請求は、委託元であるお客様（会社）が窓口となって受け付けてください。運営者がご本人から直接ご請求を受けた場合は、原則としてお客様にお取り次ぎします。運営者は、お客様のご指示に従い、対象データの確認・訂正・削除に必要な協力を行います。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.6 契約終了時の取扱い</h3>
            <p>アカウントの削除により、お預かりしたデータは第4条のとおり削除されます。契約終了にあたりデータの返還（お客様への引渡し）をご希望の場合は、お問い合わせ窓口までご連絡ください。対応可能な形式でご提供したうえで消去します。消去の完了について報告をご希望の場合も、同窓口で承ります。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.7 お客様（会社）の責任</h3>
            <p>従業員等の個人情報を本サービスに入力するにあたり、利用目的の特定・通知または公表、必要な場合のご本人の同意の取得（要配慮個人情報を取り扱う場合を含みます）、従業員等への周知、委託先である運営者に対する必要かつ適切な監督など、個人情報取扱事業者として法令上求められる手続は、お客様の責任において行っていただきます。運営者の再委託先が米国に所在することを含め、本条および<Link href="/privacy" className="text-brand-600 underline">プライバシーポリシー</Link>に記載の取扱いを前提にご利用ください。</p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">5.8 覚書の締結</h3>
            <p>本条は、お客様と運営者との間の個人データの取扱いに関する取り決めとして機能します。貴社所定の様式による覚書（個人情報取扱いに関する契約書等）の締結が必要な場合は、<a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> までご相談ください。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. 禁止事項</h2>
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
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. AIコンテンツの報告</h2>
            <p>不適切なAIの回答は、お問い合わせ先（<a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>）へのご連絡で報告できます。報告内容は改善のために使用されます。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. 免責事項</h2>
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
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. 知的財産</h2>
            <p>ユーザーが入力したコンテンツの権利はユーザーに帰属します。AIが生成したコンテンツの利用は<a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropicの商用利用規約</a>に従います。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. 準拠法・合意管轄</h2>
            <p>本規約は日本法に準拠します。</p>
            {/* 2026-07-28 CTO修正（L2監査#8）: 裁判管轄の指定がなく、紛争時にどの
                裁判所を利用するかが不明だった（ペルソナ4指摘）。個人事業の所在地を
                基準に専属的合意管轄を定める。 */}
            <p className="mt-2">
              本サービスに関して運営者とユーザーとの間に生じた紛争については、
              東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          {/* 2026-07-30 法務追加（法務監査#3）: 本規約には定型約款の変更条項が1つも無く、
              民法第548条の4の要件（変更できる旨の定め・周知の方法・効力発生時期）を
              満たしていなかった。この状態では、値上げも免責条項の変更も**既存の契約者には
              及ばない**（新規申込者にしか適用できない）。継続課金型のサービスで料金改定が
              できないのは事業上の致命傷であり、かつ「規約を変えたのだから適用される」と
              運用してしまうと無効な変更を根拠に請求することになる。
              周知期間は不利益変更で30日前とし、その期間内の解約者には変更後の料金を
              適用しないことまで書く（相当性の担保＝548条の4第1項2号の「合理的なもの」の
              判断材料になる）。 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">11. 本規約の変更</h2>
            <p>運営者は、次のいずれかに該当する場合、民法第548条の4の規定に従い、ユーザーの個別の同意を得ることなく本規約を変更することができます。</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li>(1) 本規約の変更が、ユーザーの一般の利益に適合するとき</li>
              <li>(2) 本規約の変更が、契約をした目的に反せず、変更の必要性、変更後の内容の相当性その他の変更に係る事情に照らして合理的なものであるとき</li>
            </ul>
            <p className="mt-2">運営者は、本規約を変更する場合、変更後の本規約の内容および効力発生時期を、効力発生時期が到来する相当な期間前までに、本サービス上またはご登録のメールアドレス宛の通知により周知します。料金の値上げその他ユーザーに不利益となる変更については、効力発生日の30日前までに周知し、効力発生日までに解約のお申し出をいただいた場合、変更後の料金は適用しません。</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">12. お問い合わせ</h2>
            <p><a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a></p>
          </section>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
