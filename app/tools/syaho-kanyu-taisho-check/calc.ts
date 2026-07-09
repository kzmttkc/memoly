// ============================================================================
// パート従業員 社会保険加入対象セルフ点検 — 純関数の計算コア（ブラウザ内計算・サーバ送信なし）
//
//   短時間労働者（パート・アルバイト）が、勤務先の健康保険・厚生年金保険（社会保険）に
//   加入する対象になるかを、法律で定められた5つの加入要件に照らして点検する。
//   計算精度は信用の生命線。実装した仕様はすべて一次情報で確認済み（確認日 2026-07-09）。
//   一次情報で確認できない仕様は実装しない。
//
//   一次情報:
//   (1) 日本年金機構「短時間労働者に対する健康保険・厚生年金保険の適用の拡大」
//       https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html
//       （2026-07-09 確認。WebFetchで本文抽出し再確認済み）
//       - 短時間労働者が社会保険に加入するのは、次の5つすべてを満たす場合:
//         ①週の所定労働時間が20時間以上
//         ②月額の所定内賃金が8.8万円以上
//         ③継続して2か月を超えて使用される見込みがある
//         ④学生でないこと（卒業見込・休学中等の例外あり。本ツールでは例外は扱わない）
//         ⑤勤務先が特定適用事業所等（厚生年金保険の被保険者数が要件人数以上の事業所等）
//           であること
//       - 特定適用事業所の被保険者数要件は、次の日程で段階的に引き下げられる:
//         〜令和9(2027)年9月: 51人以上
//         令和9(2027)年10月〜令和11(2029)年9月: 36人以上
//         令和11(2029)年10月〜令和14(2032)年9月: 21人以上
//         令和14(2032)年10月〜: 11人以上
//         （確認日時点で、この先さらに引き下げられるかどうかの続報は一次情報の本文で
//         確認できなかったため実装しない。図表画像に記載がある可能性はあるが、テキスト
//         抽出できる一次情報の範囲に留める）
//       - 賃金要件（月額8.8万円以上）は令和8(2026)年10月に撤廃予定
//   (2) 厚生労働省「社会保険の加入対象の拡大について」
//       https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000147284_00021.html
//       （2026-07-09 確認）
//       - (1)と同一の企業規模要件の段階的縮小スケジュールを重ねて確認
//   (3) 厚生労働省「『年収の壁』への対応」
//       https://www.mhlw.go.jp/stf/taiou_001_00002.html （2026-07-09 確認）
//       - 賃金要件（月額8.8万円）は「最低賃金の状況を踏まえ、令和8(2026)年10月に撤廃予定」
//       - 撤廃時期は予定であり、確認日時点で確定した施行期日を定める政令等は未公表
//
//   実装しない（一次情報の範囲外 or ツールの範囲外として明記するもの）:
//   - 学生除外の例外（卒業見込・休学・夜間定時制通信制等）の個別判定
//   - 特定適用事業所要件を満たさない事業所での、同一事業所の正社員の4分の3以上の
//     労働時間・日数で働く場合の加入（別ルートのため対象外）
//   - 令和14(2032)年10月以降のさらなる企業規模要件の引き下げ（一次情報未確認のため）
// ============================================================================

/** 週の所定労働時間の加入基準（時間以上） */
export const WEEKLY_HOURS_THRESHOLD = 20
/** 月額所定内賃金の加入基準（円以上）。令和8年10月に撤廃予定。 */
export const WAGE_THRESHOLD_YEN = 88_000
/** 賃金要件が撤廃される（予定の）日。この日以降は賃金要件を判定に使わない。 */
export const WAGE_REQUIREMENT_ABOLITION_DATE = '2026-10-01'

/** 特定適用事業所の被保険者数要件（段階的縮小スケジュール・一次情報で確認できる範囲）。 */
export const COMPANY_SIZE_SCHEDULE: { from: string; threshold: number; label: string }[] = [
  { from: '0000-01-01', threshold: 51, label: '〜2027年9月：51人以上' },
  { from: '2027-10-01', threshold: 36, label: '2027年10月〜2029年9月：36人以上' },
  { from: '2029-10-01', threshold: 21, label: '2029年10月〜2032年9月：21人以上' },
  { from: '2032-10-01', threshold: 11, label: '2032年10月〜：11人以上' },
]

/** 点検したい時点における、特定適用事業所の被保険者数要件（人以上）を返す。 */
export function companySizeThresholdAt(assessDate: string): number {
  let threshold = COMPANY_SIZE_SCHEDULE[0].threshold
  for (const row of COMPANY_SIZE_SCHEDULE) {
    if (assessDate >= row.from) threshold = row.threshold
  }
  return threshold
}

/** 点検したい時点で、賃金要件（月額8.8万円以上）がまだ有効かどうか。 */
export function wageRequirementAppliesAt(assessDate: string): boolean {
  return assessDate < WAGE_REQUIREMENT_ABOLITION_DATE
}

