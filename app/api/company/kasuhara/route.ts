import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser, getMembership, resolveDefaultCompany } from '@/lib/company'

// ============================================================================
// /api/company/kasuhara (POST) — 10措置診断の履歴（Kabau×番頭 1本化 Phase 2-5）
// ----------------------------------------------------------------------------
// やること:
//   1. ログイン確認 → company_id 確定（既存 insights / deadlines と同一の流儀）
//   2. **引き継ぎ（claim）**: /zure の匿名診断のうち、控えメールで預かったアドレスが
//      ログインユーザー本人のメール（Supabase Auth が確認済み）と一致し、まだどの会社にも
//      紐付いていない行を、この会社に紐付ける。V2 §4 の「匿名→登録の接続」。
//      メール所有は Auth の確認済みメールに依拠する＝他人の診断は拾えない。
//   3. この会社の診断履歴を新しい順で返す（判定のみ・規則本文はそもそも保存していない）。
// ============================================================================

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId } = body as { companyId?: string }

  let companyId: string
  if (bodyCompanyId) {
    const membership = await getMembership(bodyCompanyId)
    if (!membership) {
      return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
    }
    companyId = membership.companyId
  } else {
    const def = await resolveDefaultCompany()
    if (!def) return NextResponse.json({ error: '会社がまだありません' }, { status: 404 })
    companyId = def.companyId
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    return NextResponse.json({ error: '一時的に利用できません' }, { status: 500 })
  }
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  // 2. claim（ベストエフォート。失敗しても履歴表示は続ける）
  const email = (user.email ?? '').trim().toLowerCase()
  if (email) {
    try {
      await admin
        .from('kasuhara_assessments')
        .update({ company_id: companyId })
        .is('company_id', null)
        .eq('lead_email', email)
    } catch (e) {
      console.error('[company:kasuhara] claim失敗（続行）', { msg: (e as Error).message })
    }
  }

  // 3. 履歴
  const { data, error } = await admin
    .from('kasuhara_assessments')
    .select('id, measures, policy_generated_at, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[company:kasuhara] select失敗', { code: error.code, msg: error.message })
    return NextResponse.json({ error: '履歴を読み出せませんでした' }, { status: 500 })
  }

  return NextResponse.json({ assessments: data ?? [] })
}
