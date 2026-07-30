import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usageSubjectId } from '../../lib/plans.ts'

// ============================================================================
// 2026-07-30 監査 #9: LLM系の利用量カウンタの主体がユーザーだと、席を増やすほど
//   無料枠が線形に増える（free chat 20/日 × 席3 = 60/日）。課金主体は会社なので、
//   会社が特定できるときは会社IDで数える。特定できないときだけ userId に倒す。
// ============================================================================

test('会社IDがあれば会社を主体にする', () => {
  assert.equal(usageSubjectId('user-1', 'company-1'), 'company-1')
})

test('会社IDが無ければ userId に倒す（従来挙動＝無退行）', () => {
  assert.equal(usageSubjectId('user-1', null), 'user-1')
  assert.equal(usageSubjectId('user-1', undefined), 'user-1')
  assert.equal(usageSubjectId('user-1', ''), 'user-1')
})

test('同一会社の別ユーザーは同じ主体になる（席で1社ぶんの枠を分け合う）', () => {
  assert.equal(usageSubjectId('user-a', 'company-1'), usageSubjectId('user-b', 'company-1'))
})