export type SyahoKanyuInput = {
  /** 点検したい時点（YYYY-MM-DD）。今日、または将来の日付（例：2026-10-01以降）を指定できる */
  assessDate: string
  /** 自社の厚生年金保険の被保険者数（特定適用事業所の判定に使う） */
  companySize: number
  /** その従業員の週の所定労働時間 */
  weeklyHours: number
  /** その従業員の所定内賃金（月額・円）。時間外・通勤手当等を除く所定内の賃金 */
  monthlyWage: number
  /** 継続して2か月を超えて使用される見込みがあるか */
  expectedOver2Months: boolean
  /** 学生かどうか（卒業見込・休学中等の例外はこのツールでは扱わない） */
  isStudent: boolean
}

export type CriterionKey = 'weeklyHours' | 'wage' | 'duration' | 'notStudent' | 'companySize'

export type CriterionResult = {
  key: CriterionKey
  label: string
  /** この時点でその要件を満たすか。賃金要件が撤廃済みの時点では常にtrue（判定に使わない） */
  met: boolean
  detail: string
}

export type SyahoKanyuResult = {
  /** 点検した時点における特定適用事業所の被保険者数要件 */
  companySizeThreshold: number
  /** 点検した時点で賃金要件がまだ有効か */
  wageRequirementApplies: boolean
  /** 5要件それぞれの判定 */
  criteria: CriterionResult[]
  /** 5要件すべてを満たすか */
  allMet: boolean
  /** tool_completed / CTA と共有する結果種別 */
  status: 'taisho' | 'taishogai'
}

/**
 * 短時間労働者の社会保険加入対象を、5要件に照らして点検する。
 *   賃金要件は、点検時点が撤廃予定日（2026-10-01）以降なら自動的に「対象」として扱う
 *   （撤廃予定のため、その時点では加入可否の判定に使わない）。
 */
export function calcSyahoKanyu(input: SyahoKanyuInput): SyahoKanyuResult {
  const threshold = companySizeThresholdAt(input.assessDate)
  const wageApplies = wageRequirementAppliesAt(input.assessDate)

  const metWeekly = input.weeklyHours >= WEEKLY_HOURS_THRESHOLD
  const metWage = wageApplies ? input.monthlyWage >= WAGE_THRESHOLD_YEN : true
  const metDuration = input.expectedOver2Months
  const metNotStudent = !input.isStudent
  const metCompanySize = input.companySize >= threshold

  const criteria: CriterionResult[] = [
    {
      key: 'weeklyHours',
      label: `週の所定労働時間が${WEEKLY_HOURS_THRESHOLD}時間以上`,
      met: metWeekly,
      detail: `入力：${input.weeklyHours}時間`,
    },
    {
      key: 'wage',
      label: `所定内賃金が月額${WAGE_THRESHOLD_YEN.toLocaleString('ja-JP')}円以上`,
      met: metWage,
      detail: wageApplies
        ? `入力：${input.monthlyWage.toLocaleString('ja-JP')}円`
        : '賃金要件は撤廃予定のため、この時点では判定に使いません',
    },
    {
      key: 'duration',
      label: '継続して2か月を超えて使用される見込みがある',
      met: metDuration,
      detail: input.expectedOver2Months ? '見込みあり' : '見込みなし（または不明）',
    },
    {
      key: 'notStudent',
      label: '学生でない',
      met: metNotStudent,
      detail: input.isStudent ? '学生（卒業見込等の例外はこのツールでは扱いません）' : '学生ではない',
    },
    {
      key: 'companySize',
      label: `勤務先が特定適用事業所（被保険者数${threshold}人以上）`,
      met: metCompanySize,
      detail: `入力：被保険者数${input.companySize}人 / この時点の基準：${threshold}人以上`,
    },
  ]

  const allMet = criteria.every((c) => c.met)

  return {
    companySizeThreshold: threshold,
    wageRequirementApplies: wageApplies,
    criteria,
    allMet,
    status: allMet ? 'taisho' : 'taishogai',
  }
}

/** 入力の検証。エラーメッセージを返す（問題なければ null）。 */
export function validateSyahoKanyu(input: SyahoKanyuInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assessDate)) {
    return '点検したい時点を選択してください。'
  }
  const d = new Date(input.assessDate)
  if (Number.isNaN(d.getTime())) {
    return '点検したい時点の日付が正しくありません。'
  }
  if (input.assessDate < '2020-01-01' || input.assessDate > '2040-12-31') {
    return '点検したい時点は2020年〜2040年の範囲で指定してください。'
  }
  if (!Number.isFinite(input.companySize) || input.companySize < 0) {
    return '自社の厚生年金保険の被保険者数は0以上の数値で入力してください。'
  }
  if (input.companySize > 1_000_000) {
    return '被保険者数が大きすぎるようです。人数の単位をご確認ください。'
  }
  if (!Number.isFinite(input.weeklyHours) || input.weeklyHours < 0) {
    return '週の所定労働時間は0以上の数値で入力してください。'
  }
  if (input.weeklyHours > 168) {
    return '週の所定労働時間が大きすぎるようです（1週間は168時間までです）。'
  }
  if (!Number.isFinite(input.monthlyWage) || input.monthlyWage < 0) {
    return '所定内賃金（月額）は0以上の数値で入力してください。'
  }
  if (input.monthlyWage > 10_000_000) {
    return '所定内賃金が大きすぎるようです。円単位でご確認ください。'
  }
  return null
}
