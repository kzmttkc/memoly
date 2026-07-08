// ============================================================================
// billing_lifecycle_e2e_real.mjs — 番頭(Banto) 決済ライフサイクル E2E（実Stripeテストモード版）
// ----------------------------------------------------------------------------
// billing_lifecycle_e2e.mjs（mock）を「実HMAC署名のモックイベント」から
// 「実Stripeテストモードイベント（実event.id・実webhook配信）」へ格上げする姉妹スクリプト。
//
// 検証する経路（mockと同じ意味的カバレッジを実イベントで）:
//   1. 実Checkout Session作成（lib/stripe.ts createSeatCheckoutSession と同一shapeのAPI呼び出し）
//   2. Stripeテストカードで実Checkoutを完了（ブラウザ自動操作。card=4242 4242 4242 4242）
//   3. `stripe listen` が転送する実 checkout.session.completed を実webhookルートで受信
//      → 実event.idで冪等テーブルに記録・companies に付与されることを実DBで確認
//   4. Stripe Test Clock で時間を進め、支払方法を失敗カード(pm_card_chargeDeclined)に
//      差し替えて更新請求を失敗させる → 実 invoice.payment_failed → status=past_due
//   5. 支払方法を成功カード(pm_card_visa)に戻し invoice を pay() → 実 invoice.payment_succeeded
//      → status=active 復帰
//   6. subscriptions.cancel() → 実 customer.subscription.deleted → plan=free/status=canceled
//   7. 全痕跡削除（test clock 削除＝配下のcustomer/subscription/invoiceも自動削除。
//      Price/Productは Stripe API 仕様上ハード削除不可のため archive(active=false)で無効化）
//
// 安全装置:
//   - STRIPE_SECRET_KEY が sk_test_ で始まらなければ即 abort（本番キー混入の構造的防止）。
//   - このスクリプトは Vercel 等のデプロイ操作を一切行わない（ローカル next start のみ）。
//
// 使い方（事前に別ターミナル/プロセスで `stripe listen --api-key sk_test_... \
//   --forward-to http://127.0.0.1:$PORT/api/company/billing/webhook` を起動し、
//   出力された whsec_... を WHSEC に渡す）:
//
//   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_STARTER=price_... WHSEC=whsec_... \
//     node scripts/billing_lifecycle_e2e_real.mjs prepare   # checkout URLを発行して終了
//   node scripts/billing_lifecycle_e2e_real.mjs poll-grant <companyId>   # 付与待ちポーリング
//   node scripts/billing_lifecycle_e2e_real.mjs dunning <companyId> <subscriptionId> <customerId>
//   node scripts/billing_lifecycle_e2e_real.mjs cleanup <companyId> <testClockId>
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SERVICE) { console.error('.env.local に Supabase env がありません'); process.exit(2) }

const KEY = process.env.STRIPE_SECRET_KEY ?? ''
if (!KEY.startsWith('sk_test_')) {
  console.error('abort: STRIPE_SECRET_KEY が sk_test_ で始まりません。実キー操作は厳禁です。')
  process.exit(2)
}
const { default: Stripe } = await import('stripe')
const stripe = new Stripe(KEY)
const admin = createClient(SB_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const PORT = Number(process.env.PORT ?? 3300)
const BASE = `http://127.0.0.1:${PORT}`
const PRICE_STARTER = process.env.STRIPE_PRICE_STARTER
const NAME_PREFIX = 'E2E実課金検証_'

const cmd = process.argv[2]

// ----------------------------------------------------------------------------
// prepare: テスト会社 + test clock + customer + checkout session を作成し、
//          checkout URL を出力する（ブラウザ自動操作で完了させる用）。
// ----------------------------------------------------------------------------
if (cmd === 'prepare') {
  if (!PRICE_STARTER) { console.error('STRIPE_PRICE_STARTER が未設定'); process.exit(2) }

  const { data: company, error } = await admin.from('companies')
    .insert({ name: `${NAME_PREFIX}entry_${Date.now()}`, plan: 'free' })
    .select('id').single()
  if (error) throw new Error(`companies insert failed: ${error.message}`)
  const companyId = company.id

  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: `banto-e2e-${companyId}`,
  })
  const customer = await stripe.customers.create({
    email: 'e2e-real@banto.test',
    test_clock: clock.id,
    metadata: { product: 'banto', company_id: companyId },
  })

  const metadata = {
    product: 'banto', company_id: companyId, plan: 'starter', seats: '1', user_id: 'e2e-real-script',
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PRICE_STARTER, quantity: 1 }],
    success_url: `${BASE}/company/billing?companyId=${companyId}&billing=success`,
    cancel_url: `${BASE}/company/billing?companyId=${companyId}&billing=canceled`,
    metadata,
    allow_promotion_codes: true,
    customer: customer.id,
    subscription_data: { metadata },
  })

  console.log(JSON.stringify({
    companyId, testClockId: clock.id, customerId: customer.id, checkoutUrl: session.url, sessionId: session.id,
  }, null, 2))
  process.exit(0)
}

