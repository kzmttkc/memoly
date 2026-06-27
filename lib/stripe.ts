import Stripe from 'stripe'
import { PlanId, priceIdForPlan } from '@/lib/plans'

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
  /** 席数（quantity）。1以上・プランの seatCap 以内は呼び出し側で検証済み前提。 */
  seats: number
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
  const priceId = priceIdForPlan(args.planId)
  if (!priceId) {
    // Price 未作成（Takeshi が Stripe で price 発行 → env 投入 前）。
    return { error: 'PRICE_NOT_CONFIGURED' }
  }

  const metadata: Record<string, string> = {
    product: BANTO_PRODUCT,
    company_id: args.companyId,
    plan: args.planId,
    seats: String(args.seats),
    user_id: args.userId,
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: args.seats }],
    success_url: `${args.returnUrl}?billing=success`,
    cancel_url: `${args.returnUrl}?billing=canceled`,
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
