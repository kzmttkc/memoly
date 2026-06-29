import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/memory/stats — 記憶残高（沈没コスト可視化）の件数を返す（GET）
// ----------------------------------------------------------------------------
//   LTV施策(解約防止の主装置): ダッシュボードに「番頭が御社について覚えていること：N件」
//   を常時表示するための実数ソース。company_memories（自社の長期記憶）と
//   company_profiles（承認済み自社ルール）の実件数を数える。
//
//   返却: { total, memories, decisions, rules, profiles }
//     - memories  : memory_type='summary'（相談の記憶）
//     - decisions : memory_type='decision'（過去の自社判断＝差別化の核）
//     - rules     : memory_type='rule'（承認待ち候補も含む抽出事実）
//     - profiles  : company_profiles（admin承認済みの自社ルール）
//     - total     : これらの合計＝「御社について覚えていること」の総量
//
//   可視性は RLS 下の anon(=ユーザーJWT) で担保（自社のみ可視）。head:true の
//   count クエリで件数だけを軽量に取得し、本文（PII）は一切返さない。
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()

  // 件数のみを head クエリで並列取得（本文は読まない＝軽量・PII非露出）。
  const countOf = (
    table: 'company_memories' | 'company_profiles',
    memoryType?: 'summary' | 'decision' | 'rule',
  ) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('company_id', companyId)
    if (memoryType) q = q.eq('memory_type', memoryType)
    return q
  }

  const [sum, dec, rule, prof] = await Promise.all([
    countOf('company_memories', 'summary'),
    countOf('company_memories', 'decision'),
    countOf('company_memories', 'rule'),
    countOf('company_profiles'),
  ])

  const memories = sum.count ?? 0
  const decisions = dec.count ?? 0
  const rules = rule.count ?? 0
  const profiles = prof.count ?? 0

  return NextResponse.json({
    total: memories + decisions + rules + profiles,
    memories,
    decisions,
    rules,
    profiles,
  })
}
