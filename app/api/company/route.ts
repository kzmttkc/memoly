import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser, listMyCompanies } from '@/lib/company'

// ============================================================================
// /api/company
//   GET  : 自分の所属会社一覧（RLS下のanon経由・listMyCompanies）
//   POST : 会社作成（作成者を自動でadmin席に）
//          companies INSERT → company_members(admin) INSERT を service role で行う。
//          作成直後はまだメンバーでないためRLSのadmin_writeを通せず、service roleが必要。
//          席トリガ(trg_company_seat_limit)は service role でも発火するため尊重される。
// ============================================================================

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companies = await listMyCompanies()
  return NextResponse.json({ companies })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, seats } = await req.json().catch(() => ({}))
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })
  }
  const seatsPurchased =
    Number.isInteger(seats) && seats >= 1 ? seats : 1

  const admin = createAdminClient()

  // 1. companies INSERT
  const { data: company, error: companyErr } = await admin
    .from('companies')
    .insert({ name: name.trim(), seats_purchased: seatsPurchased })
    .select('id, name, plan, seats_purchased')
    .single()

  if (companyErr || !company) {
    console.error('[company:create] companies insert failed', companyErr)
    return NextResponse.json({ error: '会社の作成に失敗しました' }, { status: 500 })
  }

  // 2. 作成者を admin 席に追加（席トリガはここで used(0) < cap(>=1) を通す）
  const { error: memberErr } = await admin
    .from('company_members')
    .insert({ company_id: company.id, user_id: user.id, role: 'admin' })

  if (memberErr) {
    // 席追加に失敗したら作った会社をロールバック（孤児テナント防止）
    await admin.from('companies').delete().eq('id', company.id)
    console.error('[company:create] member insert failed', memberErr)
    return NextResponse.json({ error: '管理者席の作成に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    company: {
      companyId: company.id,
      role: 'admin',
      name: company.name,
      plan: company.plan,
      seatsPurchased: company.seats_purchased,
    },
  })
}
