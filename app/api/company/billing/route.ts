import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolvePlan, billingEnabled } from '@/lib/plans'

// ============================================================================
// /api/company/billing — 課金ページの現状を返す（GET）
// ----------------------------------------------------------------------------
//   GET ?companyId=... →
//     { plan, seatsPurchased, seatsUsed, status, role, billingEnabled }
//
//   - plan/seats/status は companies（RLS下のanonで自社のみ可視）。
//   - seatsUsed は company_members の件数（RLSで自社のみ）。
//   - role は呼び出し側UIが admin だけ「変更/購入」ボタンを出すために返す。
//   - billingEnabled は env フラグ。false なら UI は「無料モニター・予定価格」を出す。
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()

  const [{ data: company }, { count: seatsUsed }] = await Promise.all([
    supabase
      .from('companies')
      .select('plan, seats_purchased, status')
      .eq('id', companyId)
      .maybeSingle(),
    supabase
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
  ])

  const planDef = resolvePlan(company?.plan)

  return NextResponse.json({
    plan: planDef.id,
    planName: planDef.displayName,
    seatsPurchased: company?.seats_purchased ?? membership.seatsPurchased ?? 1,
    seatsUsed: seatsUsed ?? 0,
    status: company?.status ?? 'active',
    role: membership.role,
    billingEnabled: billingEnabled(),
  })
}
