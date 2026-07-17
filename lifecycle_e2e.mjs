#!/usr/bin/env node
// ============================================================================
// lifecycle_e2e.mjs — 番頭(Banto) 課金ライフサイクル E2E（Stripe test モード専用）
// ----------------------------------------------------------------------------
// 目的（8/5 課金解禁の「機械条件」化）:
//   本番価格構造（lib/plans.ts の SSOT: Entry¥3,980 / Standard¥9,800 / 士業¥29,800）を
//   Stripe **test モード**の実トランザクションで一通り流し、サブスクの状態機械
//   （checkout→active→past_due→復帰→解約）が webhook 実装(app/api/company/billing/
//   webhook/route.ts)の想定どおり遷移することを実測で確認する。
//   「全ステート GREEN」を課金解禁の機械条件として解禁 runbook に書けるようにする。
//
// 安全（実課金を絶対に起こさない・CEO 厳命）:
//   1) STRIPE_SECRET_KEY が sk_test_ で始まらなければ即 abort（live 鍵では動かさない）。
//   2) このスクリプトは Stripe test API を直接叩くのみ。アプリの BILLING_ENABLED は
//      読まない・変えない（本番アプリの課金フラグとは独立。安全状態を一切いじらない）。
//   3) 生成した test 顧客/サブスクは最後に必ず後始末（cancel + delete）。
//
// 実行:
//   cd ~/memoly && node lifecycle_e2e.mjs          # .env.local を自動ロード
//   （前提 env: STRIPE_SECRET_KEY=sk_test_...、STRIPE_PRICE_STARTER/STANDARD/SHIGYO=price_...）
//   test 鍵/price が未設定の間は「PENDING（未充足の env を列挙）」で終わる＝解禁前の
//   正常状態。Takeshi が test 鍵と test price を投入したら GREEN を目指す。
//
// 現状（骨組み・2026-07-09 着手）:
//   実装済 GREEN 対象: [1] checkout→active（Customer+test PM+Subscription で active 到達）
//   TODO（数日で追加）: [2] past_due  [3] past_due→復帰(active)  [4] 自発解約→canceled
// ============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- .env.local を最小パースで読み込む（既存 process.env は上書きしない） --------
function loadEnvLocal() {
  const p = path.join(__dirname, '.env.local')
  if (!fs.existsSync(p)) return
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvLocal()

// ---- SSOT: lib/plans.ts の本番価格構造（mjs から TS は import できないため、ここに ------
//      期待値を明示し、下の driftCheck() で lib/plans.ts と機械照合してドリフトを検出する）
const EXPECTED_PLANS = {
  starter:  { displayName: 'Entry',    amount: 3980,  priceEnv: 'STRIPE_PRICE_STARTER'  },
  standard: { displayName: 'Standard', amount: 9800,  priceEnv: 'STRIPE_PRICE_STANDARD' },
  shigyo:   { displayName: '士業',      amount: 29800, priceEnv: 'STRIPE_PRICE_SHIGYO'   },
}

const results = [] // { name, state: 'GREEN'|'PENDING'|'FAIL', detail }
const rec = (name, state, detail = '') => results.push({ name, state, detail })

// ---- SSOT ドリフト検出: lib/plans.ts に期待 amount が実在するか ---------------------
function driftCheck() {
  const plansPath = path.join(__dirname, 'lib/plans.ts')
  const src = fs.readFileSync(plansPath, 'utf8')
  for (const [id, def] of Object.entries(EXPECTED_PLANS)) {
    const hasStripeAmount = new RegExp(`stripeAmount:\\s*${def.amount}\\b`).test(src)
    const hasMonthly = new RegExp(`monthlyJpy:\\s*${def.amount}\\b`).test(src)
    if (hasStripeAmount && hasMonthly) {
      rec(`ssot_drift:${id}`, 'GREEN', `lib/plans.ts に ¥${def.amount} 一致`)
    } else {
      rec(`ssot_drift:${id}`, 'FAIL',
        `lib/plans.ts に ${id}=¥${def.amount} が見つからない（価格SSOTと E2E 期待値が乖離）`)
    }
  }
}

// ---- 安全プリフライト ----------------------------------------------------------
function preflight() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    rec('preflight:stripe_key', 'PENDING',
      'STRIPE_SECRET_KEY 未設定（解禁前の正常状態）。test 鍵投入で GREEN を目指す')
    return false
  }
  if (!key.startsWith('sk_test_')) {
    rec('preflight:stripe_key', 'FAIL',
      '致命的安全違反: STRIPE_SECRET_KEY が sk_test_ で始まらない。実課金防止のため abort')
    return false
  }
  rec('preflight:stripe_key', 'GREEN', 'sk_test_ 鍵を確認（test モード）')
  return true
}

