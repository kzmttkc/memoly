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

/** 課金の請求間隔。月額(month)が既定。年額(year)は提供プランのみ。 */
export type BillingInterval = 'month' | 'year'

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
  /** 公開API v1（read系・APIキー認証）リクエスト/日。LLM非経由のため他より高め。 */
  api_v1: number
}

export interface PlanDef {
  /** DB enum 値（companies.plan）。SSOTの主キー。 */
  id: PlanId
  /** LP/UI の表示名（Entry/Standard/士業/無料モニター）。 */
  displayName: string
  /** 月額（円・税抜想定）。free は 0。表示は `¥${monthlyJpy.toLocaleString()}`。 */
  monthlyJpy: number
  /** 年額（円）。年額を提供するプランのみ。提供しないプランは null。 */
  yearlyJpy: number | null
  /**
   * 料金表示で主役（強調枠・primary CTA）にするか。
   * SSOT: 2026-06-29 Takeshi承認の確定構造＝Entry(¥3,980)が主役。
   * LP(/business)・課金UI(/company/billing)はこのフラグを参照し、各画面で
   * 独自に featured を決めない（画面ごとの食い違いを構造的に防ぐ）。
   */
  featured: boolean
  /** Stripe Checkout の amount_total（JPY最小単位=円）。webhook の amount ガードに使う。free は null。 */
  stripeAmount: number | null
  /** 年額 Checkout の amount_total（円）。年額を提供するプランのみ。webhook の amount ガード用。 */
  yearlyStripeAmount: number | null
  /** Stripe Price ID（月額）を読む環境変数名。free/未設定は null。 */
  priceEnvVar: string | null
  /** Stripe Price ID（年額）を読む環境変数名。年額を提供するプランのみ（例 STRIPE_PRICE_STARTER_YEARLY）。 */
  priceEnvVarYearly: string | null
  /** このプランで許容する席数の上限（admin が席を増やせる天井）。 */
  seatCap: number
  /** 複数顧問先（multi-company admin）を許すか（士業向け）。 */
  multiClient: boolean
  /**
   * このユーザーが所有（admin として作成）できる会社数の上限。
   *   free/starter/standard = 1（自社のみ）、shigyo = 複数顧問先（多数）。
   *   ★「複数顧問先を切り替え・各社記憶分離」は士業¥29,800の看板訴求そのもの。
   *   会社作成APIはこの値で構造ゲートし（`canCreateAnotherCompany`）、BILLING_ENABLED の
   *   有無に関わらず有効にする（無料で複数顧問先を作れる収益リークを塞ぐ）。
   *   ★新規ユーザーの「最初の1社」作成は、会社作成APIが「所属0社なら常に許可」で
   *     担保するため、この値とは独立にオンボは絶対に壊れない。
   */
  maxCompanies: number
  /** 機能別 日次上限。 */
  limits: PlanFeatureLimits
}

