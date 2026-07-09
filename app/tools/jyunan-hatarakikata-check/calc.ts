// ============================================================================
// 柔軟な働き方を実現するための措置 セルフ点検 — 純関数の計算コア（ブラウザ内計算・サーバ送信なし）
//
//   2025年（令和7年）10月1日に施行された「柔軟な働き方を実現するための措置」（育児・
//   介護休業法 第23条の3）について、(A) 自社が講じている措置が「2つ以上」の義務を
//   満たしているか、(B) 従業員の子の年齢から見て、今どの対応が必要か（対象年齢か、
//   個別周知・意向確認を行うべき時期か）を点検する。
//   計算精度は信用の生命線。実装した仕様はすべて一次情報で確認済み（確認日 2026-07-09）。
//   一次情報で確認できない仕様は実装しない。
//
//   一次情報:
//   (1) 厚生労働省「柔軟な働き方を実現するための措置」（育児休業制度特設サイト）
//       https://www.mhlw.go.jp/seisakunitsuite/bunya/koyou_roudou/koyoukintou/ryouritsu/ikuji/flexiblework/
//       （2026-07-09 確認。WebFetchで本文抽出）
//   (2) 厚生労働省「育児・介護休業法 改正ポイントのご案内」リーフレットNo.17
//       （令和6年11月作成・令和6年12月改訂）
//       https://www.mhlw.go.jp/content/11900000/001259367.pdf
//       （2026-07-09 確認。PDF本文を直接抽出して確認）
//       - ➓「柔軟な働き方を実現するための措置等」令和7(2025)年10月1日から施行
//       - 事業主は、3歳から小学校就学前の子を養育する労働者に関して、次の5つの
//         選択して講ずべき措置の中から、2つ以上の措置を選択して講ずる義務:
//           ①始業時刻等の変更（フレックスタイム制／時差出勤。1日の所定労働時間は変更しない）
//           ②テレワーク等（1日の所定労働時間を変更せず、月10日以上利用できるもの）
//           ③保育施設の設置運営等（ベビーシッターの手配・費用負担なども含む）
//           ④養育両立支援休暇の付与（1日の所定労働時間を変更せず、年10日以上取得できるもの）
//           ⑤短時間勤務制度（1日の所定労働時間を原則6時間とする措置を含むもの）
//         労働者は事業主が講じた措置の中から1つを選択して利用できる。
//         事業主が措置を選択する際は、過半数組合等からの意見聴取の機会を設ける義務がある。
//       - 柔軟な働き方を実現するための措置の個別の周知・意向確認（同じく義務・2025-10-01施行）:
//         3歳未満の子を養育する労働者に対して、「子が3歳の誕生日の1か月前までの1年間
//         （1歳11か月に達する日の翌々日から2歳11か月に達する日の翌日まで）」に、
//         選択した対象措置（2つ以上）の内容・申出先・残業免除等の関連制度を個別に
//         周知し、利用意向を確認する義務がある。
//       - 事業主の皆さまへの案内文に明記: 「1〜4、6〜11は全企業が対象」。本ツールが
//         扱う項番10・11はこの範囲に含まれるため、企業規模による適用除外はない。
//   (3) 厚生労働省「育児・介護休業法のあらまし」（令和7年4月1日、10月1日施行対応）
//       https://www.mhlw.go.jp/content/11909000/000355354.pdf
//       （2026-07-09 確認。PDF本文を直接抽出）
//       - 法的根拠: 育児休業、介護休業等育児又は家族介護を行う労働者の福祉に関する
//         法律 第23条の3第1項〜第4項（措置）、第5項（個別周知・意向確認）
//       - 「3歳になるまでの適切な時期」の起算方法を具体例つきで確認:
//         「1歳11か月に達する日」＝ 1歳の誕生日から11か月後の月における誕生日の
//         応当日の前日（応当日が存在しない月は、その月の末日）
//         例1）誕生日 R7/5/1 → 1歳11か月に達する日 = R9/3/31、その翌々日 R9/4/2
//              2歳11か月に達する日 = R10/3/31、その翌日 R10/4/1
//              → 「3歳になるまでの適切な時期」= R9/4/2〜R10/4/1
//         例2）誕生日 R7/5/31（応当日が存在しない31日ケース）→
//              1歳11か月に達する日 = R9/4/30（月末に丸め）、その翌々日 R9/5/2
//              2歳11か月に達する日 = R10/4/30、その翌日 R10/5/1
//              → 「3歳になるまでの適切な時期」= R9/5/2〜R10/5/1
//         本ツールの日付計算は、この2つの具体例で完全に一致することを確認済み。
//   (4) 厚生労働省「法改正のポイント」（育児休業制度特設サイト）
//       https://www.mhlw.go.jp/seisakunitsuite/bunya/koyou_roudou/koyoukintou/ryouritsu/ikuji/law-amendment/
//       （2026-07-09 確認）
//   (5) 「小学校就学の始期に達するまでの子」の一般的な扱い（＝満6歳に達する日以後の
//       最初の3月31日までの子）は、児童福祉法上の「幼児」の定義（1歳〜小学校就学の
//       始期に達するまでの者）や学校教育法第17条・同法施行規則第59条（学年は4月1日
//       始まり）から導かれる一般的な整理。厚生労働省資料
//       https://www.mhlw.go.jp/file/05-Shingikai-12601000-Seisakutoukatsukan-Sanjikanshitsu_Shakaihoshoutantou/0000096703_1.pdf
//       （2026-07-09 確認）で「幼児＝1歳から小学校就学の始期に達するまでの者」の定義を確認。
//
//   実装しない（一次情報の範囲外 or ツールの範囲外として明記するもの）:
//   - 日々雇い入れられる労働者、労使協定で除外された労働者（継続雇用1年未満・週所定
//     労働日数2日以下・時間単位取得が困難な業務従事者）の個別除外判定
//   - 3歳未満の子を養育する労働者に対するテレワーク導入の努力義務（別枠の努力義務。
//     本ツールが扱う「2つ以上の措置」の義務そのものではない）
//   - 妊娠・出産等の申出時の個別の意向聴取・配慮（第23条の3とは別条の努力義務）
//   - うるう年2/29生まれ等、暦計算ライブラリなしで極端に稀な暦異常が起きるケースの
//     追加検証（日付計算はJSのDateオブジェクトで年月日を明示的に扱い、2つの公式
//     具体例と一致することのみ確認済み）
// ============================================================================

