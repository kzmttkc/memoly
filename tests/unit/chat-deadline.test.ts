// チャットの締切が「自分で切る < プラットフォームに殺される」の順序を保つ（2026-07-30 可用性監査#9）。
//
// なぜ機械で縛るか:
//   lib/claude.ts に 60秒の締切を入れても、Vercel の関数上限がそれより短ければ
//   関数ごと殺され、route.ts の catch は走らない。利用者から見ると
//   **ストリームが無言で途切れる**だけで、原因も再試行の可否も分からない。
//   逆に maxRetries が効いて最長120秒になると、90秒の関数上限を越えて同じ無言死に戻る。
//
//   つまり「自分の最長 < maxDuration」が崩れた瞬間にこの機能は静かに壊れる。
//   壊れても型検査もテストも赤くならないので、ここで数値の関係そのものを縛る。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// このリポの test:unit は素の `node --test`（トランスパイル無し）なので、
// lib/ を import すると SDK ごと解決に行って落ちる。他のテストと同じくソースを読む。
function read(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
}

const route = read('app/api/company/chat/route.ts')
const claudeLib = read('lib/claude.ts')

function maxDurationSeconds(): number {
  const m = route.match(/export const maxDuration\s*=\s*(\d+)/)
  assert.ok(m, 'app/api/company/chat/route.ts に export const maxDuration が無い')
  return Number(m[1])
}

function ownDeadlineSeconds(): number {
  const m = claudeLib.match(/CLAUDE_TIMEOUT_MS\s*=\s*([\d_]+)/)
  assert.ok(m, 'lib/claude.ts に CLAUDE_TIMEOUT_MS が無い')
  return Number(m[1].replace(/_/g, '')) / 1000
}

test('関数の実行上限が、自分で切る締切より長い', () => {
  const ownDeadlineSec = ownDeadlineSeconds()
  assert.ok(
    maxDurationSeconds() > ownDeadlineSec,
    `maxDuration(${maxDurationSeconds()}秒) が自分の締切(${ownDeadlineSec}秒)以下。` +
      'プラットフォームに先に殺され、利用者にはストリームが無言で途切れる',
  )
})

test('チャットのストリームはリトライしない（最長が maxDuration を超えない）', () => {
  assert.match(
    route,
    /\{\s*maxRetries:\s*0\s*\}/,
    'anthropic.messages.stream に maxRetries: 0 の上書きが無い。' +
      'lib/claude.ts の既定(1)が効くと最長が倍になり、maxDuration を越えて無言死に戻る',
  )
})

test('締切超過を、その他の障害と書き分けて利用者に返す', () => {
  assert.match(
    route,
    /APIConnectionTimeoutError/,
    '締切超過を判別していない。一律「エラーが発生しました」だと、' +
      '利用者は待てば直るのか質問が悪いのか分からず、同じ質問で同じ60秒を溶かす',
  )
  assert.match(route, /時間内に回答を作れませんでした/)
})
