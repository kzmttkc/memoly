import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysUntilKill, enforcementMetric } from '../../lib/offer.ts'

// 2026-10-01 夜: /zure が施行日当日から「施行まで 0日」と出していた。サーバは UTC なので、
//   残日は JST の暦日で数える。
test('JST 0〜9時（UTC では前日）も JST の暦日で数える', () => {
  assert.equal(daysUntilKill(new Date('2026-09-29T15:30:00Z')), 1) // JST 09-30 00:30
  assert.equal(daysUntilKill(new Date('2026-09-30T15:30:00Z')), 0) // JST 10-01 00:30
  assert.equal(daysUntilKill(new Date('2026-09-30T14:59:00Z')), 1) // JST 09-30 23:59
})

test('施行前は残日、施行日以降は施行済み', () => {
  assert.deepEqual(enforcementMetric(3), { label: '施行まで', value: '3日' })
  assert.deepEqual(enforcementMetric(0), { label: '施行済み', value: '10月1日' })
  assert.equal(enforcementMetric(daysUntilKill(new Date('2026-10-05T00:00:00Z'))).label, '施行済み')
})
