// 2026-08-05 敵対的再監査: token生成失敗時のフォールバック経路で scope 情報が失われ、
// deadline 通知の配信停止がサイレントに digest 固定へ落ちる欠陥を検知する。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUnsubscribeUrls, isValidScope } from '../../app/api/unsubscribe/token.ts'

test('署名鍵が無い環境でも、フォールバックURLに scope が載る（digest固定に戻らない）', () => {
  const originalSecret = process.env.UNSUBSCRIBE_SECRET
  const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.UNSUBSCRIBE_SECRET
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const urls = buildUnsubscribeUrls('https://banto-roumu.com', 'user-1', 'deadline')
    assert.equal(urls.oneClick, null, 'トークンが作れない環境ではワンクリックURLを名乗らない')
    assert.equal(
      urls.page,
      'https://banto-roumu.com/unsubscribe?scope=deadline',
      'フォールバックpageURLにscopeが載っていない。/api/unsubscribe(token無し)がdigest固定になる',
    )
  } finally {
    if (originalSecret !== undefined) process.env.UNSUBSCRIBE_SECRET = originalSecret
    if (originalService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalService
  }
})

test('isValidScope は digest/deadline のみ true（未知のscopeを不正に通さない）', () => {
  assert.equal(isValidScope('digest'), true)
  assert.equal(isValidScope('deadline'), true)
  assert.equal(isValidScope('unknown'), false)
  assert.equal(isValidScope(''), false)
})
