import type { PlanId } from '@/lib/plans'

// ============================================================================
// transition.ts — Stripe イベント → (plan, status) 遷移の**純関数**
// ----------------------------------------------------------------------------
// なぜ切り出すか:
//   webhook/route.ts は Stripe SDK と Supabase に密結合していて単体テストできない。
//   一方で「どのイベントでプランを維持し、どこで free に落とすか」は課金の中核ロジックで、
//   ここが1行ずれると (a)有料機能の無償付与 (b)正常顧客の誤降格 のどちらかが起きる。
//   判定だけを DB/SDK 非依存の純関数へ出し、tests/unit/billing-webhook.test.ts で固定する。
//
// この層は「決める」だけで「書かない」。DB 反映は route.ts の責務。
// ============================================================================

/** companies.status が取りうる値（company_schema.sql の CHECK と一致）。 */
export type BillingStatus = 'active' | 'past_due' | 'canceled'

/** 有料プラン（free 以外）。metadata.plan の検証に使う。 */
const PAID_PLAN_IDS: readonly string[] = ['starter', 'standard', 'shigyo']

/** 文字列が有料 PlanId か。metadata 由来の値を信用する前に必ず通す。 */
export function isPaidPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && PAID_PLAN_IDS.includes(v)
}

/**
 * 自製品(Kabau)の刻印。checkout が session/subscription の metadata に載せる値
 * （lib/stripe.ts の BANTO_PRODUCT と同一。ここは SDK 非依存に保つため再定義）。
 */
export const BANTO_PRODUCT_STAMP = 'banto'

export type CheckoutRefusalReason = 'foreign_product' | 'no_matching_price'

export type CheckoutProductResolution =
  | { granted: true; plan: PlanId }
  | { granted: false; reason: CheckoutRefusalReason }

/**
 * この checkout がKabauの決済かを判定する（クロス配信ガード・2026-08-21 横断監査）。
 *
 * なぜ作り直したか:
 *   LIVE の Stripe アカウントは9製品で共有していて、Stripe は1イベントを
 *   「その種別を購読している全ての有効エンドポイント」へ配信する。他製品の
 *   checkout.session.completed はKabauの webhook にも届き、署名検証を通過する
 *   （署名はアカウント単位の秘密で、製品は何も保証しない）。
 *
 *   旧実装は route.ts に
 *       if (!isBanto && !priceMatch && !amountMatch) → 無視
 *   と書かれていた。コメントは「三重ガード」と称していたが、これは
 *   **3つのうち1つでも当たれば通る OR** で、AND ではない。しかも金額は製品を
 *   またいで衝突する（実測: ¥9,800 = Kabau Standard / sharoushi Business /
 *   UITruth Pro、¥29,800 = Kabau 士業 / sharoushi 年払い / UITruth Starter年、
 *   ¥39,800 = Kabau Entry年 / Agentrix Agency月）。つまり amount 一致は
 *   「他製品でない」ことを1ミリも保証しない。
 *
 *   実害が出ていなかったのは metadata.company_id を他製品が偶然使っていない
 *   おかげで、ガードの強さではなかった。
 *
 * 判定順:
 *   1. metadata.product が他製品を名乗る → price が偶然一致しても拒否。
 *      名乗りと price が食い違う決済は異常系であり、「付与しない」側に倒す
 *      （誤付与は返金では取り戻せない）。
 *   2. price がKabauのものに解決できる → そのプランを付与。
 *   3. それ以外は拒否。metadata.plan は根拠にしない——'standard' はKabauにも
 *      UITruth にも実在する。
 *
 * 呼び出し側の責務: pricePlan は planIdForPriceId(line item の price) の結果を渡す。
 * **line items を引けなかったときは pricePlan=null で呼ばず、5xx を返して Stripe に
 * 再送させること**（一時障害で正規顧客が無付与のまま確定するのを防ぐ）。
 */
export function resolveCheckoutProduct(input: {
  metadata: Record<string, string> | null | undefined
  pricePlan: PlanId | null
}): CheckoutProductResolution {
  const product = input.metadata?.product?.trim()
  if (product && product !== BANTO_PRODUCT_STAMP) {
    return { granted: false, reason: 'foreign_product' }
  }
  if (input.pricePlan) return { granted: true, plan: input.pricePlan }
  return { granted: false, reason: 'no_matching_price' }
}

/**
 * checkout.session.completed で実際に入金されたか。
 *   Stripe の Checkout Session は「完了したが未入金」でも completed が飛ぶ
 *   （payment_status='unpaid'。銀行振込等の遅延決済や、支払い方法の確保のみのケース）。
 *   payment_status を見ずに付与すると、入金されないまま有料プランが立つ。
 *   'no_payment_required' は金額0や既存クレジットで充当されたケース＝正当な付与対象。
 */
