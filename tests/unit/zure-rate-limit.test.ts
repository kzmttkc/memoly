import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  retryAfterSeconds,
  retryUntilMs,
  retryWaitMessage,
  ZURE_RL_MAX,
  ZURE_RL_WINDOW_MS,
} from '../../lib/zure-rate-limit.ts'

test('8回未満は待たない', () => {
  const now = 1_000_000
  assert.equal(retryAfterSeconds([now - 1000], now), null)
})

test('8回に達したら、最も古いヒットの残り秒を返す', () => {
  const now = 10_000
  const hits = Array.from({ length: ZURE_RL_MAX }, (_, i) => i)
  const sec = retryAfterSeconds(hits, now)
  assert.ok(sec !== null)
  const expected = Math.ceil((0 + ZURE_RL_WINDOW_MS - now) / 1000)
  assert.equal(sec, expected)
})

test('Retry-After 秒から再開時刻を出す', () => {
  assert.equal(retryUntilMs('90', 1_000), 91_000)
  assert.equal(retryUntilMs(null, 1_000), null)
  assert.equal(retryUntilMs('0', 1_000), null)
})

test('再開前は待ち案内、過ぎたら出さない', () => {
  assert.match(retryWaitMessage(1_000 + 90_000, 1_000) ?? '', /約2分/)
  assert.equal(retryWaitMessage(1_000, 1_000), null)
})