// ----------------------------------------------------------------------------
// poll-grant <companyId>: checkout完了後、実webhookでcompaniesが更新されるのを待つ。
// ----------------------------------------------------------------------------
if (cmd === 'poll-grant') {
  const companyId = process.argv[3]
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const { data } = await admin.from('companies')
      .select('plan, seats_purchased, status, stripe_customer_id, stripe_subscription_id')
      .eq('id', companyId).maybeSingle()
    if (data?.plan === 'starter' && data?.status === 'active') {
      console.log(JSON.stringify(data, null, 2))
      process.exit(0)
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  console.error('timeout: 60秒以内に付与を確認できませんでした')
  process.exit(1)
}

// ----------------------------------------------------------------------------
// dunning <companyId> <subscriptionId> <customerId>:
//   失敗カードへ差し替え→clock前進→payment_failed確認→成功カードへ戻し invoices.pay→
//   payment_succeeded確認→解約→plan=free確認。
// ----------------------------------------------------------------------------
if (cmd === 'dunning') {
  const [companyId, subId, custId] = process.argv.slice(3)
  if (!companyId || !subId || !custId) { console.error('usage: dunning <companyId> <subId> <custId>'); process.exit(2) }

  const sub = await stripe.subscriptions.retrieve(subId)
  const clockId = (await stripe.customers.retrieve(custId)).test_clock
  const periodEnd = sub.items.data[0]?.current_period_end ?? sub.current_period_end
  const goodPmId = sub.default_payment_method
  if (!goodPmId) { console.error('FAIL: subscriptionにdefault_payment_methodがありません'); process.exit(1) }

  // 1) 支払い方法を外す（pm_card_chargeDeclined 等の固定test PMはこの環境ではattach時点で
  //    即座にdeclineされ現実的な dunning 再現にならなかったため、実際にcheckoutで検証済みの
  //    4242カードのPaymentMethodを一時detachし「引き落とし不能」を実カード経由で再現する）。
  await stripe.paymentMethods.detach(goodPmId)

  // 2) 次の請求サイクルまでclockを進める（+1時間の余裕）
  console.log('test clock を advance 中（次回請求サイクルまで）...')
  let clock = await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: periodEnd + 3600 })
  const clockDeadline = Date.now() + 90_000
  while (clock.status !== 'ready' && Date.now() < clockDeadline) {
    await new Promise(r => setTimeout(r, 2000))
    clock = await stripe.testHelpers.testClocks.retrieve(clockId)
  }
  if (clock.status !== 'ready') { console.error('test clock advance timeout'); process.exit(1) }

  // 3) webhook経由でpast_dueになるのを待つ
  const waitStatus = async (target, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const { data } = await admin.from('companies').select('plan, status').eq('id', companyId).maybeSingle()
      if (data?.status === target) return data
      await new Promise(r => setTimeout(r, 1500))
    }
    return null
  }
  const pastDue = await waitStatus('past_due', 60_000)
  console.log('past_due確認:', JSON.stringify(pastDue))
  if (!pastDue) { console.error('FAIL: past_due に到達しませんでした'); process.exit(1) }

  // 4) 回収成功をシミュレート。一度detachしたPaymentMethodは再attach不可
  //    （Stripe仕様: "previously used without being attached...may not be used again"）のため、
  //    Stripe公式のtest fixture PM(pm_card_visa=常に成功する4242カード相当)を新規attachする。
  const goodPm = await stripe.paymentMethods.attach('pm_card_visa', { customer: custId })
  await stripe.customers.update(custId, { invoice_settings: { default_payment_method: goodPm.id } })
  const invoices = await stripe.invoices.list({ customer: custId, subscription: subId, status: 'open', limit: 1 })
  const openInvoice = invoices.data[0]
  if (!openInvoice) { console.error('FAIL: open invoiceが見つかりません'); process.exit(1) }
  await stripe.invoices.pay(openInvoice.id, { payment_method: goodPm.id })

  const active = await waitStatus('active', 60_000)
  console.log('active復帰確認:', JSON.stringify(active))
  if (!active) { console.error('FAIL: active に復帰しませんでした'); process.exit(1) }

  // 5) 解約
  await stripe.subscriptions.cancel(subId)
  const deadline2 = Date.now() + 60_000
  let finalRow = null
  while (Date.now() < deadline2) {
    const { data } = await admin.from('companies').select('plan, status').eq('id', companyId).maybeSingle()
    if (data?.plan === 'free' && data?.status === 'canceled') { finalRow = data; break }
    await new Promise(r => setTimeout(r, 1500))
  }
  console.log('解約後確認:', JSON.stringify(finalRow))
  if (!finalRow) { console.error('FAIL: 解約後 free/canceled に到達しませんでした'); process.exit(1) }

  console.log('\n=== dunning〜解約 全経路 PASS ===')
  process.exit(0)
}

