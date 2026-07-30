import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { BANTO_PRODUCT } from '@/lib/stripe'
import { planIdForPriceId, planIdForAmount, PAID_AMOUNTS, PlanId } from '@/lib/plans'
import {
  isCheckoutPaid,
  isPaidPlanId,
  resolveSubscriptionTransition,
} from './transition'
import type Stripe from 'stripe'

// ============================================================================
// /api/company/billing/webhook — Stripe → 番頭(Banto) の課金状態反映
// ----------------------------------------------------------------------------
//   購読すべき Stripe イベント（Takeshi が Stripe ダッシュボードで設定）:
//     - checkout.session.completed         → plan/seats 付与・customer/sub 保存
//                                            （payment_status が paid / no_payment_required のときだけ）
//     - customer.subscription.updated      → active/trialing/past_due(grace) は plan 維持、
//                                            それ以外(canceled/unpaid/請求一時停止)は free 降格
//     - customer.subscription.paused       → 請求の一時停止。free 降格（監査#4）
//     - customer.subscription.deleted      → free 降格（席は購入数を1に戻さず保持＝再開容易）
//     - invoice.payment_failed             → dunning。即 free 降格せず past_due(grace) に。
//                                            plan は維持し、Stripe の自動リトライ(smart retries)を待つ。
//     - invoice.payment_succeeded          → past_due からの復帰。status を active に戻す。
//   ★【要・Stripeダッシュボードで購読追加】invoice.payment_failed / invoice.payment_succeeded /
//     customer.subscription.paused を、この webhook エンドポイントの購読イベントに追加する
//     （Takeshi 手動。コードは実装済み）。paused を購読しなくても updated 側で
//     pause_collection を見て降格するため穴は塞がるが、購読すると反映が早くなる。
//
//   dunning 設計（failed由来 vs 自発解約の区別）:
//     - 支払い失敗(invoice.payment_failed)は「払う意思はあるが決済が通らなかった」状態。
//       即 free 降格すると、カード更新待ちの優良顧客を機能停止で取り逃がす。だから
//       plan は維持したまま status='past_due'(grace) に置き、Stripe のリトライ＋催促を待つ。
//     - 自発解約(customer.subscription.deleted)は「払う意思の撤回」。こちらは free 降格。
//     - リトライ全敗で Stripe が最終的に subscription.deleted を送れば、そこで free に落ちる。
//       ＝ grace→（回収成功なら active 復帰／全敗なら deleted で free）の二分岐になる。
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
// subscription id での突合が0行だったときに必ず痕跡を残す。
//   退会や手動削除で companies 行が消えると、以後の customer.subscription.* は
//   .eq('stripe_subscription_id', ...) が0行一致になり、update は成功扱い（error=null）で
//   静かに無反映になる。Stripe 側は 200 を受け取って再送もしないため、
//   「課金は生きているのに DB に反映されない」状態がどこにも記録されずに続く
//   （2026-07-30 可用性監査で検出）。2xx は維持しつつ（Stripe の無限再送を避ける）、
//   ログに FATAL 相当を残して人が気づけるようにする。
function warnIfNoMatch(count: number | null, eventType: string, subId: string): void {
  if (count === 0) {
    console.error(
      '[billing:webhook] 突合0行 — Stripeイベントを受けたが該当会社が存在しない。' +
        '課金が残っている可能性あり。要手動確認',
      { event_type: eventType, stripe_subscription_id: subId },
    )
  }
}

/**
 * companies.past_due_since を best-effort で更新する（監査#2）。
 *
 *   past_due に落ちた「最初の時刻」を記録し、past-due-sweep cron が 21 日で打ち切る。
 *   - value=ISO文字列 のとき: **まだ NULL の行だけ**を更新する。invoice.payment_failed は
 *     Stripe のリトライごとに何度も飛ぶため、毎回上書きすると時計が永久にリセットされ
 *     猶予期限が一生来ない。`.is('past_due_since', null)` で初回だけ刻む。
 *   - value=null のとき: 復帰(active)なので無条件にクリアする。
 *
 *   ★ migration（supabase/billing_past_due_grace.sql）未適用でも本番を壊さない:
 *     列が無ければ PostgREST がエラーを返すが、ここでは **throw せずログのみ**。
 *     status の更新は別クエリで先に済ませてあるため、既存挙動は完全に無退行。
 */