/** 2025年10月1日施行。この日以降、全企業に本措置の義務が生じている（企業規模の適用除外なし）。 */
export const EFFECTIVE_DATE = '2025-10-01'

// ---------------------------------------------------------------------------
// 日付ユーティリティ（YYYY-MM-DD文字列で入出力。内部は{y, m(0始まり), d}）
// ---------------------------------------------------------------------------

type YMD = { y: number; m: number; d: number }

function parseISO(s: string): YMD {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toISO(v: YMD): string {
  return `${v.y}-${pad2(v.m + 1)}-${pad2(v.d)}`
}

function daysInMonth(y: number, m: number): number {
  // m: 0始まり。次の月の0日目 = その月の末日。
  return new Date(y, m + 1, 0).getDate()
}

function addDaysYMD(v: YMD, n: number): YMD {
  const dt = new Date(v.y, v.m, v.d + n)
  return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() }
}

function cmpYMD(a: YMD, b: YMD): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

/**
 * 「◯歳◯か月に達する日」を計算する（年齢計算に関する法律の一般原則＝応当日の前日に
 * 達する。応当日がその月に存在しない場合は、その月の末日に達する）。
 * 一次情報(3)の2つの具体例（誕生日 R7/5/1 と R7/5/31）で完全一致することを確認済み。
 */
function reachAgeDate(birth: YMD, addYears: number, addMonths: number): YMD {
  const totalMonths = birth.m + addMonths
  const carryYears = Math.floor(totalMonths / 12)
  const targetMonth = ((totalMonths % 12) + 12) % 12
  const targetYear = birth.y + addYears + carryYears
  const dim = daysInMonth(targetYear, targetMonth)

  if (birth.d <= dim) {
    // 応当日が存在する → 達する日は応当日の前日
    return addDaysYMD({ y: targetYear, m: targetMonth, d: birth.d }, -1)
  }
  // 応当日が存在しない（例：31日生まれ×30日までの月）→ 達する日はその月の末日
  return { y: targetYear, m: targetMonth, d: dim }
}

