// ============================================================================
// lib/plans.ts — 番頭(Banto) プラン定義の単一の正本（SSOT）
// ----------------------------------------------------------------------------
// 目的:
//   料金表示(LP /business)・会員UI(/company/billing)・機能上限(rate-limit)・
//   Stripe課金(checkout/webhook)が「同じ1か所」を参照する。
//   これ以前は LP=Entry/Standard/士業、DB enum=trial/starter/pro/enterprise と
//   名称がバラバラで、課金結線時に齟齬・誤付与の温床になっていた。ここで統一する。
//
// 設計判断（名称統一の方針）:
//   - DB の companies.plan は **enum 値（free/starter/standard/shigyo）** を正とする。
//     既存スキーマの 'trial'/'starter'/'pro'/'enterprise' は使わない。
//     → migration: supabase/plan_ssot_migration.sql（CEOが適用）。
//   - LP の表示名（Entry/Standard/士業）は displayName で持つ。
//     「Entry」は DB enum 'starter' に対応（LP表記は据え置きつつ enum を意味で命名）。
//   - 無料モニター = enum 'free'。Stripe結線前の全社が free。
//
// 秘密の扱い:
//   - Stripe Price ID は **環境変数**から読む（STRIPE_PRICE_STARTER 等）。
//     plans.ts には Price ID を**直書きしない**（環境差し替え可能にする／git混入を避ける）。
//     Price ID 自体は秘密ではないが、環境ごと（test/live）に変わるため env が正。
//   - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET は当然 env のみ（git不可）。
// ============================================================================

/** DB companies.plan が取りうる値（=正本）。free=無料モニター。 */
export type PlanId = 'free' | 'starter' | 'standard' | 'shigyo'

/** 機能種別ごとの日次上限。rate-limit.ts の ApiKind と一致させる。 */
export interface PlanFeatureLimits {
  /** チャット相談（sonnet）/日 */
  chat: number
  /** 助成金・法改正の自分ごと診断（insights）/日 */
  insights: number
  /** 労務リスク・セルフ監査（risk_audit）/日 */
  risk_audit: number
  /** 書類ドラフト生成（document_generate）/日 */
  document_generate: number
  /** 既存規程レビュー（document_review）/日 */
  document_review: number
}

export interface PlanDef {
  /** DB enum 値（companies.plan）。SSOTの主キー。 */
  id: PlanId
  /** LP/UI の表示名（Entry/Standard/士業/無料モニター）。 */
  displayName: string
  /** 月額（円・税抜想定）。free は 0。表示は `¥${monthlyJpy.toLocaleString()}`。 */
  monthlyJpy: number
  /** Stripe Checkout の amount_total（JPY最小単位=円）。webhook の amount ガードに使う。free は null。 */
  stripeAmount: number | null
  /** Stripe Price ID を読む環境変数名。free/未設定は null。 */
  priceEnvVar: string | null
  /** このプランで許容する席数の上限（admin が席を増やせる天井）。 */
  seatCap: number
  /** 複数顧問先（multi-company admin）を許すか（士業向け）。 */
  multiClient: boolean
  /** 機能別 日次上限。 */
  limits: PlanFeatureLimits
}

