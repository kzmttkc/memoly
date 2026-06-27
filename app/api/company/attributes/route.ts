import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { sanitizeAttributes, type CompanyAttributesRow } from '@/lib/company-attributes'

// ============================================================================
// /api/company/attributes — 集合知モート用「正規化属性」の取得/更新
//   集計専用テーブル company_attributes（supabase/collective_intelligence.sql）に対する
//   会社1行（PK=company_id）の upsert。構造化ウィザード（ドロップダウン/トグル）の保存先。
//   ★ 値は LLM 非依存・決定的。sanitizeAttributes で DB の CHECK と一致する値に丸める。
//
//   読取り(GET): メンバー全員（RLS company_attributes_member_select）
//   書込み(POST): admin のみ（RLS company_attributes_admin_write + アプリ層 requireAdmin ガード）
//
//   全操作 anon(=ユーザーJWT) クライアントで実行し、RLS を最終防衛線とする
//   （profile route と同一の流儀）。
// ============================================================================

// GET ?companyId=... — 自社の正規化属性（メンバー可）。未登録なら attributes: null。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_attributes')
    .select(
      'industry_major, employee_band, has_36kyotei, has_work_rules, has_fixed_ot, benchmark_optout, updated_at',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  // テーブル未適用環境でも UI を壊さない: select 失敗時は null を返す（ウィザード初回扱い）。
  if (error) {
    console.error('[company:attributes] select failed', error.message)
    return NextResponse.json({ attributes: null })
  }
  return NextResponse.json({ attributes: data ?? null })
}

// POST { companyId, ...attributes } — upsert（作成/更新）。adminのみ。
//   body は { industry_major, employee_band, has_36kyotei, has_work_rules, has_fixed_ot,
//            benchmark_optout } を受ける。未指定/不正値は null（または false）へ正規化。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId } = body as { companyId?: unknown }

  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const attrs: CompanyAttributesRow = sanitizeAttributes(body)
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_attributes')
    .upsert(
      {
        company_id: companyId as string,
        ...attrs,
        source: 'wizard',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    )
    .select(
      'industry_major, employee_band, has_36kyotei, has_work_rules, has_fixed_ot, benchmark_optout, updated_at',
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attributes: data })
}

// 共通: ログイン + admin 所属を要求（profile route と同じ流儀）。
async function requireAdmin(companyId: unknown): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ編集できます' }, { status: 403 })
  }
  return null
}
