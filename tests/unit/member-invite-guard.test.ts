import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isInvitableUser,
  emailConfirmationProvesOwnership,
  MAILER_AUTOCONFIRM_IN_PRODUCTION,
} from '../../app/api/company/members/invite-guard.ts'

// ============================================================================
// 2026-07-30 監査（重大）: メール未確認のまま席招待が通る＝メール先取りによる席乗っ取り。
// 2026-08-12 訂正: その対処（email_confirmed_at 判定）は本番の mailer_autoconfirm=true
//   の下では攻撃者を1人も落とさない no-op だった。登録した瞬間に全アカウントが
//   confirmed になるため。ここでは訂正後の不変条件を固定する:
//     autoconfirm=true  → 誰にも席を入れない（fail-closed）
//     autoconfirm=false → 確認済みにだけ席を入れる（将来トークン方式へ移行するまでの条件）
// ============================================================================

const CONFIRMED = { id: 'u1', email: 'a@example.com', email_confirmed_at: '2026-07-30T00:00:00Z' }

test('autoconfirm=true では確認済みでも席を入れない（フラグが所有を証明しないため）', () => {
  assert.equal(isInvitableUser(CONFIRMED, true), false)
  assert.equal(
    isInvitableUser({ id: 'u2', email: 'keiri@target.co.jp', email_confirmed_at: '2026-08-12T00:00:00Z' }, true),
    false,
  )
})

test('autoconfirm=false なら確認済みユーザーには席を入れてよい', () => {
  assert.equal(isInvitableUser(CONFIRMED, false), true)
})

test('autoconfirm=false でもメール未確認のアカウントには席を入れない', () => {
  assert.equal(isInvitableUser({ id: 'u2', email: 'keiri@target.co.jp', email_confirmed_at: null }, false), false)
  assert.equal(isInvitableUser({ id: 'u3', email: 'keiri@target.co.jp' }, false), false)
  assert.equal(isInvitableUser({ id: 'u4', email: 'keiri@target.co.jp', email_confirmed_at: '' }, false), false)
})

test('ユーザーが解決できないとき（未登録）はどちらの設定でも false', () => {
  assert.equal(isInvitableUser(null, false), false)
  assert.equal(isInvitableUser(undefined, false), false)
  assert.equal(isInvitableUser(null, true), false)
})

test('既定引数は本番実測値を使う＝本番と同じ判定になる', () => {
  assert.equal(MAILER_AUTOCONFIRM_IN_PRODUCTION, true)
  assert.equal(isInvitableUser(CONFIRMED), isInvitableUser(CONFIRMED, MAILER_AUTOCONFIRM_IN_PRODUCTION))
  // 本番実測が true である限り、既定の呼び出しは fail-closed。
  assert.equal(isInvitableUser(CONFIRMED), false)
})

test('email_confirmed_at を信用してよいのは autoconfirm が無効なときだけ', () => {
  assert.equal(emailConfirmationProvesOwnership(false), true)
  assert.equal(emailConfirmationProvesOwnership(true), false)
})
