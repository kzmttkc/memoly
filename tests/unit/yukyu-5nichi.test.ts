// ============================================================================
// 年5日 有給取得義務ツール — 履行期間の「終期」を条文で固定する関門。
//
// なぜ要るか（2026-08-12 機能品質監査で検出した重大欠陥）:
//   Calculator.tsx が「年5日を取らせる期限」と「次の基準日」を同じ式
//   （基準日+1年）で出しており、基準日 2025-04-01 に対して両方 2026年4月1日 を
//   表示していた。2つの履行期間が同じ日を共有する矛盾であり、しかも誤りの向きが
//   「義務未達側に猶予を1日多く見せる」＝利用者が期限を1日過ぎて違反する。
//
// 一次情報（労働基準法 第39条第7項・e-Gov 法令XMLで原文確認 2026-08-12）:
//   「…五日については、基準日（継続勤務した期間を六箇月経過日から一年ごとに区分した
//     各期間…の初日をいう…）から一年以内の期間に、労働者ごとにその時季を定めることに
//     より与えなければならない。」
//   → 履行期間は［基準日, 基準日から1年以内］。初日算入で起算するため、
//     民法143条2項本文により満了日＝翌年の応当日の前日。
//     応当日が存在しない月（2/29起算）は同項ただし書によりその月の末日に満了する。
//   → 期限（履行期間の最終日）と次の基準日（次の期間の初日）は必ず1日ずれる。
//
// この関門は旧実装（deadline = nextKijunbi）に当てると落ちる。
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDateOnly,
  fulfillmentDeadline,
  nextKijunbi,
  formatJp,
} from '../../app/tools/yukyu-5nichi-check/calc.ts'

const at = (s: string) => {
  const d = parseDateOnly(s)
  assert.ok(d, `${s} が解釈できない`)
  return d
}

test('監査の再現ケース: 基準日 2025-04-01 の期限は 2026年3月31日（2026年4月1日ではない）', () => {
  const base = at('2025-04-01')
  assert.equal(formatJp(fulfillmentDeadline(base)), '2026年3月31日')
  assert.equal(formatJp(nextKijunbi(base)), '2026年4月1日')
})

test('期限と次の基準日は決して同じ日にならない（2つの履行期間が日を共有しない）', () => {
  // 2023-01-01 から 2028-12-31 まで全日を走査する（うるう年2回を含む）。
  const cur = at('2023-01-01')
  const end = at('2028-12-31')
  let checked = 0
  while (cur.getTime() <= end.getTime()) {
    const dl = fulfillmentDeadline(cur)
    const nx = nextKijunbi(cur)
    assert.notEqual(dl.getTime(), nx.getTime(), `${formatJp(cur)} で期限と次の基準日が同日`)
    // 期限の翌日が次の基準日（履行期間が隙間なく・重複なく連なる）
    const dayAfter = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate() + 1, 12, 0, 0, 0)
    assert.equal(dayAfter.getTime(), nx.getTime(), `${formatJp(cur)} で期間が連続していない`)
    // 期限は必ず基準日より後（1年間の履行期間が消えない）
    assert.ok(dl.getTime() > cur.getTime(), `${formatJp(cur)} で期限が基準日以前`)
    cur.setDate(cur.getDate() + 1)
    checked++
  }
  assert.ok(checked > 2100, `走査数 ${checked} が少なすぎる`)
})

test('うるう年 2024-02-29 起算: 満了は 2025年2月28日（民法143条2項ただし書＝その月の末日）', () => {
  const base = at('2024-02-29')
  assert.equal(formatJp(fulfillmentDeadline(base)), '2025年2月28日')
  assert.equal(formatJp(nextKijunbi(base)), '2025年3月1日')
})

test('うるう年をまたぐ通常日: 2023-03-01 起算の満了は 2024年2月29日', () => {
  // 2024年は閏年。応当日 2024-03-01 が存在するので、その前日＝2/29。
  const base = at('2023-03-01')
  assert.equal(formatJp(fulfillmentDeadline(base)), '2024年2月29日')
  assert.equal(formatJp(nextKijunbi(base)), '2024年3月1日')
})

test('2024-03-01 起算（翌年は平年）: 満了は 2025年2月28日', () => {
  const base = at('2024-03-01')
  assert.equal(formatJp(fulfillmentDeadline(base)), '2025年2月28日')
})

test('2023-02-28 起算: 満了は 2024年2月27日（応当日 2024-02-28 の前日）', () => {
  const base = at('2023-02-28')
  assert.equal(formatJp(fulfillmentDeadline(base)), '2024年2月27日')
})

test('年末年始: 2025-01-01 起算の満了は 2025年12月31日', () => {
  assert.equal(formatJp(fulfillmentDeadline(at('2025-01-01'))), '2025年12月31日')
})

test('月末31日: 2025-08-31 起算の満了は 2026年8月30日', () => {
  assert.equal(formatJp(fulfillmentDeadline(at('2025-08-31'))), '2026年8月30日')
})

test('期限日当日は「期限超過」にならない（残り0日・翌日から超過）', () => {
  const base = at('2025-04-01')
  const dl = fulfillmentDeadline(base) // 2026-03-31
  assert.equal(daysToDeadlineOn(base, dl), 0)
  const nextDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate() + 1, 12, 0, 0, 0)
  assert.equal(daysToDeadlineOn(base, nextDay), -1)
})

/** 「本日」を差し替えて残り日数を出す（Calculator と同じ式）。 */
function daysToDeadlineOn(base: Date, today: Date): number {
  const dl = fulfillmentDeadline(base)
  return Math.round((dl.getTime() - today.getTime()) / 86_400_000)
}

test('不正な日付文字列は null（既存の入力検証の前提を保つ）', () => {
  assert.equal(parseDateOnly('2025-4-1'), null)
  assert.equal(parseDateOnly(''), null)
  assert.equal(parseDateOnly('abcd-ef-gh'), null)
})
