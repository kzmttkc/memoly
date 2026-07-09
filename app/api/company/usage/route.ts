import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { resolvePlan, limitFor } from '@/lib/plans'
import { type ApiKind } from '@/lib/rate-limit'

// ============================================================================
// /api/company/usage — 本日の利用状況（残回数の事前表示用・P2）
//
//   目的: チャット等の高コストAPIは plan 連動の日次上限がある（lib/rate-limit.ts）。
//     上限に達して 429 になって初めて気づく UX を避けるため、UI が事前に「本日の残り回数」を
//     出せるよう、当日の使用回数と上限を返す読み取り専用エンドポイント。
//
//   GET ?companyId=...&kind=chat|document_generate|document_review|insights|risk_audit
//     - kind 既定は chat。
//     - used: memoly_api_usage の当日カウント（RLS own_select＝本人のみ・anon+JWTで読む）。
//     - limit: 会社 plan 連動の上限。remaining = max(0, limit - used)。
//   ★ベストエフォート: テーブル未適用・取得失敗時は used=0 として remaining=limit を返す
//     （表示を止めない。上限そのものは rate-limit 側が別途強制する）。
// ============================================================================

const VALID_KINDS: ApiKind[] = ['chat', 'document_generate', 'document_review', 'insights', 'risk_audit']

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const kindParam = req.nextUrl.searchParams.get('kind') ?? 'chat'
  const kind = (VALID_KINDS.includes(kindParam as ApiKind) ? kindParam : 'chat') as ApiKind

  const plan = resolvePlan(membership.plan).id
  const limit = limitFor(plan, kind)

  let used = 0
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('memoly_api_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('day', utcDay())
      .eq('kind', kind)
      .maybeSingle()
    if (data && typeof data.count === 'number') used = data.count
  } catch {
    // ベストエフォート: 取得失敗は used=0（remaining=limit）で返す。
  }

  const remaining = Math.max(0, limit - used)
  return NextResponse.json({ kind, plan, used, limit, remaining })
}
