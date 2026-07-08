// ============================================================================
// billing_create_live_prices.mjs — 番頭 本番 Stripe Price 作成（解禁日専用・単発）
// ----------------------------------------------------------------------------
// ⚠️ これは「金銭系」操作です。実行できるのは以下3条件が全て揃ったときだけ:
//   1. STRIPE_SECRET_KEY が sk_live_（本番キー）
//   2. env CONFIRM_LIVE=BANTO-UNLOCK （タイポ防止の合言葉）
//   3. Takeshi の承認済み（BANTO_BILLING_GATE.md §3-3。スクリプトは検証できないため
//      合言葉の入力自体を「承認済みの宣言」とみなす）
//
// 作成するもの（docs/BANTO_BILLING_UNLOCK_RUNBOOK.md 手順2から呼ばれる）:
//   Product「番頭（労務記憶SaaS）」+ Price 4本
//     Entry 月額 ¥3,980 / Entry 年額 ¥39,800 / Standard 月額 ¥9,800 /
//     士業 月額 ¥29,800（席数は Checkout の quantity）
//   価格構造の正: lib/plans.ts（2026-06-29 Takeshi承認）。ここで金額は再定義しない。
//
// 冪等性: 実行前に metadata.product='banto' の既存 active Product を検索し、
//   あれば再作成せず既存 Price 一覧を出力して終了する（二重作成防止）。
//
// 使い方（解禁日）:
//   STRIPE_SECRET_KEY=sk_live_... CONFIRM_LIVE=BANTO-UNLOCK \
//     node scripts/billing_create_live_prices.mjs
// ============================================================================
import Stripe from 'stripe'
import { PLANS } from '../lib/plans.ts' // Node 22.6+ / tsx で型ストリップ実行

const key = process.env.STRIPE_SECRET_KEY ?? ''
if (!key.startsWith('sk_live_')) {
  console.error('abort: 本番キー(sk_live_)ではありません。テストモードの Price 作成は billing_lifecycle_e2e.mjs provision を使ってください。')
  process.exit(2)
}
if (process.env.CONFIRM_LIVE !== 'BANTO-UNLOCK') {
  console.error('abort: CONFIRM_LIVE=BANTO-UNLOCK がありません。')
  console.error('この操作は本番 Stripe に課金可能な Price を作成します。Takeshi 承認済みの解禁日にのみ、合言葉を付けて実行してください。')
  process.exit(2)
}

const stripe = new Stripe(key)

// 冪等ガード: 既存の banto Product があれば再作成しない。
const existing = await stripe.products.search({ query: "active:'true' AND metadata['product']:'banto'" })
let product = existing.data[0]
if (product) {
  console.log(`既存 Product を検出（再作成しません）: ${product.id}`)
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 })
  for (const p of prices.data) console.log(`  ${p.nickname ?? '(no nickname)'}: ${p.id} ¥${p.unit_amount}/${p.recurring?.interval}`)
  process.exit(0)
}

product = await stripe.products.create({ name: '番頭（労務記憶SaaS）', metadata: { product: 'banto' } })
const mk = (nickname, amount, interval) =>
  stripe.prices.create({
    product: product.id, currency: 'jpy', unit_amount: amount,
    recurring: { interval }, nickname, metadata: { product: 'banto' },
  })

// 金額は lib/plans.ts（SSOT）から取る。
const [starterM, starterY, standardM, shigyoM] = await Promise.all([
  mk('Entry 月額', PLANS.starter.monthlyJpy, 'month'),
  mk('Entry 年額', PLANS.starter.yearlyJpy, 'year'),
  mk('Standard 月額', PLANS.standard.monthlyJpy, 'month'),
  mk('士業 月額（席数=quantity）', PLANS.shigyo.monthlyJpy, 'month'),
])

console.log(`本番 Product 作成: ${product.id}`)
console.log('# 以下を Vercel production env へ（RUNBOOK 手順3）:')
console.log(`STRIPE_PRICE_STARTER=${starterM.id}`)
console.log(`STRIPE_PRICE_STANDARD=${standardM.id}`)
console.log(`STRIPE_PRICE_SHIGYO=${shigyoM.id}`)
console.log(`# 年額（checkout 未結線・結線後に使用）: ${starterY.id}`)
