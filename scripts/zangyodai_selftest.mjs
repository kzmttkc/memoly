// ============================================================================
// 残業代セルフ点検 — 敵対的セルフテスト（境界値・一次情報の数値例との突合）
//   実UIが使う計算コア（app/tools/zangyodai-check/calc.ts）そのものを import して
//   検証する（再実装との突合ではない）。node >= 23.6 の type stripping で直接実行:
//     node scripts/zangyodai_selftest.mjs
//
//   期待値の根拠（確認日 2026-07-09）:
//   - 厚労省「確かめよう労働条件」: 1.25 / 1.35 / +0.25 / 法定内=1.00 / 休日+深夜=1.60
//   - 厚労省リーフレット000930914: 60時間"超"のみ1.5・60超+深夜=1.75・
//     法定休日は60hの算定に含めない（入力仕様で分離済み）
//   - 東京労働局「しっかりマスター割増賃金編」: 単価=月給÷月平均所定・
//     例(月給243,000円÷162h=1,500円)・端数50銭ルール
// ============================================================================
import { calcZangyodai, validateZangyodai } from '../app/tools/zangyodai-check/calc.ts'

let pass = 0
let fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
    console.log(`  PASS ${name}`)
  } else {
    fail++
    console.error(`  FAIL ${name}\n    expected: ${JSON.stringify(expected)}\n    actual  : ${JSON.stringify(actual)}`)
  }
}

const base = {
  monthlyWage: 243_000, // しっかりマスター掲載例（基本給235,000+精皆勤8,000）
  avgMonthlyHours: 162, // 年間所定休日122日・1日8h → (365-122)*8/12 = 162
  hOvertime: 0,
  hOvertimeNight: 0,
  hHoliday: 0,
  hHolidayNight: 0,
  hLegalInside: null,
  paid: null,
}

console.log('[1] 単価（一次情報の掲載例と一致するか）')
check('243,000円÷162h = 1,500円/時', calcZangyodai({ ...base, hOvertime: 1 }).hourlyRate, 1500)

console.log('[2] 境界: 月60時間ちょうど（全量1.25・1.5は適用されない）')
{
  const r = calcZangyodai({ ...base, hOvertime: 60 })
  check('60hの内訳: 60h以下=60 / 60h超=0', [r.hUpTo60, r.hOver60], [60, 0])
  check('60h × 1.25 × 1500 = 112,500円', r.total, 112_500)
}

console.log('[3] 境界: 月61時間（超えた1時間だけ1.50）')
{
  const r = calcZangyodai({ ...base, hOvertime: 61 })
  check('内訳: 60h/1h', [r.hUpTo60, r.hOver60], [60, 1])
  check('112,500 + 1×1.5×1500 = 114,750円', r.total, 114_750)
}

console.log('[4] 境界: 法定内残業のみ（割増なし・1.00倍のみ）')
{
  const r = calcZangyodai({ ...base, hLegalInside: 10 })
  check('10h × 1.00 × 1500 = 15,000円', r.total, 15_000)
  check('割増分は0円', r.payOvertimeUpTo60 + r.payOvertimeOver60 + r.payOvertimeNight + r.payHoliday + r.payHolidayNight, 0)
}

console.log('[5] 重複: 法定休日かつ深夜（1.35+0.25=1.60）')
{
  const r = calcZangyodai({ ...base, hHoliday: 4, hHolidayNight: 4 })
  check('4h × 1.60 × 1500 = 9,600円', r.total, 9_600)
}

console.log('[6] 重複: 時間外60h超かつ深夜（1.50+0.25=1.75）')
{
  const r = calcZangyodai({ ...base, hOvertime: 62, hOvertimeNight: 2 })
  // 60×1.25 + 2×1.5 + 2×0.25 = 112500 + 4500 + 750（超過2hがすべて深夜の想定）
  check('62h(うち深夜2h) = 117,750円', r.total, 117_750)
  check('＝ 60×1.25 + 2×1.75 と一致', r.total, Math.round(1500 * (60 * 1.25 + 2 * 1.75)))
}

console.log('[7] 端数: 50銭未満切捨て・50銭以上切上げ')
{
  // 300,000 ÷ 170 = 1764.705…円 → 50銭以上 → 1765円
  const r = calcZangyodai({ ...base, monthlyWage: 300_000, avgMonthlyHours: 170, hOvertime: 1 })
  check('単価 1764.70…→1765円', r.hourlyRate, 1765)
  // 1765 × 1.25 = 2206.25 → 50銭未満 → 2206円
  check('1h×1.25 = 2206.25→2206円', r.payOvertimeUpTo60, 2206)
}

console.log('[8] 支払額との突合（status分岐）')
{
  const under = calcZangyodai({ ...base, hOvertime: 61, paid: 114_000 })
  check('不足あり → shortfall_risk / diff=-750', [under.status, under.diff], ['shortfall_risk', -750])
  const over = calcZangyodai({ ...base, hOvertime: 61, paid: 115_000 })
  check('上回る → covered / diff=+250', [over.status, over.diff], ['covered', 250])
  const exact = calcZangyodai({ ...base, hOvertime: 61, paid: 114_750 })
  check('ちょうど → covered / diff=0', [exact.status, exact.diff], ['covered', 0])
  const est = calcZangyodai({ ...base, hOvertime: 61 })
  check('支払額未入力 → estimate / diff=null', [est.status, est.diff], ['estimate', null])
}

console.log('[9] 検証: 不正入力を弾く')
{
  check('深夜 > 時間外 はエラー', validateZangyodai({ ...base, hOvertime: 5, hOvertimeNight: 6 }) !== null, true)
  check('休日深夜 > 休日 はエラー', validateZangyodai({ ...base, hHoliday: 2, hHolidayNight: 3 }) !== null, true)
  check('月給0はエラー', validateZangyodai({ ...base, monthlyWage: 0 }) !== null, true)
  check('所定時間の桁ミス(16.2)はエラー', validateZangyodai({ ...base, avgMonthlyHours: 16.2 }) !== null, true)
  check('時間の桁ミス(4500h)はエラー', validateZangyodai({ ...base, hOvertime: 4500 }) !== null, true)
  check('負値はエラー', validateZangyodai({ ...base, hOvertime: -1 }) !== null, true)
  check('正常入力はエラーなし', validateZangyodai({ ...base, hOvertime: 45 }), null)
}

console.log('[10] 半端な時間単位（0.25h刻み）でも壊れない')
{
  // 45.5h × 1.25 × 1500 = 85,312.5 → 50銭以上 → 85,313円（テスト自体を独立計算で固定）
  const r = calcZangyodai({ ...base, hOvertime: 45.5 })
  check('45.5h = 85,313円', r.total, 85_313)
}

console.log(`\n結果: PASS ${pass} / FAIL ${fail}`)
if (fail > 0) process.exit(1)
