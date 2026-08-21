import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  BANTO_PRODUCT_STAMP,
  resolveCheckoutProduct,
} from '../../app/api/company/billing/webhook/transition.ts'

// ============================================================================
// 共有 Stripe アカウントのクロス配信ガード（2026-08-21 横断監査）。
//
// LIVE の Stripe アカウントは9製品で共有していて、有効な webhook エンドポイントは
// 6本ある（Agentrix / LeverageOS / UITruth / MyTone / sharoushi / 番頭）。
// Stripe は1イベントを「その種別を購読している全ての有効エンドポイント」へ配信するため、
// 他製品の checkout.session.completed も番頭の webhook に届き、署名検証を通過する。
//
// route.ts のコメントは「metadata.product + price一致 + amount一致 の**三重ガード**」と
// 書いていたが、実装は
//     if (!isBanto && !priceMatch && !amountMatch) → 無視
// で、**3つのうち1つでも当たれば通る OR** だった。AND ではない。
// この記述を手本として引用した他製品（Agentrix）まで巻き込む誤りだったので、
// 実装をコメントに合わせるのではなく、判定を price 一致中心に作り直して固定する。
//
// 金額は製品をまたいで衝突する（2026-08-21 実測）:
//   ¥9,800  番頭 Standard = sharoushi Business = UITruth Pro
//   ¥29,800 番頭 士業 = sharoushi 年払い = UITruth Starter年 = UITruth Agency月
//   ¥39,800 番頭 Entry年 = Agentrix Agency月
// つまり amount 一致は「他製品でない」ことを1ミリも保証しない。
// ============================================================================

const root = fileURLToPath(new URL('../..', import.meta.url))
const routeSource = readFileSync(root + 'app/api/company/billing/webhook/route.ts', 'utf8')

// --- 自製品は通る -----------------------------------------------------------

test('自製品の price が一致すれば付与する', () => {
  const r = resolveCheckoutProduct({ metadata: { product: 'banto' }, pricePlan: 'standard' })
  assert.deepEqual(r, { granted: true, plan: 'standard' })
})

test('刻印が無くても自製品の price なら付与する（旧顧客の Payment Link 等）', () => {
  const r = resolveCheckoutProduct({ metadata: {}, pricePlan: 'shigyo' })
  assert.deepEqual(r, { granted: true, plan: 'shigyo' })
})

// --- 他製品のクロス配信は弾く（本命の回帰テスト） ---------------------------

test('UITruth Pro（¥9,800 = 番頭 Standard と同額）では付与しない', () => {
  const r = resolveCheckoutProduct({
    metadata: { product: 'uitruth', plan: 'standard', organization_id: 'o_1' },
    pricePlan: null,
  })
  assert.deepEqual(r, { granted: false, reason: 'foreign_product' })
})

test('Agentrix Agency（¥39,800 = 番頭 Entry年 と同額）では付与しない', () => {
  const r = resolveCheckoutProduct({
    metadata: { product: 'agentrix', plan: 'agency' },
    pricePlan: null,
  })
  assert.deepEqual(r, { granted: false, reason: 'foreign_product' })
})

test('sharoushi 年払い（¥29,800 = 番頭 士業 と同額）では付与しない', () => {
  const r = resolveCheckoutProduct({ metadata: { product: 'sharoushi' }, pricePlan: null })
  assert.deepEqual(r, { granted: false, reason: 'foreign_product' })
})

test('刻印の無い他製品でも、price が一致しなければ付与しない（金額では通さない）', () => {
  // 旧実装はここで amountMatch により通っていた。
  const r = resolveCheckoutProduct({ metadata: { plan: 'standard' }, pricePlan: null })
  assert.deepEqual(r, { granted: false, reason: 'no_matching_price' })
})

test('metadata.plan が番頭の有料enumと一致していても、price が無ければ付与しない', () => {
  // 'standard' は番頭にも UITruth にも実在する PlanId。metadata.plan は根拠にならない。
  for (const plan of ['starter', 'standard', 'shigyo']) {
    const r = resolveCheckoutProduct({ metadata: { plan }, pricePlan: null })
    assert.deepEqual(r, { granted: false, reason: 'no_matching_price' }, `plan=${plan}`)
  }
})

test('自製品を名乗っていても price が他製品なら付与しない（名乗りより price が強い）', () => {
  const r = resolveCheckoutProduct({ metadata: { product: 'banto', plan: 'shigyo' }, pricePlan: null })
  assert.deepEqual(r, { granted: false, reason: 'no_matching_price' })
})

// --- 刻印の値 ---------------------------------------------------------------

test('刻印は checkout が metadata に載せる値と同一', () => {
  assert.equal(BANTO_PRODUCT_STAMP, 'banto')
})

// --- route.ts が実際にこの判定を通していること ------------------------------

test('route.ts が resolveCheckoutProduct を使っている', () => {
  assert.match(routeSource, /resolveCheckoutProduct/, 'ガードが route.ts から呼ばれていない')
})

test('route.ts に「1つでも当たれば通る」OR ガードが残っていない', () => {
  const code = routeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(
    code,
    /!isBanto\s*&&\s*!priceMatch\s*&&\s*!amountMatch/,
    'OR ガード（1つでも当たれば通る）が残っている'
  )
})

test('route.ts が amount だけで自製品と判定していない', () => {
  const code = routeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(
    code,
    /PAID_AMOUNTS\.includes/,
    'amount 一致を自製品判定に使っている（金額は製品をまたいで衝突する）'
  )
})

test('line items を引けなかったときは 200 で捨てず Stripe に再送させる', () => {
  // 旧実装は catch で priceMatch=false にするだけで、amountMatch が拾わなければ
  // 「ignored: not a banto checkout」を 200 で返していた。Stripe API の一時障害で
  // 正規顧客が無付与のまま確定してしまう（再送も来ない）。
  assert.match(
    routeSource,
    /line item[^\n]*(再送|500)|(再送|500)[^\n]*line item/,
    'line items 取得失敗時に再送させる意図が route.ts に書かれていない'
  )
})