// ----------------------------------------------------------------------------
// プラン本体（価格は project_banto_pricing メモリ＝2026-06-29 Takeshi承認の確定構造:
//   Entry¥3,980／Standard¥9,800／士業¥29,800。旧 vertical_saas_build 値からの更新
//   を 2026-07-02 CPO監査で検出し整合）。
//   無料モニター中は free が全社に割り当たる想定。Stripe結線後に有料へ昇格。
// ----------------------------------------------------------------------------
export const PLANS: Record<PlanId, PlanDef> = {
  // 無料モニター: アハ体験/継続率の検証期間。コア機能は触れるが上限は控えめ。
  free: {
    id: 'free',
    displayName: '無料プラン',
    monthlyJpy: 0,
    yearlyJpy: null,
    featured: false,
    stripeAmount: null,
    yearlyStripeAmount: null,
    priceEnvVar: null,
    priceEnvVarYearly: null,
    seatCap: 3,
    multiClient: false,
    maxCompanies: 1,
    limits: {
      chat: 20,
      insights: 3,
      risk_audit: 3,
      document_generate: 3,
      document_review: 3,
      api_v1: 500,
    },
  },

  // Entry（LP表記）= enum 'starter'。まず使ってみる層。
  starter: {
    id: 'starter',
    displayName: 'Entry',
    monthlyJpy: 3980,
    yearlyJpy: 39800,
    featured: true,
    stripeAmount: 3980,
    // 年額 ¥39,800（2ヶ月分お得）。Price は解禁日にrunbookで作成し env 投入。
    yearlyStripeAmount: 39800,
    priceEnvVar: 'STRIPE_PRICE_STARTER',
    priceEnvVarYearly: 'STRIPE_PRICE_STARTER_YEARLY',
    seatCap: 5,
    multiClient: false,
    maxCompanies: 1,
    limits: {
      chat: 50,
      insights: 10,
      risk_audit: 10,
      document_generate: 10,
      document_review: 10,
      api_v1: 2000,
    },
  },

  // Standard = 上位プラン（記憶フル・書類・能動通知）。主役はEntry=starter（2026-06-29承認）。
  standard: {
    id: 'standard',
    displayName: 'Standard',
    monthlyJpy: 9800,
    yearlyJpy: null,
    featured: false,
    stripeAmount: 9800,
    yearlyStripeAmount: null,
    priceEnvVar: 'STRIPE_PRICE_STANDARD',
    priceEnvVarYearly: null,
    seatCap: 20,
    multiClient: false,
    maxCompanies: 1,
    limits: {
      chat: 150,
      insights: 30,
      risk_audit: 30,
      document_generate: 30,
      document_review: 30,
      api_v1: 5000,
    },
  },

  // 士業 = 複数顧問先を切替・各社記憶分離。収益の最大テコ。
  shigyo: {
    id: 'shigyo',
    displayName: '士業',
    monthlyJpy: 29800,
    yearlyJpy: null,
    featured: false,
    stripeAmount: 29800,
    yearlyStripeAmount: null,
    priceEnvVar: 'STRIPE_PRICE_SHIGYO',
    priceEnvVarYearly: null,
    seatCap: 50,
    multiClient: true,
    maxCompanies: 50,
    limits: {
      chat: 400,
      insights: 80,
      risk_audit: 80,
      document_generate: 80,
      document_review: 80,
      api_v1: 20000,
    },
  },
}

/** 有料プランのみ（課金UI/checkout の選択肢）。表示順 = Entry→Standard→士業。 */
export const PAID_PLAN_IDS: PlanId[] = ['starter', 'standard', 'shigyo']

/** 既知の有料 amount 群（webhook の amount ガード用。free=0 は含めない）。月額＋年額の両方。 */
export const PAID_AMOUNTS: number[] = PAID_PLAN_IDS
  .flatMap(id => [PLANS[id].stripeAmount, PLANS[id].yearlyStripeAmount])
  .filter((a): a is number => typeof a === 'number')

/** 不明・未設定の plan 値は free に丸める（DBに想定外enumが入っても安全側）。 */
export function resolvePlan(plan: string | null | undefined): PlanDef {
  if (plan && plan in PLANS) return PLANS[plan as PlanId]
  return PLANS.free
}

/**
 * env から各有料プランの Stripe Price ID を引く（間隔別）。
 * 未設定（=まだTakeshiがprice作成前）なら null。checkout 側で「未提供」を返す根拠。
 * @param interval 'month'(既定) | 'year'。年額を提供しないプランで 'year' を渡すと null。
 */
export function priceIdForPlan(
  planId: PlanId,
  interval: BillingInterval = 'month',
): string | null {
  const def = PLANS[planId]
  const envVar = interval === 'year' ? def.priceEnvVarYearly : def.priceEnvVar
  if (!envVar) return null
  const v = process.env[envVar]
  return v && v.trim().length > 0 ? v : null
}

/** そのプランが年額 Price を提供しているか（env に年額 Price ID が入っているか）。 */
export function hasYearlyPrice(planId: PlanId): boolean {
  return priceIdForPlan(planId, 'year') !== null
}

/**
 * Stripe Price ID → PlanId の逆引き。webhook で line item の price から
 * どのプランへ昇格すべきか決めるのに使う（amount だけに頼らず price でも判定）。
 * 月額・年額のどちらの Price ID でも同じ PlanId に解決する。
 */
