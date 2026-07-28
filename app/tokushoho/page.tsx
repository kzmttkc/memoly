import Link from 'next/link'
import { PLANS, PAID_PLAN_IDS } from '@/lib/plans'

// ============================================================================
// 特定商取引法に基づく表記 — 8/5 課金解禁前の法的必須ページ（W3.5a-1）
// ----------------------------------------------------------------------------
// 一次情報照合の記録（2026-07-23 CTO）:
//   消費者庁「特定商取引法ガイド」通信販売の広告表示事項
//   （https://www.no-trouble.caa.go.jp/what/mailorder/ の「広告に表示すべき事項」）
//   と本ページの記載項目を照合済み。網羅する必須項目:
//   1) 販売価格（役務の対価）＝お支払い総額で表示（総額表示義務に対応。
//      Stripe Checkout の請求額 = lib/plans.ts の monthlyJpy/yearlyJpy と同額で、
//      表示価格以外の追加請求は発生しない）
//   2) 代金の支払時期・方法 3) 役務の提供時期 4) 申込みの撤回・解除（解約・返金）
//   5) 事業者の氏名・住所・電話番号 → 特商法第11条ただし書・同施行規則の
//      「消費者からの請求により遅滞なく開示する」省略特例の構成を採用
//      （個人事業者の氏名・住所・電話の常時掲載は Takeshi 決裁が出るまで行わない既定。
//        請求があれば遅滞なく電磁的方法で提供する旨と請求方法を明記＝特例の要件）
//   6) ソフトウェアの動作環境 7) 2回以上継続して契約する場合の販売条件（自動更新）
//   8) 送料（オンラインサービスのため無し）を明記
// 価格の SSOT は lib/plans.ts（2026-06-29 Takeshi 承認の確定構造）。
// 本ページはハードコードせず PLANS を参照し、価格改定時の乖離を構造的に防ぐ。
// 解約条件は実装事実に一致させる: webhook は請求期間中 plan を維持し、
// subscription 終了（customer.subscription.deleted）で free へ降格するため、
// 「請求期間の末日まで利用可・日割り返金なし」が実装と整合する記載。
// ============================================================================

const SUPPORT_EMAIL = 'support@banto-roumu.com'

