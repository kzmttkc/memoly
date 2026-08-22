import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAdvisorWriteback } from '../../lib/advisor-writeback.ts'

test('社労士の返事を外部確定行にする', () => {
  const row = parseAdvisorWriteback('試用期間の延長は就業規則の根拠を入れてから、と助言された。')
  assert.equal(row.memory_type, 'decision')
  assert.equal(row.topic, '外部確定（社労士）')
  assert.equal(row.subject, null)
  assert.match(row.summary, /^【外部確定】/)
  assert.ok(row.decided_at)
})

test('空白や短文は拒否する', () => {
  assert.equal(parseAdvisorWriteback('   '), null)
  assert.equal(parseAdvisorWriteback('はい'), null)
})

test('長文は切る', () => {
  const row = parseAdvisorWriteback('あ'.repeat(2000))
  assert.ok(row)
  assert.ok(row.summary.length <= 1000)
})
