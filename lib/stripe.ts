import Stripe from 'stripe'
import { PlanId, BillingInterval, priceIdForPlan } from '@/lib/plans'

// ============================================================================
// lib/stripe.ts — 番頭(Banto) Stripe クライアント + 席サブスク checkout
// ----------------------------------------------------------------------------
// 秘密の扱い:
//   - STRIPE_SECRET_KEY は **ランタイム env のみ**（git不可・.gitignore で .env* 除外済）。
//   - ビルド時には鍵が無くてもクラッシュしないよう placeholder を入れる
//     （Gokaku 同様。Vercel のビルドステップで env 未注入でも next build を通すため）。
//   - 実際の課金は STRIPE_SECRET_KEY が live/test の実鍵で、かつ BILLING_ENABLED=true の
//     ときだけ起きる（checkout ルートがガード）。
//
// [[project_billing_lifecycle_state]] の既知失敗モードへのガード（コメントで明示）:
//   - amount0 罠: トライアル checkout は amount_total=0 になりうる。番頭は今のところ
//     トライアル無し（無料モニターは Stripe を経由しない）なので 0 は「自製品の課金」と
//     みなさない。将来トライアルを足す場合は webhook 側の amount ガードを見直すこと。
//   - masked鍵: Vercel/Netlify の env は管理画面で値がマスクされ読み戻せない。
//     検証は env を CLI で set → 実トランザクションで確認する（自己申告にしない）。
//   - env反映ラグ: env 変更後デプロイが要る。set 直後の関数はまだ旧値を見ることがある。
//   - 共有Stripeアカウントのクロス配信: sharoushi/fukuai/gokaku と同居しうる。
//     metadata.product='banto' + price一致 + amount一致 の三重ガードで自製品のみ付与。
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
  //   既に `?companyId=<uuid>` を付与済み。ここで無条件に `?billing=...` を足すと
  //   `?companyId=<uuid>?billing=success` という不正なクエリ文字列（`?`が2つ）になり、
  //   billing クエリが companyId 値の一部として誤解釈される（実測: 403・subscription_started
  //   が構造的に一度も発火しない）。returnUrl が既にクエリを持つかで `&`/`?` を出し分ける。
  const separator = args.returnUrl.includes('?') ? '&' : '?'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // 請求数量: 会社単位プラン(Entry/Standard)は 1、席課金(士業)は席数。
    line_items: [{ price: priceId, quantity: args.quantity ?? args.seats }],
    success_url: `${args.returnUrl}${separator}billing=success`,
    cancel_url: `${args.returnUrl}${separator}billing=canceled`,
    metadata,
    allow_promotion_codes: true,
    // 既存顧客があれば再利用（再課金時の重複顧客作成を防ぐ）。
    ...(args.customerId ? { customer: args.customerId } : {}),
    subscription_data: { metadata },
  })

  return { url: session.url }
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId)
}