export function isCheckoutPaid(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required'
}

/** customer.subscription.* の判定に必要な入力（Stripe SDK 型に依存しない素の形）。 */
export interface SubscriptionSnapshot {
  /** Stripe subscription.status（active/trialing/past_due/canceled/unpaid/paused 等）。 */
  status: string
  /**
   * subscription.pause_collection が設定されているか（＝請求の一時停止中）。
   * Stripe で「支払いを一時停止」すると **status は active のまま** 請求だけ止まる。
   * status しか見ないと、無期限に無料で有料機能を使える穴になる（2026-07-30 監査 #4）。
   */
  pausedCollection: boolean
  /** items[0].price → PlanId の逆引き結果（解決できなければ null）。 */
  pricePlan: PlanId | null
  /** subscription.metadata.plan（検証前の生値）。 */
  metadataPlan: unknown
}

export interface SubscriptionTransition {
  /**
   * 反映すべき plan。**null は「解決できないので plan を書き換えない」**を意味する。
   * 解決不能時に有料プランへ倒すと、Price ID を差し替えただけで無償付与が起きる
   * （2026-07-30 監査 #3。旧実装は最終フォールバックが 'standard'＝¥9,800 相当）。
   * 「分からないときは触らない」を既定にし、呼び出し側は console.error を出す。
   */
  plan: PlanId | null
  /** 反映すべき companies.status。 */
  status: BillingStatus
  /** plan を維持する状態か（false＝free へ降格すべき）。 */
  keepsPlan: boolean
  /** ログ・テスト用の判定理由。 */
  reason:
    | 'active'
    | 'past_due_grace'
    | 'paused_collection'
    | 'terminated'
    | 'unresolved_plan'
}

/**
 * subscription の状態から (plan, status) を決める。
 *
 *   active/trialing              → plan 維持・status='active'
 *   past_due                     → plan 維持・status='past_due'（dunning の grace。
 *                                   ただし past-due-sweep が 21 日で打ち切る）
 *   pause_collection あり / paused → plan は free・status='canceled'
 *                                   （請求が止まっている以上、有料機能の提供根拠が無い。
 *                                     companies.status の CHECK に 'paused' が無いため
 *                                     既存 enum の 'canceled' に写す＝migration 不要）
 *   それ以外(canceled/unpaid/incomplete_expired 等) → free・'canceled'
 */
export function resolveSubscriptionTransition(
  snap: SubscriptionSnapshot,
): SubscriptionTransition {
  // 請求停止は他のどの状態よりも優先する（status=active のまま止まるため）。
  const paused = snap.pausedCollection || snap.status === 'paused'
  if (paused) {
    return { plan: 'free', status: 'canceled', keepsPlan: false, reason: 'paused_collection' }
  }

  const active = snap.status === 'active' || snap.status === 'trialing'
  const pastDue = snap.status === 'past_due'
  const keepsPlan = active || pastDue

  if (!keepsPlan) {
    return { plan: 'free', status: 'canceled', keepsPlan: false, reason: 'terminated' }
  }

  const status: BillingStatus = active ? 'active' : 'past_due'
  // price 逆引き優先 → metadata.plan（有料 enum の場合のみ）→ 解決不能。
  const plan: PlanId | null =
    snap.pricePlan ?? (isPaidPlanId(snap.metadataPlan) ? snap.metadataPlan : null)

  if (plan === null) {
    return { plan: null, status, keepsPlan: true, reason: 'unresolved_plan' }
  }
  return { plan, status, keepsPlan: true, reason: active ? 'active' : 'past_due_grace' }
}

// ----------------------------------------------------------------------------
// past_due の時間上限（監査 #2）
// ----------------------------------------------------------------------------

/**
 * past_due のまま有料プランを維持してよい日数。
 *   Stripe の smart retries は既定で最長 ~3 週間リトライする。それを超えても
 *   subscription.deleted が来ないケース（Stripe 側の解約設定が「何もしない」等）では、
 *   旧実装は **無期限に** 有料機能が無償で残り続けた。21 日で機械的に打ち切る。
 */
export const PAST_DUE_GRACE_DAYS = 21

/**
 * past_due_since から見て猶予を超過したか。
 * @param pastDueSince ISO 文字列（companies.past_due_since）。null/未設定は「判定不能＝落とさない」。
 */
export function pastDueExpired(
  pastDueSince: string | null | undefined,
  now: Date = new Date(),
  graceDays: number = PAST_DUE_GRACE_DAYS,
): boolean {
  if (!pastDueSince) return false
  const since = Date.parse(pastDueSince)
  if (!Number.isFinite(since)) return false
  const elapsedDays = (now.getTime() - since) / (24 * 60 * 60 * 1000)
  return elapsedDays > graceDays
}