/** 「6歳に達する日以後の最初の3月31日」＝小学校就学の始期に達するまでの子として扱う最終日。 */
function schoolEntryThresholdDate(birth: YMD): YMD {
  const age6 = reachAgeDate(birth, 6, 0)
  // age6 が 1〜3月（0始まりで0,1,2）なら同年の3/31、4月以降(3〜11)なら翌年の3/31。
  const thresholdYear = age6.m <= 2 ? age6.y : age6.y + 1
  return { y: thresholdYear, m: 2, d: 31 }
}

// ---------------------------------------------------------------------------
// (A) 自社が講じている措置の点検（2つ以上の選択義務・第23条の3第1項〜第4項）
// ---------------------------------------------------------------------------

export type MeasureKey = 'startTime' | 'telework' | 'childcareFacility' | 'leave' | 'shortHours'

export type MeasureInput = {
  /** ①始業時刻等の変更（フレックスタイム制または時差出勤）を講じているか */
  startTime: boolean
  /** ②テレワーク等を導入しているか */
  telework: boolean
  /** ②テレワーク等を、月何日以上利用できるか（telework=trueのときのみ使用） */
  teleworkDaysPerMonth: number
  /** ③保育施設の設置運営その他これに準ずる便宜の供与をしているか */
  childcareFacility: boolean
  /** ④養育両立支援休暇を付与しているか */
  leave: boolean
  /** ④養育両立支援休暇を、年何日以上取得できるか（leave=trueのときのみ使用） */
  leaveDaysPerYear: number
  /** ⑤短時間勤務制度を導入しているか */
  shortHours: boolean
  /** ⑤その短時間勤務制度は、1日の所定労働時間を原則6時間とする措置を含むか */
  shortHoursIncludes6h: boolean
  /** 措置を選択する際に、過半数組合等からの意見聴取を行ったか */
  heardUnionOpinion: boolean
}

export type MeasureCriterion = {
  key: MeasureKey
  label: string
  /** その措置を導入していると回答したか */
  offered: boolean
  /** 導入した上で、義務の要件（日数・内容）を満たしているか */
  qualifies: boolean
  detail: string
}

export type MeasureCheckResult = {
  criteria: MeasureCriterion[]
  /** 要件を満たす形で導入している措置の数 */
  qualifyingCount: number
  /** 2つ以上の措置を満たしているか（義務充足） */
  meetsObligation: boolean
  heardUnionOpinion: boolean
}

export function calcMeasureCheck(input: MeasureInput): MeasureCheckResult {
  const criteria: MeasureCriterion[] = [
    {
      key: 'startTime',
      label: '①始業時刻等の変更（フレックスタイム制または時差出勤の制度）',
      offered: input.startTime,
      qualifies: input.startTime,
      detail: input.startTime
        ? '導入済み（1日の所定労働時間を変更しない前提の措置として数えます）'
        : '未導入',
    },
    {
      key: 'telework',
      label: '②テレワーク等（月10日以上利用できるもの）',
      offered: input.telework,
      qualifies: input.telework && input.teleworkDaysPerMonth >= 10,
      detail: !input.telework
        ? '未導入'
        : input.teleworkDaysPerMonth >= 10
          ? `導入済み・月${input.teleworkDaysPerMonth}日以上利用可（要件の月10日以上を満たします）`
          : `導入済みだが月${input.teleworkDaysPerMonth}日までのため、義務が求める「月10日以上」に届いていません`,
    },
    {
      key: 'childcareFacility',
      label: '③保育施設の設置運営等（ベビーシッターの手配・費用負担なども含む）',
      offered: input.childcareFacility,
      qualifies: input.childcareFacility,
      detail: input.childcareFacility ? '導入済み' : '未導入',
    },
    {
      key: 'leave',
      label: '④養育両立支援休暇の付与（年10日以上取得できるもの）',
      offered: input.leave,
      qualifies: input.leave && input.leaveDaysPerYear >= 10,
      detail: !input.leave
        ? '未導入'
        : input.leaveDaysPerYear >= 10
          ? `導入済み・年${input.leaveDaysPerYear}日以上（要件の年10日以上を満たします）`
          : `導入済みだが年${input.leaveDaysPerYear}日までのため、義務が求める「年10日以上」に届いていません`,
    },
    {
      key: 'shortHours',
      label: '⑤短時間勤務制度（1日の所定労働時間を原則6時間とする措置を含むもの）',
      offered: input.shortHours,
      qualifies: input.shortHours && input.shortHoursIncludes6h,
      detail: !input.shortHours
        ? '未導入'
        : input.shortHoursIncludes6h
          ? '導入済み・1日6時間とする措置を含む（要件を満たします）'
          : '導入済みだが1日6時間とする措置を含んでいないため、要件を満たしません',
    },
  ]

  const qualifyingCount = criteria.filter((c) => c.qualifies).length

  return {
    criteria,
    qualifyingCount,
    meetsObligation: qualifyingCount >= 2,
    heardUnionOpinion: input.heardUnionOpinion,
  }
}

