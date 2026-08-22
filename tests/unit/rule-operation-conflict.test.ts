import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectRuleOperationConflicts } from '../../lib/rule-operation-conflict.ts'

test('同じ論点の規程と運用が食い違うとき1件出す', () => {
  const conflicts = detectRuleOperationConflicts([
    { key: '有給の規程', value: '入社6か月後に10日' },
    { key: '有給の運用', value: '入社直後から付与している' },
  ])
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].topic, '有給')
  assert.match(conflicts[0].ruleValue, /10日/)
  assert.match(conflicts[0].operationValue, /入社直後/)
})

test('値が同じなら出さない', () => {
  const conflicts = detectRuleOperationConflicts([
    { key: '有給の規程', value: '10日' },
    { key: '有給の運用', value: '10日' },
  ])
  assert.equal(conflicts.length, 0)
})

test('規程だけ・運用だけのときは出さない', () => {
  assert.equal(
    detectRuleOperationConflicts([{ key: '有給の規程', value: '10日' }]).length,
    0,
  )
  assert.equal(
    detectRuleOperationConflicts([{ key: '有給の運用', value: '現場判断' }]).length,
    0,
  )
})