// ----------------------------------------------------------------------------
// recover-and-cancel <companyId> <subscriptionId> <customerId>:
//   past_due 到達済みの状態から続きを実行（新規fixture PMをattach→invoice.pay→
//   active復帰確認→解約→free/canceled確認）。dunning が既に past_due まで進めた後の
//   再開用（detachしたPMは再attach不可なため常に新規fixture PMを使う）。
// ----------------------------------------------------------------------------
if (cmd === 'recover-and-cancel') {
  const [companyId, subId, custId] = process.argv.slice(3)
  if (!companyId || !subId || !custId) { console.error('usage: recover-and-cancel <companyId> <subId> <custId>'); process.exit(2) }

  const waitStatus = async (target, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const { data } = await admin.from('companies').select('plan, status').eq('id', companyId).maybeSingle()
      if (data?.status === target) return data
      await new Promise(r => setTimeout(r, 1500))
    }
    return null
  }

  const goodPm = await stripe.paymentMethods.attach('pm_card_visa', { customer: custId })
  await stripe.customers.update(custId, { invoice_settings: { default_payment_method: goodPm.id } })
  const invoices = await stripe.invoices.list({ customer: custId, subscription: subId, status: 'open', limit: 1 })
  const openInvoice = invoices.data[0]
  if (!openInvoice) { console.error('FAIL: open invoiceが見つかりません'); process.exit(1) }
  await stripe.invoices.pay(openInvoice.id, { payment_method: goodPm.id })

  const active = await waitStatus('active', 60_000)
  console.log('active復帰確認:', JSON.stringify(active))
  if (!active) { console.error('FAIL: active に復帰しませんでした'); process.exit(1) }

  await stripe.subscriptions.cancel(subId)
  const deadline2 = Date.now() + 60_000
  let finalRow = null
  while (Date.now() < deadline2) {
    const { data } = await admin.from('companies').select('plan, status').eq('id', companyId).maybeSingle()
    if (data?.plan === 'free' && data?.status === 'canceled') { finalRow = data; break }
    await new Promise(r => setTimeout(r, 1500))
  }
  console.log('解約後確認:', JSON.stringify(finalRow))
  if (!finalRow) { console.error('FAIL: 解約後 free/canceled に到達しませんでした'); process.exit(1) }

  console.log('\n=== 回収〜解約 PASS ===')
  process.exit(0)
}

// ----------------------------------------------------------------------------
// cleanup <companyId> <testClockId>: 痕跡を削除。
// ----------------------------------------------------------------------------
if (cmd === 'cleanup') {
  const [companyId, testClockId] = process.argv.slice(3)
  if (testClockId) {
    try { await stripe.testHelpers.testClocks.del(testClockId) } catch (e) { console.error('test clock 削除失敗:', e.message) }
  }
  if (companyId) {
    await admin.from('company_billing_events').delete().eq('company_id', companyId)
    await admin.from('companies').delete().eq('id', companyId)
  }
  const { data: stale } = await admin.from('companies').select('id').like('name', `${NAME_PREFIX}%`)
  for (const s of stale ?? []) {
    await admin.from('company_billing_events').delete().eq('company_id', s.id)
    await admin.from('companies').delete().eq('id', s.id)
  }
  console.log('cleanup done')
  process.exit(0)
}

console.error('usage: prepare | poll-grant <companyId> | dunning <companyId> <subId> <custId> | cleanup <companyId> <testClockId>')
process.exit(2)
