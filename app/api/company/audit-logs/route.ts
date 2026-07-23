import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/audit-logs — 監査ログの閲覧（F09・2026-07-23）
// ----------------------------------------------------------------------------
//   company_audit_logs（追記専用・改竄不可）を admin が設定画面から確認できるようにする。
//   「誰がいつ何をしたか」を利用者自身が見られる＝BtoB労務データの取り扱い信頼の実装。
//
//   設計:
//     - GET ?companyId=...&limit=50（読取り専用・冪等）。
//     - admin のみ（アプリ層ガード）。加えて RLS の company_audit_logs_admin_select が
//       DB 層でも admin 限定を強制する（二層防御）。
//     - anon(=ユーザーJWT) クライアントで読む＝RLS が実効。
//     - migration 未適用（テーブル無し）の環境では空配列を返す（画面を壊さない）。
// ============================================================================

const MAX_LIMIT = 200

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) {
    return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
  }
  if (membership.role !== 'admin') {
    return NextResponse.json({ error: '監査ログは管理者のみ閲覧できます' }, { status: 403 })
  }

  const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), MAX_LIMIT) : 50

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_audit_logs')
    .select('action, target_type, target_id, metadata, actor_user_id, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // テーブル未適用（migration前）は想定内: 空で返し画面は壊さない。
    console.error('[company:audit-logs] select failed (non-fatal)', error.message)
    return NextResponse.json({ logs: [] })
  }
  return NextResponse.json({ logs: data ?? [] })
}
