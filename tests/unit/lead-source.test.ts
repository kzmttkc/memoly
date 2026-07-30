// 獲得経路が「どこから来たか分からない」に戻らないようにする（2026-07-30 PMF監査）。
//
// 経緯: 索引される42ページ（記事33本・ツール6本）にメール獲得が1つも無く、
// company_leads は0行だった。配線自体は健全で（PDFは200・anon INSERT ポリシーあり）、
// 置き場所が /business の1箇所だけだったのが原因。記事末尾とツールの結果直後に
// 同じ LeadCapture を差し込んだ。
//
// このとき踏みやすい罠が1つある: /api/company/leads は許可リストに無い source を
// **黙って 'unknown' に丸める**。クライアント側だけ 'article_dl' を送っても、
// エラーにならないまま経路が消える。置き場所を増やした意味が無くなるので、
// 両側が一致していることを機械で縛る。
//
// DB側は supabase/company_leads.sql:47-48 の CHECK が char_length 1..64 のみで
// 値の許可リストを持たない（実測）。つまり制約はAPI側の1箇所だけ。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function read(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
}

const route = read('app/api/company/leads/route.ts')
const capture = read('app/business/_components/LeadCapture.tsx')

/** LeadCapture が送る source の集合（面ごと）。 */
function sourcesSentByClient(): string[] {
  const block = capture.slice(
    capture.indexOf('const SOURCE_BY_PLACEMENT'),
    capture.indexOf('}', capture.indexOf('const SOURCE_BY_PLACEMENT'))
  )
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

/** API が受理する source の集合。 */
function sourcesAllowedByApi(): string[] {
  const block = route.slice(
    route.indexOf('const ALLOWED_SOURCES'),
    route.indexOf('])', route.indexOf('const ALLOWED_SOURCES'))
  )
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

test('LeadCapture が送る source を API が全部受理する（unknown に丸められない）', () => {
  const sent = sourcesSentByClient()
  const allowed = new Set(sourcesAllowedByApi())
  assert.ok(sent.length >= 3, `面ごとの source が足りない: ${JSON.stringify(sent)}`)
  const dropped = sent.filter((s) => !allowed.has(s))
  assert.deepEqual(
    dropped,
    [],
    `API の ALLOWED_SOURCES に無い source を送っている（'unknown' に丸められ、経路が永久に分からなくなる）: ${dropped.join(', ')}`
  )
})

test('面ごとに違う source を送っている（1つに潰れていない）', () => {
  const sent = sourcesSentByClient()
  assert.equal(
    new Set(sent).size,
    sent.length,
    `同じ source を複数の面で使っている。どのページが効いたか分からない: ${JSON.stringify(sent)}`
  )
})

test('許可リストに無い値は unknown に丸める仕様が残っている', () => {
  // これはリードを落とさないための安全弁。消すと未知の source で400になり、
  // 獲得そのものを失う（丸めるのが正しく、丸められたことに気づける形にするのが上のテスト）。
  assert.match(route, /ALLOWED_SOURCES\.has\(rawSource\)\s*\?\s*rawSource\s*:\s*'unknown'/)
})

test('DB側は値の許可リストを持たない（制約はAPIの1箇所だけ）', () => {
  // 2箇所に許可リストがあると、片方だけ足したときに 400 でリードを落とす。
  // 実測で CHECK は長さのみ。ここが変わったらこのテストで気づく。
  const sql = read('supabase/company_leads.sql')
  assert.match(sql, /CHECK \(char_length\(source\) BETWEEN 1 AND 64\)/)
  assert.doesNotMatch(
    sql,
    /source[^\n]*CHECK[^\n]*IN \(/,
    'DB側にも値の許可リストができている（APIと二重管理になり、片方だけ足すとリードを落とす）'
  )
})
