import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { SCOPE_FLAGS, verifyUnsubscribeToken, type UnsubscribeScope } from './token'

// ============================================================================
// /api/unsubscribe — 配信停止
// ----------------------------------------------------------------------------
//   2つの入口を持つ（2026-07-30 法務監査#4 の是正）:
//     A. ?token=... 付き（**認証不要**）
//        メールの List-Unsubscribe（RFC 8058 ワンクリック）と、メール本文の
//        「配信停止はこちら」からの導線。受信者はログインセッションを持たないのが
//        普通なので、ここを認証必須にすると配信停止が構造的に成立しない。
//        署名（HMAC）で本人の宛先だと確認できるため、認証の代わりになる。
//     B. token 無し（**従来どおり要ログイン**）
//        画面から自分で止める場合。挙動を変えないために残す。
//
//   トークンで出来ることは「自分宛の配信を止める」だけ。読み出しも他の変更もしない。
// ============================================================================

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * 指定ユーザーの user_metadata に配信停止フラグを立てる。
 * 既存の metadata（day2_sent_at 等）を落とさないよう、必ず読んでから重ねる。
 */
async function setUnsubscribed(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  scope: UnsubscribeScope,
): Promise<boolean> {
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  if (!authUser?.user) return false

  const flags: Record<string, boolean> = {}
  for (const key of SCOPE_FLAGS[scope]) flags[key] = true

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...(authUser.user.user_metadata ?? {}), ...flags },
  })
  if (error) {
    console.error(`[unsubscribe] update failed scope=${scope}: ${error.message}`)
    return false
  }
  return true
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  // --- A. 署名付きトークン（認証不要・ワンクリック配信停止） ---
  if (token) {
    const claim = verifyUnsubscribeToken(token)
    if (!claim) {
      return NextResponse.json({ error: 'invalid token' }, { status: 400 })
    }
    const ok = await setUnsubscribed(adminClient(), claim.userId, claim.scope)
    if (!ok) return NextResponse.json({ error: 'failed' }, { status: 500 })
    return NextResponse.json({ ok: true, scope: claim.scope })
  }

  // --- B. 画面からの停止（従来どおりログイン必須） ---
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 画面から止めた場合は「お知らせ系」を止める（従来の digest_unsubscribed 相当）。
  const ok = await setUnsubscribed(adminClient(), user.id, 'digest')
  if (!ok) return NextResponse.json({ error: 'failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
