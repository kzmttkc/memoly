import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  PlanId,
  BillingInterval,
  PAID_PLAN_IDS,
  PLANS,
  billingEnabled,
  hasYearlyPrice,
} from '@/lib/plans'
import { createSeatCheckoutSession } from '@/lib/stripe'

// ============================================================================
// /api/company/billing/checkout — 席サブスクの Stripe Checkout を開始する
// ----------------------------------------------------------------------------
//   POST { companyId, plan, seats } → { url } （Stripe Checkout へリダイレクトするURL）
//
//   ガード（順に）:
//     1. ログイン必須（401）
//     2. その会社の **admin** のみ（課金操作は admin 権限）。member は 403。
//     3. BILLING_ENABLED=true でなければ 503（= 無料モニター中は課金を塞ぐ）。
//        → キー/Price ID 投入後にこのフラグ1つで課金解禁できる。
//     4. plan が有料プランか・seats がプランの seatCap 内かを検証（400）。
//     5. Price ID が env 未設定なら 503（PRICE_NOT_CONFIGURED）。
//
//   [[project_billing_lifecycle_state]] 既知失敗モードのガード:
//     - amount0: 番頭はトライアル無し。0円 checkout を作らない（無料は Stripe 非経由）。
//     - 重複顧客: companies.stripe_customer_id があれば再利用（lib/stripe で customer 指定）。
//     - 共有Stripeアカウント: metadata.product='banto' を session/subscription 両方に載せ、
//       webhook 側が他製品決済と弁別できるようにする（lib/stripe）。
//
//   ※ 実際にこのルートが課金を起こすのは「STRIPE_SECRET_KEY=実鍵 + Price ID 設定 +
//     BILLING_ENABLED=true」が全て揃った後。それまでは 503 で安全に塞がる。
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId, plan, seats, interval } = await req.json().catch(() => ({})) as {
    companyId?: string
    plan?: string
    seats?: number
    interval?: string
  }

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId が必要です' }, { status: 400 })
  }

  // admin 検証（課金操作は管理者のみ）。
  const membership = await getMembership(companyId)
  if (!membership) {
    return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
  }
  if (membership.role !== 'admin') {
    return NextResponse.json({ error: '課金操作は管理者のみ可能です' }, { status: 403 })
  }

  // 課金フラグ（無料モニター中は塞ぐ）。
  if (!billingEnabled()) {
    return NextResponse.json(
      {
        error: 'BILLING_DISABLED',
        message:
          '現在は無料モニター期間のため、課金はまだ有効化されていません。',
      },
      { status: 503 },
    )
  }

  // plan 検証（有料プランのみ）。
  if (!plan || !PAID_PLAN_IDS.includes(plan as PlanId)) {
    return NextResponse.json({ error: 'プランの指定が不正です' }, { status: 400 })
  }
  const planDef = PLANS[plan as PlanId]

  // seats 検証（1 以上・seatCap 以内）。
  const requestedSeats = Number.isInteger(seats) && (seats as number) >= 1 ? (seats as number) : 1
  if (requestedSeats > planDef.seatCap) {
    return NextResponse.json(
      { error: `このプランの席数上限は ${planDef.seatCap} 席です` },
      { status: 400 },
    )
  }

  // 課金単位（SSOT: docs/BANTO_BILLING_GATE.md §4・§5）:
  //   - Entry/Standard（multiClient=false）= 会社単位の月額。請求数量は常に 1、
  //     付与席（メンバー参加枠）はプランの seatCap（追加料金なしで人数枠を含む）。
  //     クライアントが seats>1 を送っても過大請求にならないようサーバ側で固定する。
  //   - 士業（multiClient=true）= 席（シート）課金。請求数量 = 付与席 = 指定席数。
  const seatCount = planDef.multiClient ? requestedSeats : planDef.seatCap
  const billQuantity = planDef.multiClient ? requestedSeats : 1

  // interval 検証（既定=月額）。年額は「年額を提供するプラン」かつ「年額 Price が env 設定済」
  //   のときのみ許可。それ以外で 'year' を指定されたら 400（無効な間隔）で弾く。
  const billingInterval: BillingInterval = interval === 'year' ? 'year' : 'month'
  if (billingInterval === 'year' && !hasYearlyPrice(plan as PlanId)) {
    return NextResponse.json(
      { error: 'このプランには年額の設定がありません', code: 'YEARLY_NOT_AVAILABLE' },
      { status: 400 },
    )
  }

  // 既存 Stripe 顧客IDを取得して再利用（重複顧客防止）。RLS下のanonで自社を引く。
  const supabase = await createServerSupabaseClient()
  const { data: companyRow } = await supabase
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', companyId)
    .maybeSingle()

  // 戻り先（課金ページ）。env が無ければリクエスト origin にフォールバック。
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const returnUrl = `${appUrl}/company/billing?companyId=${companyId}`

  try {
    const result = await createSeatCheckoutSession({
      planId: plan as PlanId,
      interval: billingInterval,
      seats: seatCount,
      quantity: billQuantity,
      companyId,
      userId: user.id,
      returnUrl,
      customerId: companyRow?.stripe_customer_id ?? null,
    })

    if ('error' in result) {
      // Price ID 未設定（Takeshi が Stripe で price 発行 → env 投入 前）。
      return NextResponse.json(
        {
          error: 'PRICE_NOT_CONFIGURED',
          message: 'このプランの価格設定が未登録です。',
        },
        { status: 503 },
      )
    }

    return NextResponse.json({ url: result.url })
  } catch (e) {
    console.error('[billing:checkout] create session failed', (e as Error).message)
    return NextResponse.json({ error: '決済セッションの作成に失敗しました' }, { status: 500 })
  }
}
