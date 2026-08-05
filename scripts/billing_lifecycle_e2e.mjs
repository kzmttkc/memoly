// ============================================================================
// billing_lifecycle_e2e.mjs — 番頭(Banto) 決済ライフサイクル E2E ハーネス（出荷ゲート用）
// ----------------------------------------------------------------------------
// 検証する全経路（BANTO_BILLING_GATE.md §3 前提条件1）:
//   checkout.session.completed（Entry月/Entry年/Standard/士業×シート）
//     → webhook 3重ガード（metadata.product='banto'／price／amount）
//     → 権利付与（companies.plan / seats_purchased / status / stripe_* 更新）
//     → 冪等（同一 event.id 再送で二重付与しない）
//     → 支払い失敗 invoice.payment_failed（dunning: plan維持・status=past_due）
//     → 回収成功 invoice.payment_succeeded（past_due→active 復帰）
//     → プラン変更 customer.subscription.updated
//     → 解約 customer.subscription.deleted（plan=free 降格・権利剥奪）
//     → クロス配信ガード（sharoushi ¥2,980 / fukuai ¥680 を ignore）
//     → 署名不正は 400
//
// 実行モード（本番 Stripe 操作は構造的に不可能にしてある）:
//   [mock]（既定・テストキー不要）
//     Stripe 実署名スキーム(t=ts,v1=HMAC-SHA256)で署名したモック webhook を
//     ローカルの実 Next サーバ（実ルート app/api/company/billing/webhook）へ直叩きし、
//     実 Supabase（service role）で companies の状態遷移を assert する。
//     fukuai の lifecycle_e2e.mjs と同じ「実署名・実エンドポイント・実DB」方式。
//     ※ STRIPE_SECRET_KEY はサーバ子プロセスから明示的に除去する（live キー混入防止）。
//   [provision]（sk_test_ キーが手に入ったら）
//     node scripts/billing_lifecycle_e2e.mjs provision
//     Stripe テストモードに番頭の Product/Price（4本）を作成し、env 行を出力する。
//     キーが sk_test_ で始まらなければ即 abort（本番モード厳禁）。
//
// 使い方:
//   npm run build                                  # 先に本番ビルド（next start 用）
//   node scripts/billing_lifecycle_e2e.mjs         # mock モード全経路検証
//   BASE_URL=... WHSEC=whsec_... node scripts/billing_lifecycle_e2e.mjs --no-server
//                                                  # 外部サーバに対して実行
//   STRIPE_SECRET_KEY=sk_test_... node scripts/billing_lifecycle_e2e.mjs provision
//
// 1つでも FAIL なら exit 1（=出荷ブロック）。テスト痕跡（会社・課金イベント）は
// 実行後に service role で完全削除する（解禁条件(a)の companies 累計を汚さない）。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildBillingReturnUrls } from '../lib/checkout-url.ts'
import { PLANS, PAID_PLAN_IDS, priceIdForPlan } from '../lib/plans.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- .env.local をパース（dotenv 非依存・秘密は出力しない） ---
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SERVICE) { console.error('.env.local に Supabase env がありません'); process.exit(2) }

// ============================================================================
// provision サブコマンド — Stripe テストモードに Product/Price を作成
// ============================================================================
if (process.argv[2] === 'provision') {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key.startsWith('sk_test_')) {
    console.error('abort: STRIPE_SECRET_KEY が sk_test_ で始まりません。本番モードでの Price 作成は厳禁です。')
    console.error('→ Takeshi 必要作業: Stripe ダッシュボード右上「テストモード」でテストAPIキーを取得してください。')
    process.exit(2)
  }
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key)
  const product = await stripe.products.create({ name: '番頭（労務記憶SaaS）', metadata: { product: 'banto' } })
  const mk = (nickname, amount, interval) =>
    stripe.prices.create({
      product: product.id, currency: 'jpy', unit_amount: amount,
      recurring: { interval }, nickname, metadata: { product: 'banto' },
    })
  const [starterM, starterY, standardM, shigyoM] = await Promise.all([
    mk('Entry 月額', 3980, 'month'),
    mk('Entry 年額', 39800, 'year'),
    mk('Standard 月額', 9800, 'month'),
    mk('士業 月額（席数=quantity）', 29800, 'month'),
  ])
  console.log('# テストモード Price 作成完了。以下を env（テスト環境）へ:')
  console.log(`STRIPE_PRICE_STARTER=${starterM.id}`)
  console.log(`STRIPE_PRICE_STARTER_YEARLY=${starterY.id}  # 年額は checkout 未結線（RUNBOOK 参照）`)
  console.log(`STRIPE_PRICE_STANDARD=${standardM.id}`)
  console.log(`STRIPE_PRICE_SHIGYO=${shigyoM.id}`)
  process.exit(0)
}

