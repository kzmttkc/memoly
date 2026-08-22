// e-Gov法令API 実在確認ガードの実機疎通（ネットワークに出る。単体テストではない）。
//   Run: node scripts/verify_egov_citations.mjs
//   3ケース（実在する条／実在しない条／API失敗）＋ 質問→トレーラの実物を出す。
import {
  verifyArticleExists,
  buildAnswerSources,
  formatSourcesTrailer,
} from '../lib/law-citations.ts'

const cache = new Map()
const r1 = await verifyArticleExists('322AC0000000049', '32', { cache })
const r2 = await verifyArticleExists('322AC0000000049', '999', { cache })
const r3 = await verifyArticleExists('322AC0000000049', '32', {
  cache: new Map(),
  fetchImpl: (u, init) => fetch(u.replace('laws.e-gov.go.jp', 'laws.e-gov.go.jp.invalid'), init),
})
console.log(JSON.stringify({ exists_case: r1, missing_case: r2, api_failure_case: r3 }))
for (const q of [
  '36協定の上限時間を教えてください',
  'カスハラ対策で就業規則に何を書けばいいですか',
  '来月の社内イベントの案内文を考えてください',
]) {
  const s = await buildAnswerSources(q, { cache })
  console.log('\n=== Q:', q, '=> status:', s.status)
  console.log(formatSourcesTrailer(s))
}