// ---- [1] checkout→active -------------------------------------------------------
// Checkout Session の決済完了はブラウザ束縛のため、E2E では Checkout UI を経由せず
// 「Customer + test PaymentMethod(pm_card_visa) + Subscription」で同じ active サブスク
// 状態へ到達させ、webhook が消費する状態機械（status=active / metadata.product=banto /
// price.unit_amount 一致）を実オブジェクトで検証する。
async function testCheckoutToActive(stripe) {
  const plan = EXPECTED_PLANS.starter // 主役プラン(Entry=starter)で代表検証
  const priceId = process.env[plan.priceEnv]
  if (!priceId) {
    rec('1:checkout_active', 'PENDING',
      `${plan.priceEnv} 未設定。test price 作成→env 投入で GREEN 化`)
    return
  }

  let customer, sub
  try {
    // price が本番構造(¥3,980・jpy・recurring)と一致するか実測
    const price = await stripe.prices.retrieve(priceId)
    if (price.unit_amount !== plan.amount) {
      rec('1:checkout_active', 'FAIL',
        `price.unit_amount=${price.unit_amount} が本番構造 ¥${plan.amount} と不一致`)
      return
    }
    if (price.currency !== 'jpy' || !price.recurring) {
      rec('1:checkout_active', 'FAIL',
        `price が jpy/recurring でない（currency=${price.currency}, recurring=${!!price.recurring}）`)
      return
    }

    customer = await stripe.customers.create({
      metadata: { product: 'banto', e2e: 'lifecycle' },
      description: 'banto lifecycle_e2e (test)',
    })
    // Stripe 公式 test PaymentMethod トークン（実カード番号を扱わない）
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: pm.id },
    })

    sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId, quantity: 1 }],
      metadata: { product: 'banto', company_id: 'e2e-test', plan: 'starter', seats: '1' },
      expand: ['latest_invoice.payment_intent'],
    })

    if (sub.status === 'active') {
      rec('1:checkout_active', 'GREEN',
        `sub=${sub.id} status=active・price ¥${plan.amount} 一致・metadata.product=banto`)
    } else {
      rec('1:checkout_active', 'FAIL', `subscription.status=${sub.status}（active 期待）`)
    }
  } catch (e) {
    rec('1:checkout_active', 'FAIL', `例外: ${e?.message ?? e}`)
  } finally {
    // 後始末（test オブジェクトを残さない）
    try { if (sub) await stripe.subscriptions.cancel(sub.id) } catch {}
    try { if (customer) await stripe.customers.del(customer.id) } catch {}
  }
}

// ---- TODO（数日で追加。骨組みは PENDING を明示的に積む） --------------------------
function stubFutureStates() {
  rec('2:past_due', 'PENDING', 'TODO: test clock で invoice.payment_failed→status=past_due を検証')
  rec('3:recovered', 'PENDING', 'TODO: past_due→invoice.payment_succeeded→status=active 復帰を検証')
  rec('4:canceled', 'PENDING', 'TODO: subscription.cancel→status=canceled（free 降格の起点）を検証')
}

// ---- main ----------------------------------------------------------------------
async function main() {
  console.log('=== 番頭 lifecycle_e2e (Stripe test モード) ===\n')
  driftCheck()

  const keyOk = preflight()
  if (keyOk) {
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    await testCheckoutToActive(stripe)
  } else {
    rec('1:checkout_active', 'PENDING', 'test 鍵未充足のためスキップ')
  }
  stubFutureStates()

  // ---- レポート ----
  const icon = { GREEN: '✅', PENDING: '⏳', FAIL: '❌' }
  let green = 0, pending = 0, fail = 0
  console.log('--- 結果 ---')
  for (const r of results) {
    console.log(`${icon[r.state] ?? '?'} [${r.state}] ${r.name}  ${r.detail}`)
    if (r.state === 'GREEN') green++
    else if (r.state === 'PENDING') pending++
    else fail++
  }
  // 解禁機械条件の対象=ライフサイクル4状態（1..4）。ssot/preflight は前提ガード。
  const lifecycleGreen = results.filter(
    r => /^[1-4]:/.test(r.name) && r.state === 'GREEN').length
  console.log('\n--- サマリ ---')
  console.log(`GREEN=${green} PENDING=${pending} FAIL=${fail}`)
  console.log(`ライフサイクル状態 GREEN: ${lifecycleGreen}/4  （解禁機械条件=4/4 かつ FAIL=0）`)
  const gateMet = fail === 0 && lifecycleGreen === 4
  console.log(`\n8/5 解禁 機械条件: ${gateMet ? '✅ 満たす' : '未達（上記 PENDING/FAIL を解消せよ）'}`)

  // FAIL があれば非0で終了（CI/解禁チェックが機械判定できるように）
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('lifecycle_e2e 実行時エラー:', e)
  process.exit(1)
})
