// ============================================================================
// 残業代セルフ点検 — 純関数の計算コア（ブラウザ内計算・サーバ送信なし）
//
//   計算精度は信用の生命線。実装した仕様はすべて厚労省の一次情報で確認済み
//   （確認日 2026-07-09）。一次情報で確認できない仕様は実装しない。
//
//   一次情報:
//   (1) 厚生労働省「確かめよう労働条件｜時間外・休日労働と割増賃金」
//       https://www.check-roudou.mhlw.go.jp/study/roudousya_jikangai.html
//       - 法定労働時間 = 1日8時間・週40時間
//       - 割増率: 時間外25%以上 / 深夜(22時〜5時)25%以上 / 法定休日35%以上
//       - 法定内残業（所定超だが法定内）は割増不要（×1.00）
//       - 重複: 時間外+深夜=1.50 / 休日+深夜=1.60
//       - 基礎から除外できる賃金: 家族手当・通勤手当・別居手当・子女教育手当・
//         住宅手当・臨時に支払われた賃金・1か月を超える期間ごとに支払われる賃金
//   (2) 厚生労働省リーフレット「月60時間を超える時間外労働の割増賃金率が
//       引き上げられます」 https://www.mhlw.go.jp/content/000930914.pdf
//       - 月60時間"超"の部分は50%以上（60時間ちょうどまでは25%）
//       - 中小企業も2023年4月1日から50%（大企業は2010年4月から）
//       - 月60時間の算定に法定休日労働は含めない（法定外休日の労働は含める）
//       - 60時間超×深夜 = 50%+25% = 75%
//   (3) 東京労働局「しっかりマスター 労働基準法 割増賃金編」
//       https://jsite.mhlw.go.jp/tokyo-roudoukyoku/content/contents/000501860.pdf
//       - 月給制の1時間あたり賃金 = 月給 ÷ 1年間における1か月平均所定労働時間
//         （月平均所定 = (365 − 年間所定休日) × 1日の所定労働時間 ÷ 12）
//       - 端数処理: 1時間あたりの賃金額・割増賃金額に1円未満の端数が生じた場合、
//         50銭未満切捨て・50銭以上1円切上げが（就業規則等に定めたうえで）認められる。
//         1か月の時間外・休日・深夜それぞれの割増賃金の総額の1円未満も同じ扱い。
//       - 法定休日労働に時間外手当の重複加算は不要（35%のみ・深夜は加算）
//       - このPDFはOCR不能（画像化されておりテキスト抽出できない）。同一の単価算出式
//         と端数処理ルールは、テキスト抽出可能な (1) 厚生労働省「確かめよう労働条件」
//         の「割増賃金を計算してみましょう！」セクションでも一次情報として確認できる
//         （"月給額(各種手当を含んだ合計)÷1年間における1か月平均所定労働時間数＝A円"
//         "50銭未満の端数を切り捨て，それ以上を1円に切り上げる"。確認日 2026-07-09）。
//         (3) を裏取りする形で (1) を追加の一次情報として扱う。
//
//   実装しない（一次情報の範囲外 or ツールの範囲外として明記するもの）:
//   - 変形労働時間制・フレックス・裁量労働・管理監督者の個別判定
//   - 所定労働時間内の深夜勤務の深夜手当（残業・休日労働の点検に限る）
//   - 歩合給・時間帯別時給の単価計算（月給制のみ）
// ============================================================================

/** 法定時間外（月60時間以下の部分）: 25%以上 → ×1.25 */
export const MULT_OVERTIME = 1.25
/** 法定時間外（月60時間を超える部分）: 50%以上 → ×1.50（中小企業も2023-04-01から） */
export const MULT_OVERTIME_OVER60 = 1.5
/** 深夜(22時〜5時)の加算: +25% → +0.25（時間外・休日いずれとも加算関係） */
export const ADD_NIGHT = 0.25
/** 法定休日: 35%以上 → ×1.35（時間外の重複加算はしない） */
export const MULT_HOLIDAY = 1.35
/** 法定内残業（所定超・法定内）: 割増不要 → ×1.00 */
export const MULT_LEGAL_INSIDE = 1.0
/** 月60時間の閾値。「超える」部分のみ1.5（60時間ちょうどは全量1.25） */
export const OVER60_THRESHOLD = 60

/**
 * 円未満の端数処理: 50銭未満切捨て・50銭以上切上げ（通達で認められる扱い）。
 * 非負値では Math.round と一致する。負値には使わない。
 */
export function roundYen(v: number): number {
  return Math.round(v)
}

export type ZangyodaiInput = {
  /** 割増賃金の基礎となる月給（除外7手当を除いた額・円） */
  monthlyWage: number
  /** 1年間における1か月平均所定労働時間（時間） */
  avgMonthlyHours: number
  /** 法定時間外労働の時間数（月・法定休日労働を除く） */
  hOvertime: number
  /** うち深夜(22時〜5時)に重なった時間数 */
  hOvertimeNight: number
  /** 法定休日労働の時間数（月） */
  hHoliday: number
  /** うち深夜に重なった時間数 */
  hHolidayNight: number
  /** 法定内残業の時間数（任意・null=未入力） */
  hLegalInside: number | null
  /** その月に残業代等として実際に支払った合計額（任意・null=未入力） */
  paid: number | null
}

