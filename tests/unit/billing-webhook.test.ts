import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isCheckoutPaid,
  isPaidPlanId,
  resolveSubscriptionTransition,
  pastDueExpired,
  PAST_DUE_GRACE_DAYS,
  type SubscriptionSnapshot,
} from '../../app/api/company/billing/webhook/transition.ts'

// ============================================================================
// 課金 webhook の「イベント → (plan, status)」遷移を固定する回帰テスト。
// 2026-07-30 監査で見つかった #2/#3/#4/#7 の修理を、DB・Stripe SDK 無しで守る。
// ============================================================================

function snap(over: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    status: 'active',
    pausedCollection: false,
    pricePlan: 'starter',
    metadataPlan: 'starter',
    ...over,
  }
}

// --- 正常系（既存挙動の維持） -------------------------------------------------

test('active: price 逆引きの plan を維持し status=active', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'active', pricePlan: 'shigyo' }))
  assert.deepEqual({ plan: t.plan, status: t.status, keepsPlan: t.keepsPlan }, {
    plan: 'shigyo',
    status: 'active',
    keepsPlan: true,
  })
})

test('trialing: active と同じ扱い', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'trialing' }))
  assert.equal(t.status, 'active')
  assert.equal(t.keepsPlan, true)
})

test('past_due: dunning の grace。plan は維持し status=past_due（即機能停止にしない）', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'past_due', pricePlan: 'standard' }))
  assert.deepEqual({ plan: t.plan, status: t.status }, { plan: 'standard', status: 'past_due' })
  assert.equal(t.reason, 'past_due_grace')
})

test('canceled / unpaid / incomplete_expired: free へ降格', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
    const t = resolveSubscriptionTransition(snap({ status }))
    assert.deepEqual({ plan: t.plan, status: t.status }, { plan: 'free', status: 'canceled' }, status)
  }
})

test('price が無くても metadata.plan が有料enumなら解決できる', () => {
  const t = resolveSubscriptionTransition(snap({ pricePlan: null, metadataPlan: 'shigyo' }))
  assert.equal(t.plan, 'shigyo')
})

// --- #3 plan 解決の最終フォールバックが有料 'standard' だった問題 ---------------

test('#3 price も metadata も解決不能なら plan を書き換えない（null）', () => {
  const t = resolveSubscriptionTransition(snap({ pricePlan: null, metadataPlan: undefined }))
  assert.equal(t.plan, null, 'plan は触らない')
  assert.equal(t.status, 'active', 'status だけは反映する')
  assert.equal(t.reason, 'unresolved_plan')
})

test('#3 回帰ガード: 解決不能で有料プランに倒れてはいけない', () => {
  for (const metadataPlan of [undefined, null, '', 'pro', 'enterprise', 'free', 123, {}]) {
    const t = resolveSubscriptionTransition(snap({ pricePlan: null, metadataPlan }))
    assert.notEqual(t.plan, 'standard', `metadataPlan=${String(metadataPlan)} で standard に倒れた`)
    assert.notEqual(t.plan, 'starter')
    assert.notEqual(t.plan, 'shigyo')
  }
})

test('isPaidPlanId: 有料enumだけを通す（free と旧enumは弾く）', () => {
  assert.equal(isPaidPlanId('starter'), true)
  assert.equal(isPaidPlanId('standard'), true)
  assert.equal(isPaidPlanId('shigyo'), true)
  assert.equal(isPaidPlanId('free'), false)
  assert.equal(isPaidPlanId('pro'), false)
  assert.equal(isPaidPlanId(undefined), false)
})

// --- #4 pause_collection / paused の未処理 -------------------------------------

test('#4 pause_collection があれば status=active でも free へ降格', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'active', pausedCollection: true }))
  assert.deepEqual({ plan: t.plan, status: t.status, keepsPlan: t.keepsPlan }, {
    plan: 'free',
    status: 'canceled',
    keepsPlan: false,
  })
  assert.equal(t.reason, 'paused_collection')
})

test('#4 status=paused（customer.subscription.paused）も free へ降格', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'paused' }))
  assert.equal(t.plan, 'free')
  assert.equal(t.keepsPlan, false)
})

test('#4 past_due + 請求停止は「停止」が優先（猶予を悪用させない）', () => {
  const t = resolveSubscriptionTransition(snap({ status: 'past_due', pausedCollection: true }))
  assert.equal(t.keepsPlan, false)
  assert.equal(t.plan, 'free')
})

// --- #7 checkout.session.completed の payment_status --------------------------

test('#7 入金済み（paid / no_payment_required）だけ付与を許す', () => {
  assert.equal(isCheckoutPaid('paid'), true)
  assert.equal(isCheckoutPaid('no_payment_required'), true)
  assert.equal(isCheckoutPaid('unpaid'), false)
  assert.equal(isCheckoutPaid(null), false)
  assert.equal(isCheckoutPaid(undefined), false)
})

// --- #2 past_due の時間上限 ----------------------------------------------------

test('#2 猶予は21日', () => {
  assert.equal(PAST_DUE_GRACE_DAYS, 21)
})

test('#2 22日前に滞納開始した会社は期限超過', () => {
  const now = new Date('2026-07-30T00:00:00Z')
  const since = new Date('2026-07-08T00:00:00Z').toISOString() // 22日前
  assert.equal(pastDueExpired(since, now), true)
})

test('#2 20日前・ちょうど21日前は超過にしない（早期降格を防ぐ）', () => {
  const now = new Date('2026-07-30T00:00:00Z')
  assert.equal(pastDueExpired(new Date('2026-07-10T00:00:00Z').toISOString(), now), false)
  assert.equal(pastDueExpired(new Date('2026-07-09T00:00:00Z').toISOString(), now), false)
})

test('#2 past_due_since が無い/壊れているときは落とさない（判定不能は安全側）', () => {
  const now = new Date('2026-07-30T00:00:00Z')
  assert.equal(pastDueExpired(null, now), false)
  assert.equal(pastDueExpired(undefined, now), false)
  assert.equal(pastDueExpired('not-a-date', now), false)
})
