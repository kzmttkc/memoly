import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loadCompanyContext } from '@/lib/company'

// ============================================================================
// handover.ts — 「会社の記憶 引き継ぎビュー」のデータ集約（TOP5 #4・記憶moatの複利）
//
//   「人は代わる、番頭は覚えている」を体現する1画面。担当交代/承継時に、新担当が
//   この会社の労務判断履歴を1画面で把握できるようにする。集めるのは:
//     - 確定した自社ルール（company_profiles＝admin承認済みの rule）
//     - 過去の主要判断（memory_type='decision'・新しい順）
//     - 関係者ごとの状況（subject 別）
//     - 現行リスク要点（company_risk_scores の最新1件＝総合＋弱いカテゴリ上位）
//
//   設計（厳守）:
//     - LLM を呼ばない（既存の決定的データを束ねるだけ・追加コストゼロ）。
//     - 読取りは RLS 下の anon(=ユーザーJWT)＝自社のみ可視（loadCompanyContext と同経路）。
//     - 生氏名は新たに引き出さない（subject は保存済みラベル粒度をそのまま使う）。
//     - PDF・外部送信はしない（画面＋テキストコピーで十分・Phase1安全）。
// ============================================================================

/** 現行リスク要点（最新診断1件・無ければ null）。 */
export interface HandoverRisk {
  overall: number
  /** スコアが低い（=リスクが高い）順のカテゴリ上位（最大3件）。値があるものだけ。 */
  weakCategories: { name: string; score: number }[]
  diagnosedAt: string
}

export interface HandoverSummary {
  /** 確定した自社ルール（key/value・承認済み）。 */
  rules: { key: string; value: string }[]
  /** 過去の主要判断（新しい順）。 */
  decisions: { summary: string; topic: string | null; subject: string | null; decidedAt: string | null }[]
  /** 関係者ごとの状況（subject 別・ラベル粒度のまま）。 */
  people: { subject: string; notes: string[] }[]
  /** 現行リスク要点（最新1件）。 */
  risk: HandoverRisk | null
}

// DB列 → 表示カテゴリ名（risk-audit / risk-trend と一致）。
const CATEGORY_COLUMNS: { col: string; name: string }[] = [
  { col: 'cat_working_hours', name: '労働時間' },
  { col: 'cat_wages', name: '賃金' },
  { col: 'cat_leave', name: '休暇' },
  { col: 'cat_work_rules', name: '就業規則' },
  { col: 'cat_social_insurance', name: '社会保険' },
  { col: 'cat_childcare', name: '育児・介護' },
]

/**
 * 引き継ぎサマリーを集約する。
 *   profiles/decisions/people は loadCompanyContext を再利用（縦深取得を一本化）。
 *   risk は company_risk_scores の最新1件をベストエフォートで足す（無ければ null）。
 *
 * @param companyId 呼び出し側で所属検証済みの会社ID
 */
export async function loadHandoverSummary(companyId: string): Promise<HandoverSummary> {
  // 判断は引き継ぎ用に多めに見せたいので maxMemories を広げて取得（userQuery 無し=recency順）。
  const ctx = await loadCompanyContext(companyId, 30)

  let risk: HandoverRisk | null = null
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('company_risk_scores')
      .select(
        'overall, cat_working_hours, cat_wages, cat_leave, cat_work_rules, cat_social_insurance, cat_childcare, created_at',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const row = data as unknown as Record<string, number | string | null>
      const weak = CATEGORY_COLUMNS.map(({ col, name }) => ({
        name,
        score: row[col],
      }))
        .filter((c): c is { name: string; score: number } => typeof c.score === 'number')
        // スコアが低い＝リスクが高い順。上位3件を引き継ぎの注意点として出す。
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
      risk = {
        overall: typeof row.overall === 'number' ? row.overall : 0,
        weakCategories: weak,
        diagnosedAt: String(row.created_at ?? ''),
      }
    }
  } catch (e) {
    // リスク取得失敗は引き継ぎビュー全体を止めない（ルール/判断/人は出す）。
    console.error('[handover] risk load failed (skipping)', (e as Error).message)
  }

  return {
    rules: ctx.profiles,
    decisions: ctx.decisions.map(d => ({
      summary: d.summary,
      topic: d.topic,
      subject: d.subject,
      decidedAt: d.decidedAt,
    })),
    people: ctx.peopleSituations.map(p => ({ subject: p.subject, notes: p.notes })),
    risk,
  }
}
