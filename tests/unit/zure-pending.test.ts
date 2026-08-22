import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  documentTextFromPending,
  parsePendingRaw,
  readPendingFromStores,
  writePendingToStores,
  clearPendingFromStores,
  PENDING_ZURE_KEY,
  pendingRemainingHours,
} from '../../lib/zure-pending.ts'

test('本文が空でも未読の理由を書類として残せる', () => {
  const text = documentTextFromPending({
    filename: 'scan.pdf',
    text: '  ',
    unreadNote: '画像の2ページは本文が取れませんでした。',
  })
  assert.match(text, /【未読】/)
  assert.match(text, /画像の2ページ/)
})

test('本文があれば本文を残す', () => {
  const text = documentTextFromPending({
    filename: '就業規則.txt',
    text: '第1条 この規則は従業員に適用する。',
    unreadNote: null,
  })
  assert.equal(text, '第1条 この規則は従業員に適用する。')
})

test('session が空でも local の控えを読む', () => {
  const local = new Map<string, string>()
  writePendingToStores(
    [{ setItem: (k, v) => local.set(k, v) }],
    { filename: 'a.txt', text: '第1条', unreadNote: null },
  )
  const pending = readPendingFromStores([
    { getItem: () => null },
    { getItem: k => local.get(k) ?? null },
  ])
  assert.equal(pending?.filename, 'a.txt')
  assert.equal(local.get(PENDING_ZURE_KEY)?.includes('第1条'), true)
})

test('控えは両方のストアから消せる', () => {
  const store = new Map<string, string>()
  const s = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => {
      store.delete(k)
    },
  }
  writePendingToStores([s], { filename: 'a.txt', text: '第1条', unreadNote: null })
  assert.equal(store.has(PENDING_ZURE_KEY), true)
  clearPendingFromStores([s])
  assert.equal(store.has(PENDING_ZURE_KEY), false)
})

test('24時間を過ぎた控えは使わない', () => {
  const now = 1_000_000
  const raw = JSON.stringify({
    filename: 'old.txt',
    text: '第1条',
    unreadNote: null,
    savedAt: now - 25 * 60 * 60 * 1000,
  })
  assert.equal(parsePendingRaw(raw, now), null)
  const fresh = JSON.stringify({
    filename: 'new.txt',
    text: '第1条',
    unreadNote: null,
    savedAt: now - 60 * 60 * 1000,
  })
  assert.equal(parsePendingRaw(fresh, now)?.filename, 'new.txt')
})

test('控えの残り時間は切り上げの時間で返す', () => {
  const now = 10_000_000
  assert.equal(pendingRemainingHours({ savedAt: now - 60 * 60 * 1000 }, now), 23)
  assert.equal(pendingRemainingHours({ savedAt: now - 23.2 * 60 * 60 * 1000 }, now), 1)
  assert.equal(pendingRemainingHours({ savedAt: now - 25 * 60 * 60 * 1000 }, now), null)
  assert.equal(pendingRemainingHours({}, now), null)
})
