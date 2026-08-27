import Stripe from 'stripe'
import { PlanId, BillingInterval, priceIdForPlan } from '@/lib/plans'
import { buildBillingReturnUrls } from '@/lib/checkout-url'

// ============================================================================
// lib/stripe.ts — 就業規則AI Stripe クライアント + 席サブスク checkout
// ----------------------------------------------------------------------------
// 秘密の扱い:
//   - STRIPE_SECRET_KEY は **ランタイム env のみ**（git不可・.gitignore で .env* 除外済）。
//   - ビルド時には鍵が無くてもクラッシュしないよう placeholder を入れる
//     （Gokaku 同様。Vercel のビルドステップで env 未注入でも next build を通すため）。
//   - 実際の課金は STRIPE_SECRET_KEY が live/test の実鍵で、かつ BILLING_ENABLED=true の
//     ときだけ起きる（checkout ルートがガード）。
//
// [[project_billing_lifecycle_state]] の既知失敗モードへのガード（コメントで明示）:
//   - amount0 罠: トライアル checkout は amount_total=0 になりうる。就業規則AIは今のところ
//     トライアル無し（無料モニターは Stripe を経由しない）なので 0 は「自製品の課金」と
//     みなさない。将来トライアルを足す場合は webhook 側の amount ガードを見直すこと。
//   - masked鍵: Vercel/Netlify の env は管理画面で値がマスクされ読み戻せない。
//     検証は env を CLI で set → 実トランザクションで確認する（自己申告にしない）。
//   - env反映ラグ: env 変更後デプロイが要る。set 直後の関数はまだ旧値を見ることがある。
//   - 共有Stripeアカウントのクロス配信: LIVE は9製品で共有しており、Stripe は1イベントを
//     購読中の全エンドポイントへ配信する。付与は **price 一致**で決め、metadata.product が
//     他製品を名乗るイベントは拒否する（webhook/transition.ts の resolveCheckoutProduct）。
//     amount は判定に使わない——製品間で衝突する（¥9,800 = 就業規則AI Standard /
//     sharoushi Business / UITruth Pro 等・2026-08-21 実測）。
// ============================================================================

// 'sk_test_placeholder' はビルド専用ダミー。実 checkout では env の実鍵が要る。
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder')

// 製品識別子。webhook のクロス配信ガード(metadata.product)で使う。
export const BANTO_PRODUCT = 'banto'

export interface CreateSeatCheckoutArgs {
  /** 購入する有料プラン。 */
  planId: PlanId
  /** 請求間隔。'month'(既定) | 'year'。年額は年額 Price を持つプランのみ（呼び出し側で検証）。 */
  interval?: BillingInterval
  /**
   * 付与する席数（webhook が companies.seats_purchased に反映＝メンバー参加枠）。
   * 1以上・プランの seatCap 以内は呼び出し側で検証済み前提。
   */
  seats: number
  /**
   * 請求数量（line_items.quantity）。未指定は seats と同値（士業=席課金の従来挙動）。
   * SSOT(docs/BANTO_BILLING_GATE.md §4): シート課金は士業のみ。Entry/Standard は
   * 会社単位の月額のため、呼び出し側が quantity=1・seats=プランの人数枠 を渡す。
   */
  quantity?: number
  /** 課金主体の会社ID（webhook で companies を引く鍵・metadata に必ず載せる）。 */
  companyId: string
  /** 操作した admin ユーザーID（監査用・任意）。 */
  userId: string
  /** 成功/キャンセル後の戻り先（例 https://.../company/billing）。 */
  returnUrl: string
  /** 既存 Stripe 顧客ID（あれば再利用し重複顧客を防ぐ）。 */
  customerId?: string | null
}

/**
 * 席サブスクの Checkout Session を作る。
 *   mode=subscription / line_items=[{price, quantity:seats}]。
 *   price は env(STRIPE_PRICE_*)から引く。未設定なら null を返す（呼び出し側で 503）。
 *   metadata は session と subscription の両方に載せる
 *   （subscription.updated/deleted は session metadata を持たないため）。
 */
// ============================================================================
// 決済直前の法定表示（2026-07-30 法務監査#1 の是正・特定商取引法12条の6）
// ----------------------------------------------------------------------------
//   実測された欠陥: /company/billing にも Checkout にも「自動更新／解約条件／返金／
//   税込」の表示が1件も無く、LPフッターの /tokushoho を能動的に開いた人以外は、
//   自動更新にも返金不可にも一度も触れずに決済完了まで到達できた。
//   特商法12条の6（申込み最終確認画面の表示義務）に真正面から抵触する。
//
//   直し方は Checkout 側に寄せる。理由: 申込みの最終確認画面は Stripe Checkout
//   そのものであり、自社画面に書いても「最終確認画面での表示」にはならないため。
//
//   custom_text.submit … ダッシュボード設定に依存しない。常に付ける。
//   consent_collection.terms_of_service … **既定オフのまま運用する（2026-07-30 実測で確定）。**
//     この機能が読む規約URLは Stripe の「公開情報（Settings → ビジネスの詳細 →
//     公開情報）」にあり、**アカウント単位で1つしか持てない**。当社は Stripe を
//     全製品で共有している（ASSET_REGISTRY.md）ため、ここに banto-roumu.com/terms を
//     入れると **UITruth や MyTone の決済画面にも就業規則AIの規約が出る**。
//     実測: 公開情報のビジネスウェブサイトは https://sharoushi-agent.com/、
//     規約URL・プライバシーURLはどちらも未登録（2026-07-30）。
//
//     法定表示そのものは下の custom_text.submit（セッション単位＝製品ごとに出し分け
//     できる）で満たしている。規約への同意チェックは法令の要求ではないので、
//     「全製品に他製品の規約を出す」より「出さない」を選ぶ。
//     env は残す。将来 Stripe アカウントを製品ごとに分けたら true にできる。
//   文面の出所: /tokushoho（app/tokushoho/page.tsx）の各欄と一字一句の齟齬が
//     出ないようにすること。片方だけ更新すると表示が食い違う。
// ============================================================================

