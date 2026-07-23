import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/memory/stats — 記憶残高（沈没コスト可視化）の件数を返す（GET）
// ----------------------------------------------------------------------------
//   LTV施策(解約防止の主装置): ダッシュボードに「番頭が自社について覚えていること：N件」
//   を常時表示するための実数ソース。company_memories（自社の長期記憶）と
//   company_profiles（承認済み自社ルール）に加え、オンボーディングで登録した
//   company_attributes（業種・規模・制度有無）の充足フィールド数も数える。
//
//   ★なぜ attributes を数えるか: オンボ5問の回答先は company_attributes であり、
//   ここを数えないと「登録直後にメーターが 0件＝まだ何も覚えていません」と表示され、
//   moat（会社を覚える）の可視化がアクティベーションの瞬間に自己否定する。
//
//   返却: { total, memories, decisions, rules, profiles, profileFacts }
//     - memories     : memory_type='summary'（相談の記憶）
//     - decisions    : memory_type='decision'（過去の自社判断＝差別化の核）
//     - rules        : memory_type='rule'（承認待ち候補も含む抽出事実）
//     - profiles     : company_profiles（admin承認済みの自社ルール）
//     - profileFacts : company_attributes の非null充足フィールド数（業種/規模/制度3問・0〜5）
//     - total        : これらの合計＝「自社について覚えていること」の総量
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

  // company_attributes は会社につき1行。head:count では「非nullフィールド数」が出せないため
  // 該当行を1本だけ読み、充足フィールド（業種/規模/制度3問）を決定的に数える（PIIではない属性）。
  const attrsQuery = supabase
    .from('company_attributes')
    .select('industry_major,employee_band,has_36kyotei,has_work_rules,has_fixed_ot')
    .eq('company_id', companyId)
    .maybeSingle()

  // D09(2026-07-23): 「先週比 +N」の実数。直近7日に作られた company_memories の件数
  //   （created_at を持つ唯一の記憶テーブル。profiles は updated_at のみ＝増分と更新を
  //   区別できないため数えない＝過大表示しない）。
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weekQuery = supabase
    .from('company_memories')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', weekAgoIso)

  const [sum, dec, rule, prof, attrs, week] = await Promise.all([
    countOf('company_memories', 'summary'),
    countOf('company_memories', 'decision'),
    countOf('company_memories', 'rule'),
    countOf('company_profiles'),
    attrsQuery,
    weekQuery,
  ])

  const memories = sum.count ?? 0
  const decisions = dec.count ?? 0
  const rules = rule.count ?? 0
  const profiles = prof.count ?? 0

  // 三値bool(null=未回答)も含め、非nullの登録済みフィールドだけを「覚えている事実」として数える。
  const a = attrs.data
  const profileFacts = a
    ? (['industry_major', 'employee_band', 'has_36kyotei', 'has_work_rules', 'has_fixed_ot'] as const)
        .filter((k) => a[k] !== null && a[k] !== undefined).length
    : 0

  return NextResponse.json({
    total: memories + decisions + rules + profiles + profileFacts,
    memories,
    decisions,
    rules,
    profiles,
    profileFacts,
    // 直近7日で増えた記憶の件数（D09 成長の可視化）。取得失敗時は 0（表示側で非表示）。
    weekDelta: week.count ?? 0,
  })
}
