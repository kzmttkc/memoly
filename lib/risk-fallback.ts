// ============================================================================
// risk-fallback.ts — LLM 非依存の決定的リスクスコア（Anthropic 呼び出し失敗時の砦）
// ----------------------------------------------------------------------------
//   /api/company/risk-audit は通常 sonnet でスコアリングするが、モデル呼び出しが
//   落ちると 502「時間をおいて」のデッドエンドになり、最初の1人が初回診断で何も
//   受け取れない（＝TTV ゼロ・信用毀損）。
//
//   本モジュールは会社のオンボーディング5問（company_attributes: 業種/規模/
//   36協定/就業規則/固定残業）＋自由記述プロファイル＋任意設問を起点に、
//   ルールベースで「総合スコア＋カテゴリ別スコア＋TOP3指摘」を決定的に生成する。
//   LLM を一切呼ばないので、Anthropic が落ちていても必ず結果が返る。
//
//   設計方針（既存 risk-audit / prompts.ts と整合）:
//     - スコアは「高いほど健全（リスクが低い）」。100 が最も健全。
//     - 情報不足（三値 null / 未回答）は「減点」でなく「要確認」＝中庸(60前後)に
//       とどめ、不当に低い点でネガティブ体験を作らない（prompts.ts と同じ規律）。
//     - 6カテゴリ（労働時間/賃金/休暇/就業規則/社会保険/育児・介護）を必ず全件返す。
//     - Phase1コンプラ厳守: 「社労士監修」「AI社労士」「法的精度」は使わない。
//       断定的な個別法律判断はしない＝条件形（〜のおそれ／〜を確認）で書く。
//     - 全文敬体（です・ます）。禁止語（——/皆さん/絶対/強調記号）不使用。
// ============================================================================

import type { CompanyProfileKV } from './prompts'
import type { EmployeeBand } from './company-attributes'

// 判定に使う正規化属性（company_attributes の該当列。null=未回答=要確認）。
export interface RiskFallbackAttributes {
  industry_major: string | null
  employee_band: EmployeeBand | string | null
  has_36kyotei: boolean | null
  has_work_rules: boolean | null
  has_fixed_ot: boolean | null
}

export interface FallbackCategory {
  name: string
  score: number
  note: string
}

export interface FallbackTopRisk {
  title: string
  severity: 'high' | 'medium' | 'low'
  why: string
  fix: string
}

export interface FallbackRiskResult {
  score: number
  level: string
  categories: FallbackCategory[]
  topRisks: FallbackTopRisk[]
  summary: string
}

// 6カテゴリの骨格（risk-audit の CATEGORY_NAMES と一致させる。順序も保つ）。
const CAT = {
  hours: '労働時間',
  wages: '賃金',
  leave: '休暇',
  rules: '就業規則',
  insurance: '社会保険',
  childcare: '育児・介護',
} as const

// 情報不足カテゴリの既定スコア（減点でなく「中庸＝要確認」）。
const NEUTRAL = 60
const NEUTRAL_NOTE = '情報不足のため要確認です。基本情報を登録すると精度が上がります。'

/** 従業員規模バンドから「常時10人以上か」を判定する。判定不能なら null。 */
function isTenOrMore(band: string | null | undefined): boolean | null {
  if (!band) return null
  // '1-4' '5-9' は10人未満、それ以外（'10-29' 以上）は10人以上。
  if (band === '1-4' || band === '5-9') return false
  if (band === '10-29' || band === '30-49' || band === '50-99' || band === '100+') return true
  return null
}

/** 0〜100 の整数に丸める。 */
function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** level を score から導出（risk-audit の normalizeLevel と同じ帯）。 */
function levelFromScore(score: number): string {
  if (score >= 75) return 'おおむね良好'
  if (score >= 50) return '改善の余地あり'
  return '要注意'
}