/** 表形式の1行。特商法の必須項目を dl で列挙する。 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-neutral-100 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
      <dt className="text-sm font-semibold text-neutral-900">{label}</dt>
      <dd className="text-sm leading-relaxed text-neutral-700">{children}</dd>
    </div>
  )
}

export const metadata = {
  title: '特定商取引法に基づく表記 | 番頭',
  description: '番頭（Banto）の特定商取引法に基づく表記です。',
}

export default function TokushohoPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business" className="text-sm text-neutral-500 hover:text-neutral-700">
            トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">特定商取引法に基づく表記</h1>
          <p className="mt-1 text-sm text-neutral-500">最終更新：2026年7月23日</p>
        </div>

        {/* 2026-07-28 CTO修正（L1監査#10）: BILLING_ENABLED は現在 false（意図的に
            8/5まで一時停止中）で、実際に有料プランへ申し込もうとすると決済画面は開けない。
            2026-07-25時点の「現在お申し込みいただけます」という記載は、この一時停止と
            食い違う実態表示だった（ペルソナ2指摘）。実態（一時停止中・無料プランは
            利用可）に合わせて文言を修正する。機能自体（BILLING_ENABLEDの解禁）はここでは
            変更しない。 */}
        <div className="mb-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
          <p>
            番頭（Banto）は無料プランを引き続きご利用いただけます。下記「販売価格」欄の有料プランは、
            現在お申し込みの受付を一時的に停止しています。有料プランのお申し込み手続き
            （クレジットカード情報の入力を含むStripe決済画面での操作）を実際に完了した場合にのみ課金が発生する仕組みで、
            お申し込みの操作をしない限り課金が発生することはありません。受付を再開する際は、このページと料金ページでお知らせします。
          </p>
        </div>

        <dl>
          <Row label="事業者名">KIZUNA Creation（個人事業者）</Row>

          {/* 2026-07-28 CTO修正（L2監査#4）: /terms・/privacy には代表者名
              「Kazumoto Takeshi」を既に明記しているのに、本ページだけ氏名まで
              請求開示制の対象としており、同一サイト内で開示レベルが矛盾していた
              （ペルソナ4指摘）。特定商取引法の請求開示特例は住所・電話番号のみが
              対象で、氏名は常時表示が原則のため、氏名はここでも直接開示し、
              住所・電話番号のみ請求開示のままとする（新規の個人情報開示は行わない
              ＝他ページで既に公開済みの氏名を、この一覧にも一致させるのみ）。 */}
          <Row label="代表者の氏名">Kazumoto Takeshi</Row>

          <Row label="所在地・電話番号">
            個人事業主として運営しているため、特定商取引法の定めに基づき、常時表示ではなく
            消費者からのご請求により遅滞なく開示する方式を採用しています（法令上認められた表示方法です）。
            開示をご希望の方は、下記のお問い合わせ窓口（
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
              {SUPPORT_EMAIL}
            </a>
            ）まで「運営者情報の開示請求」と明記のうえメールでご請求ください。
            電子メールにて遅滞なくお知らせします。
          </Row>

          <Row label="お問い合わせ窓口">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
              {SUPPORT_EMAIL}
            </a>
            （メールでのお問い合わせを受け付けています。原則3営業日以内に返信します）
          </Row>

          <Row label="販売価格">
            <ul className="list-disc space-y-1 pl-5">
              {PAID_PLAN_IDS.map(id => {
                const p = PLANS[id]
                return (
                  <li key={id}>
                    {p.displayName}プラン：月額 &yen;{p.monthlyJpy.toLocaleString()}
                    {p.multiClient
                      ? `（1席あたり・最大${p.seatCap}席・顧問先は最大${p.maxCompanies}社まで登録可能）`
                      : `（1社あたり・利用メンバー${p.seatCap}名まで追加料金なし）`}
                    {p.yearlyJpy != null && (
                      <>
                        ／年額 &yen;{p.yearlyJpy.toLocaleString()}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-2">
              表示価格はいずれも消費税を含むお支払い総額です。表示価格以外の追加料金はかかりません。
              オンラインサービスのため送料はかかりません。
            </p>
          </Row>

          <Row label="代金の支払方法">
            クレジットカード決済（決済代行：Stripe, Inc. の決済システムを利用します）
          </Row>

          <Row label="代金の支払時期">
            初回はお申し込み手続（クレジットカード決済）の完了時にお支払いいただきます。
            2回目以降は、月額プランは初回決済日を基準として1か月ごと、
            年額プランは1年ごとに、ご登録のクレジットカードへ自動的に請求されます（自動更新）。
          </Row>

          <Row label="サービスの提供時期">
            決済完了後、直ちにご利用いただけます。
          </Row>

          <Row label="契約期間・自動更新（継続課金の条件）">
            本サービスは継続課金型（サブスクリプション）です。
            契約期間は月額プランが1か月、年額プランが1年で、
            解約のお手続きがない限り同一条件で自動更新されます。
          </Row>

          <Row label="解約の条件・方法">
            解約はいつでもお申し出いただけます。お問い合わせ窓口（
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
              {SUPPORT_EMAIL}
            </a>
            ）へ、ご契約中のメールアドレスから解約希望の旨をご連絡ください。
            解約のお申し出をいただいた場合、現在お支払い済みの請求期間の末日をもって契約終了となり、
            期間末日まではサービスをご利用いただけます。次回以降の請求は発生しません。
          </Row>

          <Row label="返金の方針（申込みの撤回・解除）">
            サービスの性質上（デジタルコンテンツ・役務の提供）、決済完了後の返金には原則として応じられません。
            請求期間の途中で解約された場合も、日割りによる返金は行いません。
            ただし、当方の責めに帰すべき重大な障害によりサービスを利用できなかった場合、
            または法令上返金が必要とされる場合は、個別に対応いたします。
            通信販売のため、特定商取引法に基づくクーリング・オフの適用はありません。
          </Row>

          <Row label="動作環境">
            インターネット接続環境、および最新版の主要ウェブブラウザ
            （Google Chrome・Microsoft Edge・Safari・Firefox）でご利用いただけます。
            アプリのインストールは不要です。
          </Row>

          <Row label="販売数量・申込みの制限">
            法人・個人事業主のお客さまを対象としたサービスです。
            プランごとの利用人数（席数）の上限は上記「販売価格」欄のとおりです。
          </Row>

          {/* 2026-07-28 CTO修正（L1監査#4）: 個人事業のため正式なSLA（稼働率保証）は
              提供していないが、障害時にどのくらいで気づき・知らせるかの目安が
              どこにも書かれておらず、稟議担当者（ペルソナ4）の判断材料が欠けていた。
              保証ではなく「方針・目安」として明記する（過大な約束はしない）。 */}
          <Row label="障害対応の方針">
            サービスの稼働率を保証するSLAは提供していません（個人事業として運営しています）。
            障害・不具合は監視の仕組みで検知に努め、気づいてから遅くとも1営業日以内を目安に
            お問い合わせ窓口（上記メールアドレス）または本サービスの告知手段でお知らせします。
            重大な障害の解消にかかる時間は内容により変わるため、確定した時間はお約束できません。
          </Row>
        </dl>

        <p className="mt-8 text-xs text-neutral-500">
          本表記に関するご質問は{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          までお寄せください。
        </p>
      </div>
    </div>
  )
}