async function updatePastDueSince(
  supabase: ServiceClient,
  match: { column: 'id' | 'stripe_subscription_id'; value: string },
  value: string | null,
): Promise<void> {
  let q = supabase.from('companies').update({ past_due_since: value }).eq(match.column, match.value)
  if (value !== null) q = q.is('past_due_since', null)
  const { error } = await q
  if (error) {
    console.error(
      '[billing:webhook] past_due_since の更新に失敗（supabase/billing_past_due_grace.sql 未適用の可能性）',
      { code: (error as { code?: string }).code, msg: error.message },
    )
  }
}

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

      // ★入金確認（監査#7）: Checkout Session は「完了したが未入金」でも completed が飛ぶ
      //   （payment_status='unpaid'。遅延決済・支払い方法の確保のみ等）。ここを見ずに
      //   付与すると、入金されないまま有料プランが立つ。paid / no_payment_required のみ通す。
      if (!isCheckoutPaid(session.payment_status)) {
        console.error('[billing:webhook] 未入金の checkout のため付与しません', {
          session_id: session.id,
          payment_status: session.payment_status,
          company_id: companyId ?? null,
        })
        return new Response('ignored: checkout not paid', { status: 200 })
      }

      // company_id が無ければ反映先が不明（=自製品でも壊れたイベント）。記録だけして 200。
      if (!companyId) {
        return new Response('ignored: no company_id', { status: 200 })
      }

      // 反映する plan: metadata.plan 優先、無ければ price→amount の順で逆引き。
      const plan: PlanId | null = isPaidPlanId(md.plan)
        ? md.plan
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
      // 新規課金＝滞納クロックはリセット（best-effort・migration 未適用でも無害）。
      await updatePastDueSince(supabase, { column: 'id', value: companyId }, null)
    }

    // ----------------------------------------------------------------------
    // customer.subscription.updated — 状態変化。
    //   実 Stripe では支払い失敗時、この customer.subscription.updated(status=past_due) が
    //   invoice.payment_failed より先に届く。past_due を「非active→即free」に含めてしまうと
    //   dunning の grace 期間(上のコメント参照)が機能せず、1回の失敗で即座に機能停止する
    //   バグになる(2026-07-09 実Stripeテスト検証で発見・修正)。
    //   active/trialing/past_due は plan を維持し、真に終了した状態(canceled/unpaid等)のみ降格。
    //   plan の昇格/降格(プラン変更)も items の price から反映する。
    // ----------------------------------------------------------------------
    //   ★2026-07-30 監査で2点を修正:
    //     #3 plan 解決の最終フォールバックが有料の 'standard' だった。Price ID を差し替えると
    //        price 逆引きが外れ、metadata も無い正規顧客に ¥9,800 相当が無償で立つ。
    //        → 解決不能なら **plan を書き換えない**（warnIfNoMatch と同じ「分からないときは
    //          触らない」流儀）。status だけ反映して console.error を残す。
    //     #4 pause_collection（支払いの一時停止）は status='active' のまま請求だけ止まる。
    //        → resolveSubscriptionTransition が keepsPlan から外して free へ降格する。
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.paused') {
      const sub = event.data.object as Stripe.Subscription
      const md = sub.metadata ?? {}
      // 自製品判定: metadata.product または price 逆引き。
      const priceId = sub.items?.data?.[0]?.price?.id
      const pricePlan = planIdForPriceId(priceId)
      const isBanto = md.product === BANTO_PRODUCT || pricePlan !== null
      if (!isBanto) return new Response('ignored: not a banto subscription', { status: 200 })

      const t = resolveSubscriptionTransition({
        status: event.type === 'customer.subscription.paused' ? 'paused' : sub.status,
        pausedCollection: sub.pause_collection != null,
        pricePlan,
        metadataPlan: md.plan,
      })

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: md.company_id ?? null,
        event_type: event.type,
        plan: t.plan,
        amount: null,
        stripe_subscription_id: sub.id,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      if (t.reason === 'unresolved_plan') {
        // plan を確定できない。有料へも free へも倒さず、status だけ反映して人へ知らせる。
        console.error(
          '[billing:webhook] plan を解決できませんでした（Price ID の差し替え？）。' +
            'plan は変更せず status のみ反映します。要手動確認',
          { event_type: event.type, stripe_subscription_id: sub.id, price_id: priceId ?? null },
        )
      }

      const patch: { status: string; plan?: PlanId } =
        t.plan === null ? { status: t.status } : { status: t.status, plan: t.plan }

      const { error, count } = await supabase
        .from('companies')
        .update(patch, { count: 'exact' })
        .eq('stripe_subscription_id', sub.id)
      if (error) throw error
      warnIfNoMatch(count, event.type, sub.id)

      // 滞納クロック: past_due に入った初回だけ刻み、active へ戻ったらクリアする。
      if (t.status === 'past_due') {
        await updatePastDueSince(
          supabase,
          { column: 'stripe_subscription_id', value: sub.id },
          new Date().toISOString(),
        )
      } else if (t.status === 'active') {
        await updatePastDueSince(supabase, { column: 'stripe_subscription_id', value: sub.id }, null)
      }
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

      const { error, count } = await supabase
        .from('companies')
        .update({ plan: 'free', status: 'canceled' }, { count: 'exact' })
        .eq('stripe_subscription_id', sub.id)
      if (error) throw error
      warnIfNoMatch(count, event.type, sub.id)
      // 既に free まで落ちたので滞納クロックは不要。再契約時に誤って掃かれないよう消す。
      await updatePastDueSince(
        supabase,
        { column: 'stripe_subscription_id', value: sub.id },
        null,
      )
    }

    // ----------------------------------------------------------------------
    // invoice.payment_failed — dunning。即 free 降格せず past_due(grace) へ。
    //   plan は維持（払う意思のある顧客を機能停止で逃さない）。Stripe の自動リトライを待つ。
    //   失敗由来であることが status='past_due' で判別できる（自発解約は 'canceled'）。
    // ----------------------------------------------------------------------
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null
      if (!subId) return new Response('ignored: invoice without subscription', { status: 200 })

      // クロス配信ガード: この subscription が番頭の会社に紐づくか。companies に
      // stripe_subscription_id が在る＝自製品の課金。無ければ他製品の invoice として無視。
      const { data: company } = await supabase
        .from('companies')
        .select('id, plan')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()
      if (!company) return new Response('ignored: not a banto subscription', { status: 200 })

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: company.id,
        event_type: event.type,
        stripe_subscription_id: subId,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      // plan は触らず status のみ past_due へ（grace）。回収成功 or 最終 deleted で確定する。
      const { error } = await supabase
        .from('companies')
        .update({ status: 'past_due' })
        .eq('id', company.id)
      if (error) throw error

      // 滞納クロックを刻む（初回のみ。リトライごとに上書きすると期限が一生来ない）。
      // 21 日超過は /api/company/billing/past-due-sweep（日次 cron）が free へ落とす。
      await updatePastDueSince(
        supabase,
        { column: 'id', value: company.id },
        new Date().toISOString(),
      )
    }

    // ----------------------------------------------------------------------
    // invoice.payment_succeeded — 支払い成功。past_due(grace) からの復帰。
    //   通常の継続課金成功でも飛ぶため、active 以外（past_due）のときだけ active に戻す。
    //   active のときは何もしない（冪等・無駄な更新を避ける）。
    // ----------------------------------------------------------------------
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null
      if (!subId) return new Response('ignored: invoice without subscription', { status: 200 })

      const { data: company } = await supabase
        .from('companies')
        .select('id, status')
        .eq('stripe_subscription_id', subId)
        .maybeSingle()
      if (!company) return new Response('ignored: not a banto subscription', { status: 200 })

      const rec = await recordEvent(supabase, {
        event_id: event.id,
        company_id: company.id,
        event_type: event.type,
        stripe_subscription_id: subId,
      })
      if (rec.duplicate) return new Response('ok: duplicate', { status: 200 })

      // past_due からの復帰時のみ active へ。既に active なら更新しない（冪等）。
      if (company.status === 'past_due') {
        const { error } = await supabase
          .from('companies')
          .update({ status: 'active' })
          .eq('id', company.id)
        if (error) throw error
      }
      // 回収できたので滞納クロックはクリア（active でも残骸があれば消す＝誤降格を防ぐ）。
      await updatePastDueSince(supabase, { column: 'id', value: company.id }, null)
    }
  } catch (e) {
    // 5xx を返すと Stripe が指数バックオフで再送する（課金済みユーザーの取り残しを防ぐ）。
    console.error('[billing:webhook] processing failed', (e as Error).message)
    return new Response('Webhook processing failed', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