/** 決済ボタン直上に常時出す法定表示（自動更新・総額・解約・返金・インボイス）。 */
const CHECKOUT_SUBMIT_MESSAGE =
  '本プランは自動更新の継続課金です。月額は1か月ごと、年額は1年ごとに、解約のお申し出がない限り同一条件で自動更新されます。' +
  // 2026-08-20 正典整合（business-facts.md 2026-07-30 Takeshi確定）: 当社は消費税の免税事業者。
  // ここは支払総額に消費税区分を付けて表示しており、直後の行で適格請求書を発行できないと
  // 開示していることと自己矛盾していた（免税事業者はその区分を名乗る立場に無い）。
  // 数字と「追加料金なし」の事実は変えず、区分を指す語だけを外す。
  '表示価格はお支払い総額で、追加料金はかかりません。' +
  '解約は support@banto-roumu.com へご契約中のメールアドレスからご連絡ください（原則3営業日以内に処理）。' +
  'お支払い済みの請求期間の末日までご利用でき、日割り返金は行いません。' +
  '当方は適格請求書発行事業者の登録がないため、適格請求書は発行できません。'

/**
 * 規約同意チェックの有効化。**現状は常にオフで運用する**（上の解説参照）。
 * Stripe の規約URLはアカウント単位で1つしか持てず、当社は全製品で共有しているため、
 * 有効化すると他製品の決済画面に就業規則AIの規約が出る。製品ごとにアカウントを分けた日に true。
 */
export function tosConsentEnabled(): boolean {
  return process.env.STRIPE_TOS_CONSENT === 'true'
}

export async function createSeatCheckoutSession(
  args: CreateSeatCheckoutArgs,
): Promise<{ url: string | null } | { error: string }> {
  const interval: BillingInterval = args.interval ?? 'month'
  const priceId = priceIdForPlan(args.planId, interval)
  if (!priceId) {
    // Price 未作成（Takeshi が Stripe で price 発行 → env 投入 前）。
    //   年額要求時に年額 Price 未設定でもここに落ちる（呼び出し側で 503 に写す）。
    return { error: 'PRICE_NOT_CONFIGURED' }
  }

  const metadata: Record<string, string> = {
    product: BANTO_PRODUCT,
    company_id: args.companyId,
    plan: args.planId,
    interval,
    seats: String(args.seats),
    user_id: args.userId,
  }

  // 2026-07-26 CTO緊急修正(verifier検出バグ): returnUrl は呼び出し側(checkout route)で
  //   既に `?companyId=<uuid>` を付与済み。無条件に `?billing=...` を足すと
  //   `?companyId=<uuid>?billing=success` という不正なクエリ文字列（`?`が2つ）になり、
  //   billing クエリが companyId 値の一部として誤解釈される（実測: 403・subscription_started
  //   が構造的に一度も発火しない）。純関数 buildBillingReturnUrls に分離し、
  //   tests/unit/checkout-url.test.ts + scripts/billing_lifecycle_e2e.mjs の
  //   両方から継続的に再発検知する（lib/checkout-url.ts のコメント参照）。
  const { successUrl, cancelUrl } = buildBillingReturnUrls(args.returnUrl)

  // 規約同意チェック（ダッシュボードに規約URL登録済みのときだけ env で有効化）。
  //   terms_of_service_acceptance の custom_text は consent_collection とセットでないと
  //   Stripe に拒否されるため、必ず同じ条件でまとめて付ける。
  const consent = tosConsentEnabled()
    ? {
        consent_collection: { terms_of_service: 'required' as const },
        termsCustomText: {
          terms_of_service_acceptance: {
            message:
              '[利用規約](https://banto-roumu.com/terms)および' +
              '[特定商取引法に基づく表記](https://banto-roumu.com/tokushoho)に同意します。',
          },
        },
      }
    : { consent_collection: undefined, termsCustomText: {} }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // 請求数量: 会社単位プラン(Entry/Standard)は 1、席課金(士業)は席数。
    line_items: [{ price: priceId, quantity: args.quantity ?? args.seats }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: true,
    // 決済画面を日本語に固定（法定表示を日本語で読ませるため）。
    locale: 'ja',
    ...(consent.consent_collection
      ? { consent_collection: consent.consent_collection }
      : {}),
    custom_text: {
      ...consent.termsCustomText,
      // 特商法12条の6: 申込み最終確認画面での自動更新・総額・解約・返金の表示。
      submit: { message: CHECKOUT_SUBMIT_MESSAGE },
    },
    // 既存顧客があれば再利用（再課金時の重複顧客作成を防ぐ）。
    ...(args.customerId ? { customer: args.customerId } : {}),
    subscription_data: { metadata },
  })

  return { url: session.url }
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId)
}
