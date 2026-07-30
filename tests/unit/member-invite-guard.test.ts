import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInvitableUser } from '../../app/api/company/members/invite-guard.ts'

// ============================================================================
// 2026-07-30 監査（重大）: メール未確認のまま席招待が通る＝メール先取りによる席乗っ取り。
//   autoconfirm=True の下では誰でも任意アドレスでアカウントを作れる。そのアカウントへ
//   席が入ると、就業規則の原文と労務相談履歴を第三者に丸ごと渡すことになる。
//   ここでは「確認済みのアカウントにしか席を入れない」不変条件を固定する。
// ============================================================================

test('確認済みユーザーには席を入れてよい', () => {
  assert.equal(
    isInvitableUser({ id: 'u1', email: 'a@example.com', email_confirmed_at: '2026-07-30T00:00:00Z' }),
    true,
  )
})

test('メール未確認のアカウントには席を入れない（先取り登録の可能性）', () => {
  assert.equal(isInvitableUser({ id: 'u2', email: 'keiri@target.co.jp', email_confirmed_at: null }), false)
  assert.equal(isInvitableUser({ id: 'u3', email: 'keiri@target.co.jp' }), false)
  assert.equal(isInvitableUser({ id: 'u4', email: 'keiri@target.co.jp', email_confirmed_at: '' }), false)
})

test('ユーザーが解決できないとき（未登録）も false', () => {
  assert.equal(isInvitableUser(null), false)
  assert.equal(isInvitableUser(undefined), false)
})
