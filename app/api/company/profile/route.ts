import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/profile — 自社プロファイル(company_profiles)のCRUD
//   会社の「記憶」＝自社の労務ルール/制度を key/value で保持。
//   読取り: メンバー全員（RLS company_profiles_member_select）
//   書込み: admin のみ（RLS company_profiles_admin_write + アプリ層ガード）
//
//   全操作 anon(=ユーザーJWT) クライアントで実行し、RLS を最終防衛線とする。
//   adminガードはアプリ層でも明示し、403 を早期に返す（UX）。
// ============================================================================

// GET ?companyId=... — 自社プロファイル一覧（メンバー可）
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_profiles')
    .select('id, key, value, updated_at')
    .eq('company_id', companyId)
    .order('key', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}

// POST { companyId, key, value } — 作成/更新(upsert)。adminのみ。
export async function POST(req: NextRequest) {
  const { companyId, key, value } = await req.json().catch(() => ({}))
  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!key || typeof value !== 'string') {
    return NextResponse.json({ error: 'key と value が必要です' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_profiles')
    .upsert(
      { company_id: companyId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,key' }
    )
    .select('id, key, value, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

// PATCH { companyId, id, value } — 既存値の更新。adminのみ。
export async function PATCH(req: NextRequest) {
  const { companyId, id, value } = await req.json().catch(() => ({}))
  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id || typeof value !== 'string') {
    return NextResponse.json({ error: 'id と value が必要です' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('company_profiles')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE { companyId, id } — 削除。adminのみ。
export async function DELETE(req: NextRequest) {
  const { companyId, id } = await req.json().catch(() => ({}))
  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('company_profiles')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 共通: ログイン + admin 所属を要求。満たさなければ NextResponse を返す（=ガード失敗）。
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
