import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'

// ============================================================================
// /api/company/home-status — ホーム画面の継続利用装置をまとめて支える集約GET。
//   1リクエストで以下を返す（外部評価 D10/D14/D16/D17+C13 の実数ソース）:
//     - risk      : 直近2回のリスク診断（D14 前回比差分・D17 チェックリスト「診断」）
//     - ruleDocs  : 取り込んだ規程の本数（D17 チェックリスト「規程アップ」）
//     - consult   : 相談の実績（総ユーザー発話数=チェックリスト「相談3回」/
//                   相談した日数・連続日数=D10 ストリーク）
//     - deadlines : 近づいている期限 上位5件（D16 通知の集約表示の最小形）
//
//   設計:
//     - すべて RLS 下の anon(=ユーザーJWT) で読む（自社のみ可視・service role 不使用）。
//     - 全項目ベストエフォート: テーブル未適用/クエリ失敗でも 200 で欠損値を返し、
//       ホームの描画を止めない（各UIは欠損時に該当カードを出さないだけ）。
//     - LLM 呼び出しなし・PII本文なし（件数・日付・期限タイトルのみ）。
// ============================================================================

/** 相談日の集計対象期間（日）。ストリーク/日数はこの窓内で決定的に計算する。 */
const CONSULT_WINDOW_DAYS = 60
/** 期限の先読み日数（これより先の期限は「通知」には出さない）。 */
const DEADLINE_HORIZON_DAYS = 60

/** ISO日時 → JST の YYYY-MM-DD（相談「日数」は日本時間の日付で数える）。 */
function jstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()
  const windowStartIso = new Date(
    Date.now() - CONSULT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [riskRes, ruleDocsRes, msgCountRes, msgDatesRes, deadlinesRes, memoriesRes] = await Promise.all([
    // D14: 直近2回の診断（overall と実施日だけ・カテゴリは出さない＝軽量）。
    supabase
      .from('company_risk_scores')
      .select('overall, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(2),
    // D17: 取り込んだ規程の本数（company_documents は「番頭に覚えさせた」規程原文）。
    supabase
      .from('company_documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    // D17: 相談3回 = ユーザー発話の総数（会話テーブル経由の inner join で自社に限定）。
    supabase
      .from('company_messages')
      .select('id, company_conversations!inner(company_id)', { count: 'exact', head: true })
      .eq('company_conversations.company_id', companyId)
      .eq('role', 'user'),
    // D10: 相談した日数/連続日数の素（直近60日のユーザー発話日時のみ・本文は読まない）。
    supabase
      .from('company_messages')
      .select('created_at, company_conversations!inner(company_id)')
      .eq('company_conversations.company_id', companyId)
      .eq('role', 'user')
      .gte('created_at', windowStartIso)
      .order('created_at', { ascending: false })
      .limit(1000),
    // D16(最小形): 近づいている有効な期限 上位5件。
    supabase
      .from('company_deadlines')
      .select('id, title, due_on')
      .eq('company_id', companyId)
      .eq('active', true)
      .gte('due_on', new Date().toISOString().slice(0, 10))
      .lte(
        'due_on',
        new Date(Date.now() + DEADLINE_HORIZON_DAYS * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .order('due_on', { ascending: true })
      .limit(5),
    // C10(活性化定義v2): 「記憶1件+相談1回」判定の分子となる自社の長期記憶の件数。
    //   memory/stats と同じ head:count（本文は読まない・軽量・PII非露出）。
    supabase
      .from('company_memories')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
  ])

  // --- risk（失敗時は空＝「未診断」扱い） ---
  const riskRows = riskRes.error ? [] : (riskRes.data ?? [])
  const latest = riskRows[0]
    ? { overall: Number(riskRows[0].overall), at: String(riskRows[0].created_at) }
    : null
  const previous = riskRows[1]
    ? { overall: Number(riskRows[1].overall), at: String(riskRows[1].created_at) }
    : null

  // --- consult（join 失敗時は 0＝チェックリストが「未達」に倒れるだけで壊れない） ---
  const userMessageCount = msgCountRes.error ? 0 : (msgCountRes.count ?? 0)
  const msgRows = msgDatesRes.error ? [] : (msgDatesRes.data ?? [])
  const daySet = new Set<string>()
  for (const r of msgRows) {
    const at = (r as { created_at?: string }).created_at
    if (at) daySet.add(jstDate(at))
  }
  // 連続日数（今日または昨日を起点に、途切れるまで遡る）。
  let streak = 0
  const today = jstDate(new Date().toISOString())
  const dayMs = 24 * 60 * 60 * 1000
  let cursor = daySet.has(today)
    ? Date.parse(`${today}T00:00:00Z`)
    : Date.parse(`${today}T00:00:00Z`) - dayMs
  while (daySet.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1
    cursor -= dayMs
  }

  return NextResponse.json({
    risk: { count: riskRows.length, latest, previous },
    ruleDocs: ruleDocsRes.error ? 0 : (ruleDocsRes.count ?? 0),
    // C10: company_memories の総件数（summary/decision/rule 合算）。失敗時は 0（安全側=未活性扱い）。
    memories: memoriesRes.error ? 0 : (memoriesRes.count ?? 0),
    consult: {
      userMessageCount,
      consultDays: daySet.size,
      streak,
    },
    deadlines: deadlinesRes.error
      ? []
      : (deadlinesRes.data ?? []).map(d => ({
          id: String(d.id),
          title: String(d.title),
          dueOn: String(d.due_on),
        })),
  })
}
