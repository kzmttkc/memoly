import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBillingReturnUrls } from '../../lib/checkout-url.ts'

// 2026-07-26 回帰防止: success_url/cancel_url に `?` が2つ入る不正クエリバグ
// （BANTO_BILLING_GATE事故・約1ヶ月本番で無自覚に稼働）を継続検知する。
test('returnUrlに既存クエリがある場合は&で連結し、?は1つのみ', () => {
  const { successUrl, cancelUrl } = buildBillingReturnUrls(
    'https://banto-roumu.com/company/billing?companyId=abc-123',
  )
  assert.equal(successUrl, 'https://banto-roumu.com/company/billing?companyId=abc-123&billing=success')
  assert.equal(cancelUrl, 'https://banto-roumu.com/company/billing?companyId=abc-123&billing=canceled')
  assert.equal((successUrl.match(/\?/g) ?? []).length, 1, 'successUrlの?は1つのみ')
  assert.equal((cancelUrl.match(/\?/g) ?? []).length, 1, 'cancelUrlの?は1つのみ')
})

test('returnUrlにクエリが無い場合は?で連結する', () => {
  const { successUrl, cancelUrl } = buildBillingReturnUrls('https://banto-roumu.com/company/billing')
  assert.equal(successUrl, 'https://banto-roumu.com/company/billing?billing=success')
  assert.equal(cancelUrl, 'https://banto-roumu.com/company/billing?billing=canceled')
})

test('回帰ガード: 素朴な無条件?連結ロジックだと壊れることの検算', () => {
  // このテストは buildBillingReturnUrls を使わず、修正前の実装(バグ)を再現し、
  // バグが実在したことと現行実装がそれを回避していることを対比で示す。
  const returnUrl = 'https://banto-roumu.com/company/billing?companyId=abc-123'
  const buggyUrl = `${returnUrl}?billing=success`
  assert.equal((buggyUrl.match(/\?/g) ?? []).length, 2, '修正前ロジックは?が2つになる(既知バグの再現)')
  const { successUrl } = buildBillingReturnUrls(returnUrl)
  assert.notEqual(successUrl, buggyUrl)
})
