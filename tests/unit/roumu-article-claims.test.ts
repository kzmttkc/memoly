// 生成記事（lib/usecase-auto.json）の法的な断定を、本番へ出る前に止める。
//
// なぜ（2026-09-06 実測）:
//   /roumu の記事は LLM が書き、この JSON に入って SSG で本番へ出る。
//   本番の3記事に「カスハラ対策は事業主の努力義務」が生きていた。読者は
//   「やらなくてもいい」と受け取る。労務の情報を出す製品として、出してはいけない誤りの筆頭。
//   Takeshi_Automation 側に検査器（scripts/kasuhara_claim_check.py）はあったが、
//   検査対象が site/*.html だけで、この JSON を一度も見ていなかった。
//   あちらは sharoushi のデプロイ時にしか走らない。**このリポは git push で本番へ出る**ので、
//   同じ規律をこちら側にも置く。
//
// 正典: 改正労働施策総合推進法（令和7年法律第63号）による**措置義務**・2026年10月1日施行。
//   直接の刑事罰は無く、是正指導・勧告・企業名公表の行政措置による（lib/kasuhara/measures.ts）。
//   東京都カスタマーハラスメント防止条例の施行は 2025年4月1日。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAW = readFileSync(join(process.cwd(), 'lib/usecase-auto.json'), 'utf8')

/** カスハラの話をしている文だけを見る（育児介護等の本当の努力義務を巻き込まない）。 */
const IN_SCOPE = /カスハラ|カスタマーハラスメント|顧客等/

/** 違反にしない文:
 *  - 正しく否定しているもの（「努力義務ではありません」）
 *  - 33条3項の協力の努力義務（取引先からの事実確認への協力）
 *  - 設問（FAQ の q）。誤解そのものを問う形は正しく、直後の回答が否定する。
 *    2026-09-06: これを明示していなかったため、FAQ の設問を通したのは偶然だった。 */
const ALLOWED = /努力義務では(?:ありません|ない|なく)|取引先|[？?]\s*$/

const FORBIDDEN: Array<[RegExp, string]> = [
  [/努力義務/, 'カスハラ対策は措置義務。努力義務ではない'],
  [/(直接)?義務付ける法律は(まだ)?(ありません|ない)/, '2026-10-01 から措置義務がある'],
  [/義務ではありません|義務化されていません|法的義務では(ない|ありません)/, '措置義務である'],
  [/罰則付きの強制義務では(ありません|ない)/, '措置義務であり、是正指導・勧告・企業名公表の対象'],
]

function sentences(text: string): string[] {
  return text.split(/(?<=。)|\n/).map(s => s.trim()).filter(Boolean)
}

test('生成記事: カスハラの義務について誤った断定をしていない', () => {
  const bad: string[] = []
  for (const s of sentences(RAW)) {
    if (!IN_SCOPE.test(s) || ALLOWED.test(s)) continue
    for (const [re, why] of FORBIDDEN) {
      if (re.test(s)) bad.push(`${why} ← ${s.slice(0, 120)}`)
    }
  }
  assert.deepEqual(bad, [], `誤った断定 ${bad.length} 件:\n` + bad.join('\n'))
})

test('生成記事: 東京都条例の施行日を間違えていない（正: 2025年4月1日）', () => {
  const bad: string[] = []
  for (const s of sentences(RAW)) {
    if (!/東京都/.test(s) || !/条例/.test(s) || !/施行|成立/.test(s)) continue
    // 「条例」の近くにある年月だけを見る。同じ文に国の施行日（2026年10月1日）が
    // 並んでいることがあり、文全体を見ると正しい記述を誤検知する（2026-09-06 実測）。
    for (let i = s.indexOf('条例'); i !== -1; i = s.indexOf('条例', i + 1)) {
      const near = s.slice(Math.max(0, i - 30), i + 12)
      for (const y of near.match(/20\d{2}年(?:\d{1,2}月)?/g) ?? []) {
        if (y !== '2025年4月' && y !== '2025年') bad.push(`${y} ← ${s.slice(0, 110)}`)
      }
    }
  }
  assert.deepEqual(bad, [], `施行日の誤り ${bad.length} 件:\n` + bad.join('\n'))
})

test('検査器そのものが本物の誤りを捕まえる（取り逃がしたら検査器が壊れている）', () => {
  const known = [
    '2024年11月の労働施策総合推進法改正により、カスハラ対策は事業主の努力義務となりました。',
    '現時点（2025年時点）では、カスハラ対策の就業規則記載を直接義務付ける法律はありません。',
    '現時点では罰則付きの強制義務ではありませんが、カスハラ規定は整えておくべきです。',
  ]
  for (const s of known) {
    assert.ok(IN_SCOPE.test(s) && !ALLOWED.test(s) && FORBIDDEN.some(([re]) => re.test(s)),
      '取り逃がした: ' + s)
  }
  // 正しい記述は素通りさせる
  for (const ok of [
    'カスハラ対策は努力義務ではありません。2026年10月1日から措置義務です。',
    '取引先の事業主から事実確認への協力を求められたときは、これに応じる努力義務があります。',
  ]) {
    assert.ok(!FORBIDDEN.some(([re]) => re.test(ok)) || ALLOWED.test(ok), '誤検知: ' + ok)
  }
})