export function validateMeasureInput(input: MeasureInput): string | null {
  if (input.telework && (!Number.isFinite(input.teleworkDaysPerMonth) || input.teleworkDaysPerMonth < 0)) {
    return 'テレワーク等を月に何日利用できるか、0以上の数値で入力してください。'
  }
  if (input.telework && input.teleworkDaysPerMonth > 31) {
    return 'テレワーク等の月あたり利用日数が大きすぎるようです（1か月は31日までです）。'
  }
  if (input.leave && (!Number.isFinite(input.leaveDaysPerYear) || input.leaveDaysPerYear < 0)) {
    return '養育両立支援休暇を年に何日付与しているか、0以上の数値で入力してください。'
  }
  if (input.leave && input.leaveDaysPerYear > 365) {
    return '養育両立支援休暇の年あたり日数が大きすぎるようです。'
  }
  return null
}

// ---------------------------------------------------------------------------
// (B) 従業員の子の年齢から見た、今必要な対応の判定
// ---------------------------------------------------------------------------

export type AgeBand = 'under3' | 'threeToSchoolAge' | 'schoolAgeOrOlder'

export type NotificationWindowStatus = 'before' | 'within' | 'missed'

export type ChildInput = {
  /** 子の生年月日（YYYY-MM-DD） */
  birthDate: string
  /** 点検したい時点（YYYY-MM-DD）。空欄なら今日として扱う */
  assessDate: string
}

export type ChildCheckResult = {
  ageBand: AgeBand
  /** 3歳に達する日 */
  age3Date: string
  /** 小学校就学の始期に達するまでの子として扱う最終日（この日の翌日から対象外） */
  schoolEntryThresholdDate: string
  /** 個別周知・意向確認を行うべき「3歳になるまでの適切な時期」の窓 */
  notificationWindow: {
    start: string
    end: string
    status: NotificationWindowStatus
  }
}

export function calcChildCheck(input: ChildInput): ChildCheckResult {
  const birth = parseISO(input.birthDate)
  const assess = parseISO(input.assessDate)

  const age3 = reachAgeDate(birth, 3, 0)
  const schoolThreshold = schoolEntryThresholdDate(birth)

  const windowStart = addDaysYMD(reachAgeDate(birth, 1, 11), 2)
  const windowEnd = addDaysYMD(reachAgeDate(birth, 2, 11), 1)

  let status: NotificationWindowStatus
  if (cmpYMD(assess, windowStart) < 0) status = 'before'
  else if (cmpYMD(assess, windowEnd) <= 0) status = 'within'
  else status = 'missed'

  let ageBand: AgeBand
  if (cmpYMD(assess, age3) < 0) ageBand = 'under3'
  else if (cmpYMD(assess, schoolThreshold) <= 0) ageBand = 'threeToSchoolAge'
  else ageBand = 'schoolAgeOrOlder'

  return {
    ageBand,
    age3Date: toISO(age3),
    schoolEntryThresholdDate: toISO(schoolThreshold),
    notificationWindow: {
      start: toISO(windowStart),
      end: toISO(windowEnd),
      status,
    },
  }
}

export function validateChildInput(input: ChildInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    return '子の生年月日を選択してください。'
  }
  const b = new Date(input.birthDate)
  if (Number.isNaN(b.getTime())) {
    return '子の生年月日が正しくありません。'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assessDate)) {
    return '点検したい時点の日付が正しくありません。'
  }
  const a = new Date(input.assessDate)
  if (Number.isNaN(a.getTime())) {
    return '点検したい時点の日付が正しくありません。'
  }
  if (input.birthDate > input.assessDate) {
    return '子の生年月日は、点検したい時点より前の日付にしてください。'
  }
  if (input.birthDate < '2000-01-01') {
    return '子の生年月日が古すぎるようです。ご確認ください。'
  }
  return null
}
