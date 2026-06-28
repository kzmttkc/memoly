import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient, getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/members
//   GET  : 指定会社のメンバー一覧（?companyId=...）。RLS(company_members_member_select)で
//          同社メンバーのみ可視。anonクライアントで引く。
//   POST : 席招待（adminのみ）。{ companyId, email } で既存auth.usersをメール解決し
//          company_members(member) に追加。席数超過は trg_company_seat_limit が弾く。
//          → そのエラーを 409 で返し「席数上限」を明示する（トリガ実証点）。
//   最小実装: 招待レコード方式ではなく「既存ユーザーのメール解決」方式。
//             未登録メールは 404（招待メール送信はP1スコープ外）。
// ============================================================================

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  const inviteRole = role === 'admin' ? 'admin' : 'member'
  const admin = createAdminClient()

  // 既存auth.usersをメールで解決。Admin APIのlistUsersでフィルタ。
  const target = await findUserByEmail(admin, String(email).toLowerCase())
  if (!target) {
    return NextResponse.json(
      { error: 'そのメールのユーザーは未登録です（先にサインアップが必要）' },
      { status: 404 }
    )
  }

  // 既に席があるか
  const { data: existing } = await admin
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('user_id', target.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '既にメンバーです' }, { status: 409 })
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
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: target.id, role: inviteRole })
}

// Admin API でメールからユーザーを解決（ページング対応・最大数ページ走査）
async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) return null
    const hit = data.users.find(u => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 1000) break
  }
  return null
}
