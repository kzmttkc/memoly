import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/memory/stats — 記憶残高（沈没コスト可視化）の件数を返す（GET）
// ----------------------------------------------------------------------------
//   LTV施策(解約防止の主装置): ダッシュボードに「就業規則AIが自社について覚えていること：N件」
//   を常時表示するための実数ソース。company_memories（自社の長期記憶）と
//   company_profiles（承認済み自社ルール）に加え、オンボーディングで登録した
//   company_attributes（業種・規模・制度有無）の充足フィールド数も数える。
//
//   ★なぜ attributes を数えるか: オンボ5問の回答先は company_attributes であり、
//   ここを数えないと「登録直後にメーターが 0件＝まだ何も覚えていません」と表示され、
//   moat（会社を覚える）の可視化がアクティベーションの瞬間に自己否定する。
//
//   返却: { total, memories, decisions, rules, profiles, profileFacts, ruleDocs, subjects }
//     - memories     : memory_type='summary'（相談の記憶）
//     - decisions    : memory_type='decision'（過去の自社判断＝差別化の核）
//     - rules        : memory_type='rule'（承認待ち候補も含む抽出事実）
//     - profiles     : company_profiles（admin承認済みの自社ルール）
//     - profileFacts : company_attributes の非null充足フィールド数（業種/規模/制度3問・0〜5）
//     - ruleDocs     : company_documents（取り込んだ規程原文）の本数（P1-2 内訳表示用）
//     - subjects     : company_memories.subject（対象者ラベル）のユニーク人数（P1-2）
//     - total        : これらの合計（subjects は memories/decisions の属性なので二重に足さない）
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

  // P1-2(2026-07-23): 記憶残高の3内訳「規程n件・過去の判断n件・対象者n人」のための追加2本。
  //   - 規程: company_documents（F1 規程まるごと取込）の本数。head:count のみ＝本文は読まない。
  //     テーブル未適用（migration前）は count=null → 0 として扱い、既存表示を巻き添えにしない。
  //   - 対象者: company_memories.subject のユニーク数。subject はラベル粒度（例「Aさん(育休)」）
  //     で保存される前提の分類ラベル。ここでは件数化のためだけに読み、本文はレスポンスに返さない。
  const docsQuery = supabase
    .from('company_documents')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const subjectsQuery = supabase
    .from('company_memories')
    .select('subject')
    .eq('company_id', companyId)
    .not('subject', 'is', null)
    .limit(1000) // 対象者ラベルの現実的上限。超過時も件数が頭打ちになるだけで壊れない。

  const [sum, dec, rule, prof, attrs, week, docs, subj] = await Promise.all([
    countOf('company_memories', 'summary'),
    countOf('company_memories', 'decision'),
    countOf('company_memories', 'rule'),
    countOf('company_profiles'),
    attrsQuery,
    weekQuery,
    docsQuery,
    subjectsQuery,
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

  // 規程の本数（取得失敗/テーブル未適用は 0）。
  const ruleDocs = docs.count ?? 0

  // 対象者のユニーク人数。空文字・空白だけのラベルは数えない（決定的・LLM非依存）。
  const subjects = new Set(
    (subj.data ?? [])
      .map((r) => (typeof r.subject === 'string' ? r.subject.trim() : ''))
      .filter((s) => s.length > 0),
  ).size

  return NextResponse.json({
    // 規程も「就業規則AIが覚えていること」の実体なので total に含める（P1-2）。
    // subjects は memories/decisions の属性（同じ記憶の別の切り口）なので二重加算しない。
    total: memories + decisions + rules + profiles + profileFacts + ruleDocs,
    memories,
    decisions,
    rules,
    profiles,
    profileFacts,
    ruleDocs,
    subjects,
    // 直近7日で増えた記憶の件数（D09 成長の可視化）。取得失敗時は 0（表示側で非表示）。
    weekDelta: week.count ?? 0,
  })
}