// ----------------------------------------------------------------------------
// プラン本体（価格は project_vertical_saas_build メモリの確定値）。
//   無料モニター中は free が全社に割り当たる想定。Stripe結線後に有料へ昇格。
// ----------------------------------------------------------------------------
export const PLANS: Record<PlanId, PlanDef> = {
  // 無料モニター: アハ体験/継続率の検証期間。コア機能は触れるが上限は控えめ。
  free: {
    id: 'free',
    displayName: '無料モニター',
    monthlyJpy: 0,
    stripeAmount: null,
    priceEnvVar: null,
    seatCap: 3,
    multiClient: false,
    limits: {
      chat: 20,
      insights: 3,
      risk_audit: 3,
      document_generate: 3,
      document_review: 3,
    },
  },

  // Entry（LP表記）= enum 'starter'。まず使ってみる層。
  starter: {
    id: 'starter',
    displayName: 'Entry',
    monthlyJpy: 2980,
    stripeAmount: 2980,
    priceEnvVar: 'STRIPE_PRICE_STARTER',
    seatCap: 5,
    multiClient: false,
    limits: {
      chat: 50,
      insights: 10,
      risk_audit: 10,
      document_generate: 10,
      document_review: 10,
    },
  },

  // Standard = 主力（記憶フル・書類・能動通知）。
  standard: {
    id: 'standard',
    displayName: 'Standard',
    monthlyJpy: 4980,
    stripeAmount: 4980,
    priceEnvVar: 'STRIPE_PRICE_STANDARD',
    seatCap: 20,
    multiClient: false,
    limits: {
      chat: 150,
      insights: 30,
      risk_audit: 30,
      document_generate: 30,
      document_review: 30,
    },
  },

  // 士業 = 複数顧問先を切替・各社記憶分離。収益の最大テコ。
  shigyo: {
    id: 'shigyo',
    displayName: '士業',
    monthlyJpy: 9800,
    stripeAmount: 9800,
    priceEnvVar: 'STRIPE_PRICE_SHIGYO',
    seatCap: 50,
    multiClient: true,
    limits: {
      chat: 400,
      insights: 80,
      risk_audit: 80,
      document_generate: 80,
      document_review: 80,
    },
  },
}

/** 有料プランのみ（課金UI/checkout の選択肢）。表示順 = Entry→Standard→士業。 */
export const PAID_PLAN_IDS: PlanId[] = ['starter', 'standard', 'shigyo']

/** 既知の有料 amount 群（webhook の amount ガード用。free=0 は含めない）。 */
export const PAID_AMOUNTS: number[] = PAID_PLAN_IDS
  .map(id => PLANS[id].stripeAmount)
  .filter((a): a is number => typeof a === 'number')

/** 不明・未設定の plan 値は free に丸める（DBに想定外enumが入っても安全側）。 */
export function resolvePlan(plan: string | null | undefined): PlanDef {
  if (plan && plan in PLANS) return PLANS[plan as PlanId]
  return PLANS.free
}

/**
 * env から各有料プランの Stripe Price ID を引く。
 * 未設定（=まだTakeshiがprice作成前）なら null。checkout 側で「未提供」を返す根拠。
 */
export function priceIdForPlan(planId: PlanId): string | null {
  const def = PLANS[planId]
  if (!def.priceEnvVar) return null
  const v = process.env[def.priceEnvVar]
  return v && v.trim().length > 0 ? v : null
}

/**
 * Stripe Price ID → PlanId の逆引き。webhook で line item の price から
 * どのプランへ昇格すべきか決めるのに使う（amount だけに頼らず price でも判定）。
 */
export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  for (const id of PAID_PLAN_IDS) {
    if (priceIdForPlan(id) === priceId) return id
  }
  return null
}

/** Stripe amount → PlanId の逆引き（price 不一致時のフォールバック判定）。 */
export function planIdForAmount(amount: number | null | undefined): PlanId | null {
  if (typeof amount !== 'number') return null
  for (const id of PAID_PLAN_IDS) {
    if (PLANS[id].stripeAmount === amount) return id
  }
  return null
}

/**
 * 機能上限の解決: plan に応じた kind 別 日次上限を返す。
 * rate-limit.ts はここを参照し、plan 連動の上限でガードする（plan非依存の固定capを廃止）。
 */
export function limitFor(planId: PlanId, kind: keyof PlanFeatureLimits): number {
  return PLANS[planId].limits[kind]
}

// 「番頭は現在 無料モニター中で、キー投入後に課金を有効化する」ためのフラグ。
// BILLING_ENABLED !== 'true' の間は checkout を 503 で塞ぎ、UIは「予定価格」を出す。
// Stripeキー/Price ID をTakeshiが env に入れた後、この1フラグで課金を解禁できる。
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}
