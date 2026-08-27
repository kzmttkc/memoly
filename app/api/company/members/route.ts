import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient, getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'
import {
  isInvitableUser,
  emailConfirmationProvesOwnership,
  MAILER_AUTOCONFIRM_IN_PRODUCTION,
} from './invite-guard'

// ============================================================================
// /api/company/members
//   GET  : 指定会社のメンバー一覧（?companyId=...）。RLS(company_members_member_select)で
//          同社メンバーのみ可視。anonクライアントで引く。
//   POST : 席招待（adminのみ）。{ companyId, email } で既存auth.usersをメール解決し
//          company_members(member) に追加。席数超過は trg_company_seat_limit が弾く。
//          → そのエラーを 409 で返し「席数上限」を明示する（トリガ実証点）。
//   最小実装: 招待レコード方式ではなく「既存ユーザーのメール解決」方式。
//   ★2026-08-12 訂正: 旧ガード「email_confirmed_at のあるアカウントだけ席を入れる」は
//     本番の mailer_autoconfirm=true（実測済み）の下では **1人も落とさない no-op** だった。
//     登録した瞬間に全アカウントが confirmed になるため、先取り登録した攻撃者も通る。
//     よって autoconfirm が有効な間は席招待そのものを fail-closed で断る。
//     本番実測（2026-08-12）で招待による席付与は一度も成立しておらず、止まる正規フローは無い。
//     背景・恒久解（招待トークン方式）・本番設定を false にするだけでは直らない理由は
//     ./invite-guard.ts のヘッダに全て記載。
//   ★メール存在オラクル緩和（CTO P2-1）: 「未登録404 / 既存は追加成功」の応答差で
//     任意メールの登録有無が判定できてしまうため、未登録・既存（既メンバー含む）の
//     いずれも同一文言の 200 で返す。既存ユーザーの即時追加という実機能は従来どおり
//     （応答からは追加されたか推測できないだけ）。DBマイグレーション無しの最小修正。
// ============================================================================

// 招待応答の統一文言（未登録/既存/既メンバーのどれでも同じ＝存在が推測できない）。
const INVITE_ACCEPTED_MESSAGE =
  '招待を受け付けました。相手が就業規則AIに登録済みの場合は即時追加され、未登録の場合は登録後に有効になります。'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  // 所属ガード（RLSでも弾かれるが、明示的に401/403を返す）
  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_members')
    .select('user_id, role, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  // 生の error.message を返さない（deadlines と同じく汎用文＝情報漏えい面を揃える）。
  if (error) {
    console.error('[company:members] list failed', error.message)
    return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ members: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId, email, role } = await req.json().catch(() => ({}))
  if (!companyId || !email) {
    return NextResponse.json({ error: 'companyId と email が必要です' }, { status: 400 })
  }

  // 招待者が admin か検証（RLSではなくアプリ層でも明示ガード）
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ席を招待できます' }, { status: 403 })
  }

  // ★席招待の fail-closed ゲート（2026-08-12）。
  //   autoconfirm が有効な間は email_confirmed_at がメール所有を証明しないため、
  //   「そのメールの持ち主に席を入れている」と言える根拠が無い。根拠が無いまま
  //   席を入れると就業規則の原文と労務相談履歴を第三者へ渡しうるので、入れない。
  //   ここは **メール解決より前** に置く: 判定が email に一切依存しないので、
  //   応答から対象メールの登録有無を推測できない（存在オラクルにならない）。
  //   admin 本人には黙って落とさず明示的に理由を返す（メール非依存の文言＝漏れない）。
  if (!emailConfirmationProvesOwnership(MAILER_AUTOCONFIRM_IN_PRODUCTION)) {
    console.warn('[company:invite] autoconfirm 有効のため席招待を停止中', {
      company_id: companyId,
      actor_user_id: user.id,
    })
    return NextResponse.json(
      {
        error:
          '席の招待は現在ご利用いただけません。安全な招待手順（ご本人宛の招待リンク）へ切り替え中です。お手数ですがサポートへご連絡ください。',
        code: 'INVITE_DISABLED',
      },
      { status: 503 }
    )
  }

  const inviteRole = role === 'admin' ? 'admin' : 'member'
  const admin = createAdminClient()

  // 既存auth.usersをメールで解決。Admin APIのlistUsersでフィルタ。
  // 未登録でもエラーにせず統一文言で返す（存在オラクル緩和。登録済みなら下で即追加）。
  const target = await findUserByEmail(admin, String(email).toLowerCase())
  if (!target) {
    return NextResponse.json({ ok: true, message: INVITE_ACCEPTED_MESSAGE })
  }

  // ★メール未確認アカウントには席を入れない（2026-07-30 監査・重大／暫定対処）。
  //   autoconfirm=True 下では誰でも任意アドレスでアカウントを先取りでき、そこへ席が
  //   入ると就業規則の原文と労務相談履歴を第三者に丸ごと渡すことになる。
  //   恒久解は招待トークン方式（招待メールを受信できた本人だけが席を得る）。
  //   詳細な攻撃シナリオと恒久解の設計は ./invite-guard.ts のヘッダに記載。
  //   応答は未登録・既メンバーと同一文言の 200（存在オラクルを作らない）。
  if (!isInvitableUser(target)) {
    console.warn('[company:invite] 未確認メールのため席を付与しませんでした', {
      company_id: companyId,
      target_user_id: target.id,
    })
    return NextResponse.json({ ok: true, message: INVITE_ACCEPTED_MESSAGE })
  }

  // 既に席がある場合も統一文言（「既にメンバーです」を返すと登録有無が漏れる）。
  const { data: existing } = await admin
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', target.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, message: INVITE_ACCEPTED_MESSAGE })
  }

  // 席追加。席数超過なら trg_company_seat_limit が EXCEPTION を投げる。
  const { error: insErr } = await admin
    .from('company_members')
    .insert({ company_id: companyId, user_id: target.id, role: inviteRole })

  if (insErr) {
    // トリガの席上限メッセージを 409 で表面化（実証点）
    if (/席数上限/.test(insErr.message)) {
      return NextResponse.json({ error: insErr.message, code: 'SEAT_LIMIT' }, { status: 409 })
    }
    console.error('[company:invite] insert failed', insErr)
    return NextResponse.json({ error: '招待の処理に失敗しました' }, { status: 500 })
  }

  // 監査ログ（重要操作: メンバー追加）。実際に席を追加できたときだけ記録する。
  //   応答文言は統一のまま（ログは admin のみ閲覧可＝存在オラクルには影響しない）。
  await logCompanyAudit({
    companyId,
    actorUserId: user.id,
    action: 'member.invite',
    targetType: 'company_member',
    targetId: target.id,
    metadata: { role: inviteRole },
  })

  // 追加成功も同一文言（userId 等の差分情報を返さない＝応答から存在を推測させない）。
  return NextResponse.json({ ok: true, message: INVITE_ACCEPTED_MESSAGE })
}

// Admin API でメールからユーザーを解決（ページング対応）。
//   走査上限は 5ページ×1000件（コスト増幅緩和: 1リクエストで Admin API を最大20回
//   叩ける状態を解消。5,000ユーザー超は招待レコード方式へ移行するときに再設計する）。
async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) return null
    const hit = data.users.find(u => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 1000) break
  }
  return null
}