export function planIdForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  for (const id of PAID_PLAN_IDS) {
    if (priceIdForPlan(id, 'month') === priceId || priceIdForPlan(id, 'year') === priceId) {
      return id
    }
  }
  return null
}

/** Stripe amount → PlanId の逆引き（price 不一致時のフォールバック判定）。月額・年額の両方を照合。 */
export function planIdForAmount(amount: number | null | undefined): PlanId | null {
  if (typeof amount !== 'number') return null
  for (const id of PAID_PLAN_IDS) {
    if (PLANS[id].stripeAmount === amount || PLANS[id].yearlyStripeAmount === amount) return id
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

/**
 * ユーザーの所属会社群 plan から「今もう1社作成してよいか」を判定する。
 * 会社作成API(POST /api/company)の**構造ゲート**（BILLING_ENABLED 非依存で常時有効）。
 *   - 所属0社: 常に true。★新規オンボの「最初の1社」を絶対に妨げない。
 *   - 所属1社以上: 所属会社の plan で最も大きい maxCompanies を許容量とし、
 *     現在の所属数がそれ未満なら true。free/starter/standard は maxCompanies=1 のため
 *     2社目以降は不可。多数の顧問先を持てるのは multiClient(士業/¥29,800) 会社を
 *     1社でも保有する場合のみ（=複数顧問先切替という看板機能を士業プランへ課金ゲート）。
 *   - 既存で既に複数会社を持つユーザーは、ここでは剥奪しない（新規作成のみを制限し、
 *     owned < allowance を満たさなくても既存の会社・記憶・権限は一切触らない）。
 * @param plans ユーザーが所属する各会社の plan 値（companies.plan）
 */
export function canCreateAnotherCompany(plans: (string | null | undefined)[]): boolean {
  const owned = plans.length
  if (owned === 0) return true
  const allowance = Math.max(1, ...plans.map(p => resolvePlan(p).maxCompanies))
  return owned < allowance
}

// 「番頭は現在 無料モニター中で、キー投入後に課金を有効化する」ためのフラグ。
// BILLING_ENABLED !== 'true' の間は checkout を 503 で塞ぎ、UIは「予定価格」を出す。
// Stripeキー/Price ID をTakeshiが env に入れた後、この1フラグで課金を解禁できる。
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

/**
 * 日次上限(429)に達したとき、「アップグレードで上限を増やす」導線を出してよいか。
 *   条件: 課金が解禁されている(billingEnabled) かつ 最上位プラン(shigyo)未満。
 *   2026-07-24 成長施策: 上限到達は最も購入意欲が高い瞬間（＝製品を能動的に使っている
 *   証拠）。この判定を rate-limit 応答の全kind（chat/insights/risk_audit/
 *   document_generate/document_review）から共通で呼び、フロントの CTA 表示を揃える。
 */
export function upgradeAvailable(planId: PlanId): boolean {
  return billingEnabled() && planId !== 'shigyo'
}

/**
 * 日次上限(429)応答の本文を作る共通ヘルパー。5つのAPI route（chat/insights/
 * risk_audit/document_generate/document_review）で同一の形にする（フロントの
 * 分岐を1パターンに保つ）。upgradeAvailable=true のときだけ文面にアップグレード
 * 誘導を足す（課金未解禁/最上位プランでは出さない＝誇大でない）。
 */
export function rateLimitBody(planId: PlanId): {
  error: string
  code: 'RATE_LIMITED'
  plan: PlanId
  upgradeAvailable: boolean
} {
  const upgradable = upgradeAvailable(planId)
  return {
    error: upgradable
      ? '本日の利用上限に達しました。日本時間の午前9時にリセットされます。すぐに使いたい場合は、プランのアップグレードで上限を増やせます。'
      : '本日の利用上限に達しました。利用回数は日本時間の午前9時にリセットされます。',
    code: 'RATE_LIMITED',
    plan: planId,
    upgradeAvailable: upgradable,
  }
}
