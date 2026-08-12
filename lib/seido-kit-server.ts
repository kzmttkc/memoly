import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { SEIDO_KIT_ENTITLEMENT_KEY, SEIDO_KIT_PRODUCT_TAG } from '@/lib/seido-kit'

// ============================================================================
// lib/seido-kit-server.ts — キット購入権の付与・確認（サーバー専用）
//
// 設計（2026-08-13・AQ-023）:
//   購入権は auth.users の app_metadata（SEIDO_KIT_ENTITLEMENT_KEY: true）に置く。
//   - なぜ app_metadata か: 新テーブル・マイグレーション不要（このリポの migration は
//     手動SQL適用の運用のため、Takeshi手番を作らない）。app_metadata はユーザー本人が
//     書き換えられない（user_metadata と違い service role のみ書ける）ので
//     購入フラグの置き場として安全。getUser() はauthサーバーから最新値を取るため
//     付与直後から反映される。
//   - 付与経路は2本: ①決済完了リダイレクト（/seido/kit/uketori・session_id 検証）
//     ②復元API（/api/seido/kit/restore・PaymentIntent metadata 検索）。
//     webhook には足さない（既存サブスク webhook のクロス配信ガードが
//     metadata.product==='banto' 限定で本商品を無視するため、干渉ゼロで済む）。
// ============================================================================

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** 購入済みか（cookie セッションの user オブジェクトから判定） */
export function hasSeidoKit(user: Pick<User, 'app_metadata'> | null): boolean {
  return user?.app_metadata?.[SEIDO_KIT_ENTITLEMENT_KEY] === true
}

/**
 * 購入権を付与する（冪等）。app_metadata は上書きでなく既存キーとマージする
 * （updateUserById は渡したオブジェクトで置き換えるため、先に読み出して spread する）。
 */
export async function grantSeidoKit(userId: string): Promise<void> {
  const admin = adminClient()
  const { data, error: getErr } = await admin.auth.admin.getUserById(userId)
  if (getErr || !data?.user) throw new Error(`GRANT_GET_USER_FAILED: ${getErr?.message}`)
  const existing = data.user.app_metadata ?? {}
  if (existing[SEIDO_KIT_ENTITLEMENT_KEY] === true) return
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...existing, [SEIDO_KIT_ENTITLEMENT_KEY]: true },
  })
  if (error) throw new Error(`GRANT_UPDATE_FAILED: ${error.message}`)
}

/**
 * Stripe Checkout Session がこのキットの正当な支払いかを検証する。
 * 3条件: paid ／ metadata.product が本商品タグ ／ client_reference_id が本人。
 */
export function isValidKitSession(
  session: {
    payment_status?: string | null
    metadata?: Record<string, string> | null
    client_reference_id?: string | null
  },
  userId: string,
): boolean {
  return (
    session.payment_status === 'paid' &&
    session.metadata?.product === SEIDO_KIT_PRODUCT_TAG &&
    session.client_reference_id === userId
  )
}