export type ZangyodaiResult = {
  /** 1時間あたりの基礎単価（円未満は50銭ルールで処理） */
  hourlyRate: number
  /** 時間外のうち月60時間以下の部分（時間） */
  hUpTo60: number
  /** 時間外のうち月60時間を超える部分（時間） */
  hOver60: number
  /** 時間外（60時間以下・×1.25）の目安額 */
  payOvertimeUpTo60: number
  /** 時間外（60時間超・×1.50）の目安額 */
  payOvertimeOver60: number
  /** 時間外×深夜の加算（+0.25）の目安額 */
  payOvertimeNight: number
  /** 法定休日（×1.35）の目安額 */
  payHoliday: number
  /** 休日×深夜の加算（+0.25）の目安額 */
  payHolidayNight: number
  /** 法定内残業（×1.00）の目安額（未入力なら0） */
  payLegalInside: number
  /** 支払いの最低ライン目安（上記の合計） */
  total: number
  /** 実支払額との差（paid − total）。paid未入力なら null */
  diff: number | null
  /** tool_completed / CTA と共有する結果種別 */
  status: 'covered' | 'shortfall_risk' | 'estimate'
}

/**
 * 残業代の最低ライン目安を計算する。
 *   深夜の加算(+0.25)は、時間外の60時間以下/超のどちらの部分に重なっていても
 *   加算幅が同じ（1.25→1.50 / 1.50→1.75）ため、部分を特定せず一律+0.25で正確。
 */
export function calcZangyodai(input: ZangyodaiInput): ZangyodaiResult {
  const rate = roundYen(input.monthlyWage / input.avgMonthlyHours)

  const hOver60 = Math.max(0, input.hOvertime - OVER60_THRESHOLD)
  const hUpTo60 = input.hOvertime - hOver60

  const payOvertimeUpTo60 = roundYen(rate * hUpTo60 * MULT_OVERTIME)
  const payOvertimeOver60 = roundYen(rate * hOver60 * MULT_OVERTIME_OVER60)
  const payOvertimeNight = roundYen(rate * input.hOvertimeNight * ADD_NIGHT)
  const payHoliday = roundYen(rate * input.hHoliday * MULT_HOLIDAY)
  const payHolidayNight = roundYen(rate * input.hHolidayNight * ADD_NIGHT)
  const payLegalInside =
    input.hLegalInside === null ? 0 : roundYen(rate * input.hLegalInside * MULT_LEGAL_INSIDE)

  const total =
    payOvertimeUpTo60 +
    payOvertimeOver60 +
    payOvertimeNight +
    payHoliday +
    payHolidayNight +
    payLegalInside

  const diff = input.paid === null ? null : input.paid - total
  const status: ZangyodaiResult['status'] =
    diff === null ? 'estimate' : diff < 0 ? 'shortfall_risk' : 'covered'

  return {
    hourlyRate: rate,
    hUpTo60,
    hOver60,
    payOvertimeUpTo60,
    payOvertimeOver60,
    payOvertimeNight,
    payHoliday,
    payHolidayNight,
    payLegalInside,
    total,
    diff,
    status,
  }
}

/** 入力の検証。エラーメッセージを返す（問題なければ null）。 */
export function validateZangyodai(input: ZangyodaiInput): string | null {
  const { monthlyWage, avgMonthlyHours, hOvertime, hOvertimeNight, hHoliday, hHolidayNight, hLegalInside, paid } = input
  const nums = [monthlyWage, avgMonthlyHours, hOvertime, hOvertimeNight, hHoliday, hHolidayNight]
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
    return '各項目は0以上の数値で入力してください。'
  }
  if (hLegalInside !== null && (!Number.isFinite(hLegalInside) || hLegalInside < 0)) {
    return '法定内残業は0以上の数値で入力してください（分からなければ空欄で構いません）。'
  }
  if (paid !== null && (!Number.isFinite(paid) || paid < 0)) {
    return '支払った額は0以上の数値で入力してください（分からなければ空欄で構いません）。'
  }
  if (monthlyWage <= 0) return '月給（算入対象額）を入力してください。'
  if (monthlyWage > 10_000_000) return '月給が大きすぎるようです。円単位でご確認ください。'
  if (avgMonthlyHours < 50 || avgMonthlyHours > 300) {
    return '1か月平均所定労働時間は50〜300の範囲で入力してください（例：162）。'
  }
  // 1か月は最大744時間。桁ミスを弾く。
  if (hOvertime > 744 || hHoliday > 744 || (hLegalInside !== null && hLegalInside > 744)) {
    return '時間数が大きすぎるようです。単位が「時間」になっているかご確認ください。'
  }
  if (hOvertimeNight > hOvertime) {
    return '「うち深夜」の時間は、法定時間外労働の時間数以下で入力してください。'
  }
  if (hHolidayNight > hHoliday) {
    return '「うち深夜」の時間は、法定休日労働の時間数以下で入力してください。'
  }
  if (paid !== null && paid > 10_000_000) {
    return '支払った額が大きすぎるようです。円単位でご確認ください。'
  }
  return null
}