// ============================================================================
// mock モード本体
// ============================================================================
const NO_SERVER = process.argv.includes('--no-server')
const PORT = Number(process.env.PORT ?? 3300)
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`
const WHSEC = process.env.WHSEC ?? 'whsec_e2e_' + crypto.randomBytes(16).toString('hex')
const HOOK = `${BASE}/api/company/billing/webhook`

const admin = createClient(SB_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

let pass = 0, fail = 0
const A = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
  ok ? pass++ : fail++
}

// Stripe 実署名（t=ts,v1=HMAC-SHA256(whsec, ts.raw)）
const sign = raw => {
  const t = Math.floor(Date.now() / 1000).toString()
  return `t=${t},v1=${crypto.createHmac('sha256', WHSEC).update(t + '.' + raw).digest('hex')}`
}
const postEv = async (ev, badSig = false) => {
  const raw = JSON.stringify(ev)
  const r = await fetch(HOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': badSig ? 't=1,v1=deadbeef' : sign(raw) },
    body: raw,
  })
  return { status: r.status, body: await r.text() }
}
const evId = p => `evt_e2e_${p}_${crypto.randomBytes(6).toString('hex')}`

// モックイベント生成
//
// 2026-08-05 障害対応で追記: 実際の Stripe の checkout.session は payment_status を
// 必ず持つフィールドだが（'paid' / 'unpaid' / 'no_payment_required'）、このモックは
// d528615（2026-07-30・#7入金確認ガード追加）まで payment_status を一切設定しておらず
// undefined だった。isCheckoutPaid(undefined) は false のため、そのコミット以降
// billing_lifecycle_e2e が全チェックアウトを「未入金」として弾く状態で6日間 FAIL し続けた
// （state/decisions/2026-08.md 参照）。実際の本番Webhookコード・isCheckoutPaid自体は
// tests/unit/billing-webhook.test.ts で正しく検証済みで、壊れていたのはこのテスト側の
// モックだけだった。既定を 'paid'（実際の正常完了時の値）にし、明示的に上書きできるように
// paymentStatus を引数へ追加する。
const ckEvent = ({ id, amount, companyId, plan, seats, cust, sub, banto = true, paymentStatus = 'paid' }) => ({
  id, object: 'event', type: 'checkout.session.completed', api_version: '2025-06-30',
  created: Math.floor(Date.now() / 1000), livemode: false,
  data: { object: {
    object: 'checkout.session', id: 'cs_e2e_' + crypto.randomBytes(6).toString('hex'),
    amount_total: amount, customer: cust, subscription: sub, payment_status: paymentStatus,
    metadata: banto ? { product: 'banto', company_id: companyId, plan, seats: String(seats) } : {},
    customer_details: { email: 'e2e@banto.test' },
  } },
})
// 2026-08-05 敵対的再監査（billing_lifecycle_e2e.mjsのpayment_status欠落と同種の欠陥が
// 他イベント種別にも無いかの全種チェック）: 本番のStripe subscriptionオブジェクトは
// pause_collectionフィールドを常に持つ（null=通常課金中／オブジェクト=請求一時停止中）。
// webhook route.ts は `pausedCollection: sub.pause_collection != null` でこれを判定するが、
// このモックはpause_collectionを一切設定しておらず既定でundefinedだった。webhook route.ts の
// customer.subscription.paused 分岐と、customer.subscription.updated に pause_collection が
// 付くケース（Stripeの実際の到達順）の両方が、このE2Eで一度も検証されないまま6日間
// green表示になっていた（tests/unit/billing-webhook.test.tsの純関数テストは通っているが、
// それは resolveSubscriptionTransition 単体の検証であり、webhook route.ts が実際に
// sub.pause_collection を正しく読んでいるかの統合検証ではない）。既定はnull（通常課金中）、
// pausedCollection=trueのときだけオブジェクトを入れる。
const subEvent = (type, { id, sub, companyId, plan, status, pausedCollection = false }) => ({
  id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false,
  data: { object: {
    object: 'subscription', id: sub, status: status ?? 'active',
    customer: 'cus_e2e_x', items: { data: [{ price: { id: 'price_e2e_unknown' } }] },
    metadata: { product: 'banto', company_id: companyId, plan },
    pause_collection: pausedCollection ? { behavior: 'mark_uncollectible' } : null,
  } },
})
const invEvent = (type, { id, sub }) => ({
  id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false,
  data: { object: { object: 'invoice', id: 'in_e2e_' + crypto.randomBytes(4).toString('hex'), subscription: sub } },
})

// DB ヘルパ
const getCompany = async id => {
  const { data } = await admin.from('companies')
    .select('plan, seats_purchased, status, stripe_customer_id, stripe_subscription_id')
    .eq('id', id).maybeSingle()
  return data
}
const NAME_PREFIX = 'E2E課金検証_'
const createCompany = async label => {
  const { data, error } = await admin.from('companies')
    .insert({ name: `${NAME_PREFIX}${label}_${Date.now()}`, plan: 'free' })
    .select('id').single()
  if (error) throw new Error(`companies insert failed: ${error.message}`)
  return data.id
}
const cleanup = async ids => {
  // 課金イベント（監査ログ）→会社の順で痕跡を完全削除。stale な過去残骸も掃除。
  if (ids.length) await admin.from('company_billing_events').delete().in('company_id', ids)
  if (ids.length) await admin.from('companies').delete().in('id', ids)
  const { data: stale } = await admin.from('companies').select('id').like('name', `${NAME_PREFIX}%`)
  for (const s of stale ?? []) {
    await admin.from('company_billing_events').delete().eq('company_id', s.id)
    await admin.from('companies').delete().eq('id', s.id)
  }
}

// --- ローカルサーバ起動（next start・STRIPE_SECRET_KEY は明示除去＝live 混入防止） ---
let server = null
async function startServer() {
  const childEnv = { ...process.env, STRIPE_WEBHOOK_SECRET: WHSEC, PORT: String(PORT) }
  delete childEnv.STRIPE_SECRET_KEY // 本番キーがシェルにあっても子には渡さない
  server = spawn(join(ROOT, 'node_modules', '.bin', 'next'), ['start', '-p', String(PORT)], {
    cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stderr.on('data', d => { const s = String(d); if (/error/i.test(s)) process.stderr.write('[next] ' + s) })
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try { const r = await fetch(BASE + '/', { redirect: 'manual' }); if (r.status < 500) return } catch {}
    await new Promise(r => setTimeout(r, 700))
  }
  throw new Error('next start が 60 秒以内に起動しませんでした（npm run build 済みか確認）')
}
const stopServer = () => { if (server) { server.kill('SIGTERM'); server = null } }

// ============================================================================
// 実行
// ============================================================================
const created = []
try {
  if (!NO_SERVER) {
    console.log(`\nローカル実サーバ起動中（next start :${PORT} / STRIPE_WEBHOOK_SECRET=ハーネス生成値）...`)
    await startServer()
  }
  console.log(`\n=== 番頭 決済ライフサイクル E2E（mock署名・実ルート・実DB） ${HOOK} ===\n`)

  // --- -1. 回帰防止(2026-07-26発見バグ): success_url/cancel_url の?二重連結ガード ---
  //   lib/stripe.ts createSeatCheckoutSession が実際に使う純関数を直接呼び、
  //   companyId付きreturnUrl(実運用の実際の形)を渡した際に ? が1つだけになることを
  //   このゲート自身でも検知する（tests/unit/checkout-url.test.ts と二重防御）。
  const urlCheckReturnUrl = 'https://banto-roumu.com/company/billing?companyId=e2e-dummy-company-id'
  const { successUrl: urlCheckSuccess, cancelUrl: urlCheckCancel } = buildBillingReturnUrls(urlCheckReturnUrl)
  A('回帰防止: success_urlの?は1つのみ（companyId付きreturnUrlで二重?にならない）',
    (urlCheckSuccess.match(/\?/g) ?? []).length === 1 && urlCheckSuccess.endsWith('&billing=success'),
    urlCheckSuccess)
  A('回帰防止: cancel_urlの?は1つのみ（companyId付きreturnUrlで二重?にならない）',
    (urlCheckCancel.match(/\?/g) ?? []).length === 1 && urlCheckCancel.endsWith('&billing=canceled'),
    urlCheckCancel)

  // --- -0.5. Entry/Standard/士業 3プランの Price 実額チェック + Checkout画面到達 ---
  //   webhookの状態遷移テスト(下の1〜4)は「Stripeがこのamountで通知してきたら」を
  //   前提にした mock であり、env の STRIPE_PRICE_* が実際に正しい金額のPriceを
  //   指しているか・実際にcheckout.stripe.comへ到達するURLが発行されるかは検証していない。
  //   STRIPE_SECRET_KEY が sk_test_ の場合のみ、実Stripe API(read-only retrieve +
  //   未完了のcheckout session作成のみ・カード入力・決済は一切発生しない)で検証する。
  const stripeKey = env.STRIPE_SECRET_KEY ?? ''
  if (!stripeKey.startsWith('sk_test_')) {
    console.log('  ⚠️  SKIP  Price実額/Checkout到達チェック（STRIPE_SECRET_KEYがsk_test_以外のため安全側でスキップ）')
  } else {
    const { default: StripeSDK } = await import('stripe')
    const stripeCheck = new StripeSDK(stripeKey)
    for (const planId of PAID_PLAN_IDS) {
      const def = PLANS[planId]
      const monthPriceId = def.priceEnvVar ? env[def.priceEnvVar] : undefined
      if (!monthPriceId) {
        A(`Price設定確認: ${planId}(月額) env(${def.priceEnvVar})が未設定`, false, '未設定＝checkoutは503で塞がる想定')
        continue
      }
      // 実額チェック（read-only retrieve。決済も作成も発生しない）
      try {
        const priceObj = await stripeCheck.prices.retrieve(monthPriceId)
        A(`Price実額: ${planId}(月額) Stripe Price.unit_amount === PLANS定義(¥${def.stripeAmount})`,
          priceObj.unit_amount === def.stripeAmount, `stripe=${priceObj.unit_amount} plans.ts=${def.stripeAmount}`)
      } catch (e) {
        A(`Price実額: ${planId}(月額) retrieve失敗`, false, e.message)
      }
      // Checkout到達性チェック（実session作成→checkout.stripe.comのURLか確認→即expireで痕跡消去）
      try {
        const quantity = def.multiClient ? 2 : 1 // 士業=席課金の実挙動を反映（2席）。他は1固定。
        const session = await stripeCheck.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: monthPriceId, quantity }],
          success_url: 'https://banto-roumu.com/company/billing?companyId=e2e-canary&billing=success',
          cancel_url: 'https://banto-roumu.com/company/billing?companyId=e2e-canary&billing=canceled',
          metadata: { product: 'banto', company_id: 'e2e-canary', plan: planId, seats: String(quantity), canary: 'true' },
        })
        A(`Checkout到達: ${planId}(月額) checkout.stripe.comのURLが発行される`,
          typeof session.url === 'string' && session.url.startsWith('https://checkout.stripe.com/'),
          session.url ?? 'url=null')
        await stripeCheck.checkout.sessions.expire(session.id) // 未完了のまま即失効（テスト痕跡を残さない）
      } catch (e) {
        A(`Checkout到達: ${planId}(月額) session作成失敗`, false, e.message)
      }
    }
  }

  // --- 0. 署名不正は 400 ---
  const bad = await postEv(ckEvent({ id: evId('bad'), amount: 3980, companyId: 'x', plan: 'starter', seats: 1, cust: 'cus_x', sub: 'sub_x' }), true)
  A('署名ガード: 不正署名は 400', bad.status === 400, `http=${bad.status}`)

  // --- 0b. 未入金checkout(payment_status='unpaid')は付与しない（監査#7・2026-08-05に
  //     このガード自体のE2Eモックがpayment_statusを一切設定しておらず、正常な支払い済み
  //     checkoutまで「未入金」扱いされ6日間全FAILした事故があった。以後、正常系(payment_status
  //     未指定=既定'paid')と異常系(明示的に'unpaid')の両方をE2Eで固定する）。
  const c0b = await createCompany('unpaid_checkout'); created.push(c0b)
  const unpaidId = evId('unpaid')
  const unpaidRes = await postEv(ckEvent({
    id: unpaidId, amount: 3980, companyId: c0b, plan: 'starter', seats: 1,
    cust: 'cus_e2e_unpaid', sub: 'sub_e2e_unpaid', paymentStatus: 'unpaid',
  }))
  const rowUnpaid = await getCompany(c0b)
  A('入金確認: payment_status=unpaidのcheckoutは付与しない（plan=free維持）',
    unpaidRes.status === 200 && rowUnpaid?.plan === 'free' && rowUnpaid?.stripe_customer_id === null,
    `http=${unpaidRes.status} plan=${rowUnpaid?.plan} body=${unpaidRes.body}`)

  // --- 1. Entry 月額 ¥3,980 付与 → 全ライフサイクル ---
  const c1 = await createCompany('entry_monthly'); created.push(c1)
  const cust1 = 'cus_e2e_' + crypto.randomBytes(5).toString('hex')
  const sub1 = 'sub_e2e_' + crypto.randomBytes(5).toString('hex')
  const grantId = evId('grant')
  const g = await postEv(ckEvent({ id: grantId, amount: 3980, companyId: c1, plan: 'starter', seats: 1, cust: cust1, sub: sub1 }))
  let row = await getCompany(c1)
  A('付与: Entry月額 checkout→plan=starter/status=active', g.status === 200 && row?.plan === 'starter' && row?.status === 'active', `http=${g.status} plan=${row?.plan}`)
  A('付与: stripe_customer_id / subscription_id 保存', row?.stripe_customer_id === cust1 && row?.stripe_subscription_id === sub1)

  // 冪等: 同一 event.id 再送
  const dup = await postEv(ckEvent({ id: grantId, amount: 3980, companyId: c1, plan: 'starter', seats: 1, cust: cust1, sub: sub1 }))
  row = await getCompany(c1)
  A('冪等: 同一event.id再送は already processed・状態不変', dup.status === 200 && /already|duplicate/.test(dup.body) && row?.plan === 'starter', dup.body.slice(0, 40))

  // dunning: 実Stripeの実際の到達順は
  //   customer.subscription.updated(status=past_due) → invoice.payment_failed。
  //   前者を「非active→即free」で処理する回帰バグ(2026-07-09発見)を再発検知するため、
  //   まず subscription.updated(past_due) 単体で plan 維持を確認してから invoice.payment_failed を送る。
  const su = await postEv(subEvent('customer.subscription.updated', { id: evId('su_pd'), sub: sub1, companyId: c1, plan: 'starter', status: 'past_due' }))
  row = await getCompany(c1)
  A('回帰防止: subscription.updated(past_due)→plan維持・status=past_due', su.status === 200 && row?.status === 'past_due' && row?.plan === 'starter', `plan=${row?.plan} status=${row?.status}`)

  // dunning: 支払い失敗 → plan 維持・past_due
  const pf = await postEv(invEvent('invoice.payment_failed', { id: evId('pf'), sub: sub1 }))
  row = await getCompany(c1)
  A('dunning: payment_failed→status=past_due・plan維持', pf.status === 200 && row?.status === 'past_due' && row?.plan === 'starter', `status=${row?.status}`)

  // 回収成功 → active 復帰
  const ps = await postEv(invEvent('invoice.payment_succeeded', { id: evId('ps'), sub: sub1 }))
  row = await getCompany(c1)
  A('復帰: payment_succeeded→past_due から active', ps.status === 200 && row?.status === 'active', `status=${row?.status}`)

  // プラン変更（subscription.updated / metadata.plan=standard）
  const up = await postEv(subEvent('customer.subscription.updated', { id: evId('up'), sub: sub1, companyId: c1, plan: 'standard', status: 'active' }))
  row = await getCompany(c1)
  A('プラン変更: subscription.updated→plan=standard', up.status === 200 && row?.plan === 'standard', `plan=${row?.plan}`)

  // 解約 → free 降格（権利剥奪）
  const del = await postEv(subEvent('customer.subscription.deleted', { id: evId('del'), sub: sub1, companyId: c1, plan: 'standard', status: 'canceled' }))
  row = await getCompany(c1)
  A('解約: subscription.deleted→plan=free/status=canceled', del.status === 200 && row?.plan === 'free' && row?.status === 'canceled', `plan=${row?.plan} status=${row?.status}`)

  // --- 2. Entry 年額 ¥39,800（amount は PAID_AMOUNTS 外→metadata ガードで付与） ---
  const c2 = await createCompany('entry_yearly'); created.push(c2)
  const gy = await postEv(ckEvent({ id: evId('gy'), amount: 39800, companyId: c2, plan: 'starter', seats: 1, cust: 'cus_e2e_y', sub: 'sub_e2e_y_' + Date.now() }))
  row = await getCompany(c2)
  A('付与: Entry年額¥39,800→plan=starter（metadataガード経由）', gy.status === 200 && row?.plan === 'starter', `plan=${row?.plan}`)

  // --- 3. Standard ¥9,800 ---
  const c3 = await createCompany('standard'); created.push(c3)
  const gs = await postEv(ckEvent({ id: evId('gs'), amount: 9800, companyId: c3, plan: 'standard', seats: 5, cust: 'cus_e2e_s', sub: 'sub_e2e_s_' + Date.now() }))
  row = await getCompany(c3)
  A('付与: Standard¥9,800→plan=standard/seats=5', gs.status === 200 && row?.plan === 'standard' && row?.seats_purchased === 5, `plan=${row?.plan} seats=${row?.seats_purchased}`)

  // --- 4. 士業 ¥29,800 × 3席（quantity 課金: amount_total=89,400） ---
  const c4 = await createCompany('shigyo_seats'); created.push(c4)
  const gsh = await postEv(ckEvent({ id: evId('gsh'), amount: 89400, companyId: c4, plan: 'shigyo', seats: 3, cust: 'cus_e2e_sh', sub: 'sub_e2e_sh_' + Date.now() }))
  row = await getCompany(c4)
  A('付与: 士業¥29,800×3席→plan=shigyo/seats=3', gsh.status === 200 && row?.plan === 'shigyo' && row?.seats_purchased === 3, `plan=${row?.plan} seats=${row?.seats_purchased}`)

  // --- 4b. 請求一時停止（pause_collection）→ free降格（監査#4の再発検知・2026-08-05追加）
  //     実測される2つの到達経路をどちらもE2Eで固定する:
  //       (a) event.type='customer.subscription.paused' 単体で status='paused' が来る
  //       (b) event.type='customer.subscription.updated' で status='active' のまま
  //           pause_collection だけが立つ（Stripeでは請求停止時にstatusは変わらない）
  //     どちらも「有料機能を無償で使い続けられる穴」の再発検知点であり、
  //     tests/unit/billing-webhook.test.tsの純関数テストとは別に、webhook route.tsが
  //     実際にpause_collectionを読んでDBへ反映するところまでを実サーバ・実DBで検証する。
  const c4b = await createCompany('pause_collection'); created.push(c4b)
  const sub4b = 'sub_e2e_pause_' + Date.now()
  const g4b = await postEv(ckEvent({ id: evId('g4b'), amount: 3980, companyId: c4b, plan: 'starter', seats: 1, cust: 'cus_e2e_pause', sub: sub4b }))
  row = await getCompany(c4b)
  A('準備: pause_collectionテスト用に付与済み(plan=starter)', g4b.status === 200 && row?.plan === 'starter', `plan=${row?.plan}`)

  const pausedType = await postEv(subEvent('customer.subscription.paused', { id: evId('paused_type'), sub: sub4b, companyId: c4b, plan: 'starter' }))
  row = await getCompany(c4b)
  A('請求停止(a): customer.subscription.paused→plan=free/status=canceled', pausedType.status === 200 && row?.plan === 'free' && row?.status === 'canceled', `plan=${row?.plan} status=${row?.status}`)

  // 復帰させてから(b)経路も独立に検証する
  const un4b = await postEv(subEvent('customer.subscription.updated', { id: evId('un4b'), sub: sub4b, companyId: c4b, plan: 'starter', status: 'active' }))
  row = await getCompany(c4b)
  A('準備: pause_collection(b)テスト用に再度active化', un4b.status === 200 && row?.plan === 'starter' && row?.status === 'active', `plan=${row?.plan} status=${row?.status}`)

  const pausedFlag = await postEv(subEvent('customer.subscription.updated', { id: evId('paused_flag'), sub: sub4b, companyId: c4b, plan: 'starter', status: 'active', pausedCollection: true }))
  row = await getCompany(c4b)
  A('請求停止(b): updated(status=active but pause_collectionあり)→plan=free/status=canceled', pausedFlag.status === 200 && row?.plan === 'free' && row?.status === 'canceled', `plan=${row?.plan} status=${row?.status}`)

  // --- 5. クロス配信ガード（他製品の決済を付与しない） ---
  const f1 = await postEv(ckEvent({ id: evId('fk'), amount: 680, companyId: c4, plan: 'starter', seats: 1, cust: 'cus_foreign_f', sub: 'sub_f', banto: false }))
  A('クロスガード: fukuai¥680（metadata無）→ignored', f1.status === 200 && /ignored/.test(f1.body), f1.body.slice(0, 45))
  const f2 = await postEv(ckEvent({ id: evId('sk'), amount: 2980, companyId: c4, plan: 'starter', seats: 1, cust: 'cus_foreign_s', sub: 'sub_s', banto: false }))
  row = await getCompany(c4)
  A('クロスガード: sharoushi¥2,980→ignored・既存planを汚さない', f2.status === 200 && /ignored/.test(f2.body) && row?.plan === 'shigyo')

  // --- 6. 監査ログ（company_billing_events）に処理イベントが過不足なく記録されている ---
  //   記録されるのは実処理した13件（grant/su_pd/pf/ps/up/del/gy/gs/gsh/g4b/paused_type/un4b/paused_flag）。
  //   冪等再送(dup)は既処理スキップ・クロス配信2件は record 前に ignore ＝ 記録されないのが正。
  const { data: evRows } = await admin.from('company_billing_events').select('event_id, event_type').in('company_id', created)
  A('監査ログ: 処理13件のみ記録（重複・他製品は記録なし）', (evRows ?? []).length === 13, `rows=${(evRows ?? []).length}`)
} catch (e) {
  console.error('\nハーネス実行エラー:', e.message)
  fail++
} finally {
  try { await cleanup(created) } catch (e) { console.error('cleanup 失敗（要手動確認）:', e.message) }
  stopServer()
}

console.log(`\n結果: ${pass} PASS / ${fail} FAIL`)
console.log(fail === 0
  ? '→ 全経路 green。解禁前提条件1（lifecycle E2E）は「mockモード」で充足。テストキー入手後に provision→実Checkoutスモークを RUNBOOK 手順で行うこと。'
  : '→ FAIL あり。出荷ブロック。')
process.exit(fail === 0 ? 0 : 1)
