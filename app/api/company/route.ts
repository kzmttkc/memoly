import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser, listMyCompanies } from '@/lib/company'
import { canCreateAnotherCompany } from '@/lib/plans'

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

  // 収益ゲート（構造的・BILLING_ENABLED 非依存で常時有効）:
  //   「複数の会社（顧問先）を切り替え・各社記憶分離」は士業¥29,800の看板訴求。
  //   free/starter/standard は自社1社まで。2社目以降は multiClient(士業)会社の保有が必要。
  //   ★所属0社（=新規ユーザーの最初の1社）は canCreateAnotherCompany が常に true を返すため
  //     オンボは絶対に壊れない。既存の複数会社ユーザーの権限も剥奪しない（新規作成のみ制限）。
  const myCompanies = await listMyCompanies()
  if (!canCreateAnotherCompany(myCompanies.map(c => c.plan))) {
    return NextResponse.json(
      {
        error:
          '複数の会社（顧問先）を管理するには士業プランが必要です。現在のプランでは会社を1社まで作成できます。',
        code: 'company_limit',
      },
      { status: 403 },
    )
  }

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
