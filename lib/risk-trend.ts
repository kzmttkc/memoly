import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// risk-trend.ts — リスクスコア悪化検知（TOP5 #2・受け身診断 → 能動アラート）
//
//   company_risk_scores は「診断のたび1行 insert」で時系列が貯まる（本番稼働済・
//   supabase/collective_intelligence.sql）。本モジュールはその時系列の「直近2件」を
//   決定的に比較し、悪化（overall低下 or カテゴリ悪化）があれば能動アラートを返す。
//
//   設計（重要）:
//     - LLM を一切呼ばない。スコアは既に clamp(0-100) 済みの数値＝比較は決定的計算。
//       これを週次 digest のカード生成に同梱することで、追加コストゼロでフィードに乗る。
//     - 2件未満（比較不能）なら出さない。悪化が無ければ出さない（ノイズ抑制）。
//     - スコアは「高いほど良い」設計（risk-audit の score/level: 75+=おおむね良好）。
//       よって「悪化」= 値が下がること。閾値で小さなブレを無視する。
//
//   読取りは呼び出し側が渡す RLS 下 anon(=ユーザーJWT) クライアントで行う
//   （company_risk_scores_member_select＝自社のみ可視・テナント分離を尊重）。
// ============================================================================

/** 「高いほど良い」スコアで、悪化（=低下）と見なす最小ポイント差。小さなブレは無視する。 */
const OVERALL_WORSEN_THRESHOLD = 5
const CATEGORY_WORSEN_THRESHOLD = 8

/** DB列 → 表示カテゴリ名（risk-audit の CATEGORY_NAMES と一致）。 */
const CATEGORY_COLUMNS: { col: string; name: string }[] = [
  { col: 'cat_working_hours', name: '労働時間' },
  { col: 'cat_wages', name: '賃金' },
  { col: 'cat_leave', name: '休暇' },
  { col: 'cat_work_rules', name: '就業規則' },
  { col: 'cat_social_insurance', name: '社会保険' },
  { col: 'cat_childcare', name: '育児・介護' },
]

interface RiskScoreRow {
  overall: number
  cat_working_hours: number | null
  cat_wages: number | null
  cat_leave: number | null
  cat_work_rules: number | null
  cat_social_insurance: number | null
  cat_childcare: number | null
  created_at: string
}

/** 悪化した1項目（総合 or カテゴリ）。 */
export interface RiskDrop {
  /** '総合' またはカテゴリ名（労働時間 等）。 */
  label: string
  /** 前回スコア（高いほど良い）。 */
  previous: number
  /** 最新スコア。 */
  latest: number
  /** 低下幅（previous - latest・正の値）。 */
  drop: number
}

export interface RiskWorseningResult {
  /** 悪化項目（低下幅の大きい順）。空なら悪化なし＝アラート不要。 */
  drops: RiskDrop[]
  /** 最新診断日（ISO）。カード文面の時期提示に使う。 */
  latestAt: string
  /** 前回診断日（ISO）。 */
  previousAt: string
}

/** 数値以外は比較対象から外す（null=未診断カテゴリは「悪化」と誤判定しない）。 */
function num(v: number | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * 直近2件のリスクスコアを決定的に比較し、悪化項目を返す。
 *   - 行が2件未満なら null（比較不能＝アラート不要）。
 *   - 悪化が1件も無ければ drops:[] を返す（呼び出し側はカードを出さない）。
 *
 * @param supabase RLS下のanon(=ユーザーJWT)クライアント
 * @param companyId 呼び出し側で所属検証済みの会社ID
 */
export async function detectRiskWorsening(
  supabase: SupabaseClient,
  companyId: string,
): Promise<RiskWorseningResult | null> {
  const { data, error } = await supabase
    .from('company_risk_scores')
    .select(
      'overall, cat_working_hours, cat_wages, cat_leave, cat_work_rules, cat_social_insurance, cat_childcare, created_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(2)

  // テーブル未適用/RLS失敗でもフィードを止めない（ベストエフォート＝null扱い）。
  if (error || !data || data.length < 2) return null

  const [latest, previous] = data as unknown as RiskScoreRow[]
  const drops: RiskDrop[] = []

  // --- 総合スコアの悪化 ---
  const latestOverall = num(latest.overall)
  const prevOverall = num(previous.overall)
  if (latestOverall !== null && prevOverall !== null) {
    const drop = prevOverall - latestOverall
    if (drop >= OVERALL_WORSEN_THRESHOLD) {
      drops.push({ label: '総合', previous: prevOverall, latest: latestOverall, drop })
    }
  }

  // --- カテゴリ別の悪化（両回とも値があるものだけ比較） ---
  for (const { col, name } of CATEGORY_COLUMNS) {
    const l = num((latest as unknown as Record<string, number | null>)[col])
    const p = num((previous as unknown as Record<string, number | null>)[col])
    if (l === null || p === null) continue
    const drop = p - l
    if (drop >= CATEGORY_WORSEN_THRESHOLD) {
      drops.push({ label: name, previous: p, latest: l, drop })
    }
  }

  // 低下幅の大きい順（自分ごと度の高いものを上に）。
  drops.sort((a, b) => b.drop - a.drop)

  return {
    drops,
    latestAt: latest.created_at,
    previousAt: previous.created_at,
  }
}
