import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { BANTO_PRODUCT } from '@/lib/stripe'
import { planIdForPriceId, planIdForAmount, PAID_AMOUNTS, PlanId } from '@/lib/plans'
import type Stripe from 'stripe'

// ============================================================================
// /api/company/billing/webhook — Stripe → 番頭(Banto) の課金状態反映
// ----------------------------------------------------------------------------
//   購読すべき Stripe イベント（Takeshi が Stripe ダッシュボードで設定）:
//     - checkout.session.completed         → plan/seats 付与・customer/sub 保存
//     - customer.subscription.updated      → active/trialing なら維持、それ以外は free 降格
//     - customer.subscription.deleted      → free 降格（席は購入数を1に戻さず保持＝再開容易）
//
//   設計原則（Gokaku webhook の作法を踏襲し、席課金向けに拡張）:
//     1. **署名検証必須**: constructEvent で stripe-signature を検証。失敗は 400。
//        生body（req.text()）で検証する（JSONパース後では署名が合わない）。
//     2. **冪等**: Stripe は同一イベントを再送しうる（at-least-once）。
//        company_billing_events に event_id(PK) を記録し、既処理なら即 200。
//     3. **クロス配信ガード（3重）**: 共有 Stripe アカウントに sharoushi/fukuai/gokaku の
//        webhook も同居しうる。(a)metadata.product==='banto' (b)price が番頭のもの
//        (c)amount が番頭の既知額。いずれも満たさない他製品決済は 200 で無視。
//     4. **DB更新失敗は 5xx**: 課金済みなのに plan が free に取り残される事故を防ぐため、
//        DB 反映に失敗したら非2xx を返し Stripe に再送(指数バックオフ)させる。
//
//   秘密: STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY は
//         全て env のみ（git不可・.env* は .gitignore 済）。
//
//   [[project_billing_lifecycle_state]] 既知失敗モードのガード:
//     - amount0（トライアル0円）: 番頭はトライアル無し。0 は PAID_AMOUNTS に含めない＝
//       0円 checkout は付与対象にならない（誤付与防止）。将来トライアル導入時は要見直し。
//     - masked鍵/env反映ラグ: 鍵は env を CLI set → デプロイ → 実トランザクションで検証。
//     - service role: webhook は cookie 無しのため anon ではなく service role で DB 更新。
// ============================================================================

// 環境変数未設定でもビルドを壊さないため Stripe は動的 import。
async function getStripe() {
  const { stripe } = await import('@/lib/stripe')
  return stripe
}

// webhook は cookie を持たない。RLS をバイパスする service role で会社を更新する。
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * 冪等性: このイベントを既に処理済みか。company_billing_events に event_id があれば true。
 * （PK重複の race は最終的に INSERT 側で弾かれるが、まず読んで早期 return する）。
 */