/**
 * オンボーディング5問（＋補助情報）からルールベースでリスクを採点する。
 * LLM を呼ばず、必ず結果を返す（Anthropic 障害時の決定的フォールバック）。
 *
 * @param attributes company_attributes の該当列（未取得なら全 null を渡してよい）
 * @param profiles   自由記述の自社ルール（件数を「登録の充実度」の弱いシグナルに使う）
 * @param answers    任意の簡易設問回答（現状は情報量の補助のみ）
 */
export function computeFallbackRiskAudit(
  attributes: RiskFallbackAttributes,
  profiles: CompanyProfileKV[] = [],
  answers: { key: string; value: string }[] = [],
): FallbackRiskResult {
  const tenOrMore = isTenOrMore(attributes.employee_band)
  const has36 = attributes.has_36kyotei
  const hasRules = attributes.has_work_rules
  const hasFixedOt = attributes.has_fixed_ot

  const topRisks: FallbackTopRisk[] = []

  // --- カテゴリ: 労働時間（36協定の有無が主軸） ---
  let hoursScore = NEUTRAL
  let hoursNote = NEUTRAL_NOTE
  if (has36 === false) {
    hoursScore = 30
    hoursNote =
      '36協定が未締結の状態です。残業や休日出勤をさせる場合はリスクが高いと考えられます。'
    topRisks.push({
      title: '36協定が未締結の可能性',
      severity: 'high',
      why: '36協定を締結・届出しないまま時間外労働や休日労働をさせている場合、法令に抵触するおそれがあります。',
      fix: '残業や休日出勤の実態がある場合は、36協定の締結・届出を早めに検討するとよいでしょう。',
    })
  } else if (has36 === true) {
    hoursScore = 82
    hoursNote = '36協定は締結済みです。上限規制の範囲内で運用できているか、あわせて確認するとよいでしょう。'
  }

  // --- カテゴリ: 就業規則（規模との組み合わせで重み付け） ---
  let rulesScore = NEUTRAL
  let rulesNote = NEUTRAL_NOTE
  if (hasRules === false) {
    if (tenOrMore === true) {
      rulesScore = 28
      rulesNote =
        '常時10人以上の規模で就業規則が未整備の可能性があります。作成・届出の義務があると考えられます。'
      topRisks.push({
        title: '就業規則が未整備の可能性（10人以上）',
        severity: 'high',
        why: '常時10人以上を雇用する場合、就業規則の作成・届出が求められます。未整備のままだと法令に抵触するおそれがあります。',
        fix: '就業規則のたたき台の作成から着手し、労働者への周知・届出まで進めることを検討するとよいでしょう。',
      })
    } else {
      rulesScore = 55
      rulesNote =
        '就業規則が未整備の状態です。10人未満でも、整備しておくとトラブル予防になります。'
      topRisks.push({
        title: '就業規則が未整備',
        severity: 'medium',
        why: '就業規則がないと、労働条件や手続きの根拠が曖昧になり、労使トラブルの火種になりやすい傾向があります。',
        fix: '義務化の有無にかかわらず、基本的なルールを就業規則として整備しておくことを検討するとよいでしょう。',
      })
    }
  } else if (hasRules === true) {
    rulesScore = 80
    rulesNote =
      '就業規則は整備済みです。最新の法改正を反映できているか、定期的な見直しを検討するとよいでしょう。'
  }

  // --- カテゴリ: 賃金（固定残業代の有無 × 規模） ---
  let wagesScore = NEUTRAL
  let wagesNote = NEUTRAL_NOTE
  if (hasFixedOt === true) {
    // 固定残業代そのものは適法だが、超過分の別途支給や金額・時間数の明示が論点になりやすい。
    wagesScore = tenOrMore === true ? 58 : 62
    wagesNote =
      '固定残業代の制度があります。想定時間を超えた分の別途支給や、金額・時間数の明示ができているか確認するとよいでしょう。'
    topRisks.push({
      title: '固定残業代の運用の確認',
      severity: 'medium',
      why: '固定残業代は、対象の時間数や金額が明示されず、超過分が別途支払われていない場合に問題になりやすい傾向があります。',
      fix: '固定残業の時間数と金額を明示し、それを超える残業には別途割増賃金を支払う運用になっているか確認するとよいでしょう。',
    })
  } else if (hasFixedOt === false) {
    wagesScore = 72
    wagesNote =
      '固定残業代の制度はありません。実残業に応じた割増賃金を正しく計算できているか確認するとよいでしょう。'
  }

  // --- カテゴリ: 休暇（年5日取得義務は一般論として要確認の指摘に） ---
  //   属性からは有給の運用まで判定できないため、決定的に減点はしない（要確認どまり）。
  const leaveScore = NEUTRAL
  const leaveNote =
    '年10日以上付与される労働者には、年5日の年次有給休暇の取得義務があります。取得状況を確認するとよいでしょう。'

  // --- カテゴリ: 社会保険（属性から判定不能＝要確認） ---
  const insuranceScore = NEUTRAL
  const insuranceNote =
    '社会保険の加入状況は登録情報からは判定できません。対象者の加入漏れがないか確認するとよいでしょう。'

  // --- カテゴリ: 育児・介護（属性から判定不能＝要確認） ---
  const childcareScore = NEUTRAL
  const childcareNote =
    '育児・介護に関する制度は登録情報からは判定できません。近年の法改正に沿った規定になっているか確認するとよいでしょう。'

  const categories: FallbackCategory[] = [
    { name: CAT.hours, score: clamp(hoursScore), note: hoursNote },
    { name: CAT.wages, score: clamp(wagesScore), note: wagesNote },
    { name: CAT.leave, score: clamp(leaveScore), note: leaveNote },
    { name: CAT.rules, score: clamp(rulesScore), note: rulesNote },
    { name: CAT.insurance, score: clamp(insuranceScore), note: insuranceNote },
    { name: CAT.childcare, score: clamp(childcareScore), note: childcareNote },
  ]

  // --- 総合スコア: 6カテゴリの平均を基準に、明確な高リスクへ軽いペナルティ ---
  const avg = categories.reduce((s, c) => s + c.score, 0) / categories.length
  const highRiskCount = topRisks.filter(r => r.severity === 'high').length
  const overall = clamp(avg - highRiskCount * 4)

  // 情報の充実度（属性の回答数＋プロファイル件数）でサマリの締めを出し分ける。
  const answeredAttrs = [
    attributes.industry_major,
    attributes.employee_band,
    has36,
    hasRules,
    hasFixedOt,
  ].filter(v => v !== null && v !== undefined && v !== '').length
  const hasEnough = answeredAttrs >= 3 || profiles.length >= 2 || answers.length >= 1

  // --- TOP3 指摘: severity 優先で3件に絞る。指摘ゼロなら前向きな一言を返す ---
  const sevRank: Record<FallbackTopRisk['severity'], number> = { high: 0, medium: 1, low: 2 }
  const ranked = [...topRisks].sort((a, b) => sevRank[a.severity] - sevRank[b.severity]).slice(0, 3)

  const summary = buildSummary(overall, ranked.length, hasEnough)

  return {
    score: overall,
    level: levelFromScore(overall),
    categories,
    topRisks: ranked,
    summary,
  }
}

/** 全体所感（当事者目線・条件形・敬体）。件数と充実度で文面を出し分ける。 */
function buildSummary(overall: number, riskCount: number, hasEnough: boolean): string {
  const head =
    riskCount > 0
      ? `登録された情報から、優先的に確認するとよい点が${riskCount}件見つかりました。`
      : '登録された情報の範囲では、大きく気になる点は見つかりませんでした。'
  const tail = hasEnough
    ? '自社ルールや相談履歴を貯めるほど、診断の精度が上がります。'
    : '業種・規模・主な制度の有無を登録すると、自社に合った診断になります。'
  return `${head}${tail}この結果は社内のセルフチェックの目安です。`
}