async function alreadyProcessed(supabase: ServiceClient, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('company_billing_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  return !!data
}

/** 監査ログ＋冪等マーカーを1行記録する。INSERT が PK 重複なら「並行で処理済み」とみなす。 */
async function recordEvent(
  supabase: ServiceClient,
  row: {
    event_id: string
    company_id: string | null
    event_type: string
    plan?: string | null
    seats?: number | null
    amount?: number | null
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
  },
): Promise<{ duplicate: boolean }> {
  const { error } = await supabase.from('company_billing_events').insert(row)
  if (error) {
    // 23505 = unique_violation（PK重複）＝別の配送で既に記録済み。冪等に扱う。
    if ((error as { code?: string }).code === '23505') return { duplicate: true }
    throw error
  }
  return { duplicate: false }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  const stripe = await getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = createServiceClient()

  // 早期冪等チェック（重複再送を即 200 で返す）。
  try {
    if (await alreadyProcessed(supabase, event.id)) {
      return new Response('ok: already processed', { status: 200 })
    }
  } catch {
    // 監査テーブル未適用などで読めない場合は、処理は続行する（INSERT 側で再度ガードされる）。
  }

  try {
    // ----------------------------------------------------------------------
    // checkout.session.completed — 課金確定。plan/seats を付与し customer/sub を保存。
    // ----------------------------------------------------------------------
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const md = session.metadata ?? {}
      const companyId = md.company_id

      // クロス配信ガード(3重): 自製品(banto)の決済か判定。1つも満たさなければ無視。
      const isBanto = md.product === BANTO_PRODUCT
      let priceMatch = false
      let pricePlan: PlanId | null = null
      try {
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
        const priceId = items.data[0]?.price?.id
        pricePlan = planIdForPriceId(priceId)
        priceMatch = pricePlan !== null
      } catch {
        priceMatch = false
      }
      const amountMatch =
        typeof session.amount_total === 'number' &&
        PAID_AMOUNTS.includes(session.amount_total)

      if (!isBanto && !priceMatch && !amountMatch) {
        // 他製品(sharoushi/fukuai/gokaku 等)の決済 → 付与せず正常終了（再送させない）。
        return new Response('ignored: not a banto checkout', { status: 200 })
      }

      // company_id が無ければ反映先が不明（=自製品でも壊れたイベント）。記録だけして 200。
      if (!companyId) {
        return new Response('ignored: no company_id', { status: 200 })
      }

      // 反映する plan: metadata.plan 優先、無ければ price→amount の順で逆引き。
      const plan: PlanId | null =
        (md.plan as PlanId | undefined) && ['starter', 'standard', 'shigyo'].includes(md.plan!)
          ? (md.plan as PlanId)
          : pricePlan ?? planIdForAmount(session.amount_total)

      if (!plan) {
        // 自製品判定は通ったが plan を確定できない（異常）。free 付与はせず記録のみ 200。
        return new Response('ignored: plan unresolved', { status: 200 })
      }

      // 席数: metadata.seats（checkout 作成時に quantity と同値で載せている）。
      const seats = Number.parseInt(md.seats ?? '', 10)
      const seatsPurchased = Number.isInteger(seats) && seats >= 1 ? seats : 1

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: companyId,
        event_type: event.type,
        plan,
        seats: seatsPurchased,
        amount: session.amount_total ?? null,
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_subscription_id: (session.subscription as string) ?? null,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      const { error } = await supabase
        .from('companies')
        .update({
          plan,
          seats_purchased: seatsPurchased,
          status: 'active',
          stripe_customer_id: (session.customer as string) ?? null,
          stripe_subscription_id: (session.subscription as string) ?? null,
        })
        .eq('id', companyId)
      if (error) throw error
    }

    // ----------------------------------------------------------------------
    // customer.subscription.updated — 状態変化。active/trialing は維持、それ以外は降格。
    //   plan の昇格/降格(プラン変更)も items の price から反映する。
    // ----------------------------------------------------------------------
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      // 自製品判定: metadata.product または price 逆引き。
      const priceId = sub.items?.data?.[0]?.price?.id
      const pricePlan = planIdForPriceId(priceId)
      const isBanto = md.product === BANTO_PRODUCT || pricePlan !== null
      if (!isBanto) return new Response('ignored: not a banto subscription', { status: 200 })

      const active = sub.status === 'active' || sub.status === 'trialing'
      // active のときは現プラン（price 逆引き優先、無ければ metadata.plan）。非activeは free。
      const plan: PlanId = active
        ? (pricePlan ?? (md.plan as PlanId | undefined) ?? 'standard')
        : 'free'
      const status = active ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled'

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: md.company_id ?? null,
        event_type: event.type,
        plan,
        amount: null,
        stripe_subscription_id: sub.id,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      const { error } = await supabase
        .from('companies')
        .update({ plan, status })
        .eq('stripe_subscription_id', sub.id)
      if (error) throw error
    }

    // ----------------------------------------------------------------------
    // customer.subscription.deleted — 解約確定。free へ降格。
    //   席数(seats_purchased)は減らさない（再開時の付け直しを避け、ここは plan のみ降格）。
    // ----------------------------------------------------------------------
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      const priceId = sub.items?.data?.[0]?.price?.id
      const isBanto = md.product === BANTO_PRODUCT || planIdForPriceId(priceId) !== null
      if (!isBanto) return new Response('ignored: not a banto subscription', { status: 200 })

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: md.company_id ?? null,
        event_type: event.type,
        plan: 'free',
        stripe_subscription_id: sub.id,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      const { error } = await supabase
        .from('companies')
        .update({ plan: 'free', status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)
      if (error) throw error
    }
  } catch (e) {
    // 5xx を返すと Stripe が指数バックオフで再送する（課金済みユーザーの取り残しを防ぐ）。
    console.error('[billing:webhook] processing failed', (e as Error).message)
    return new Response('Webhook processing failed', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
