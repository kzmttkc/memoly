import test from 'node:test'
import assert from 'node:assert/strict'
import { KASUHARA_MEASURES, normalizeVerdicts } from '../../lib/kasuhara/measures.ts'
import { buildPolicyDraft } from '../../lib/kasuhara/policy.ts'

// ============================================================================
// kasuhara-gap.test.ts — 10措置照合と規程追補案（Kabau×番頭 1本化 Phase 2）
//   静的サイト側の正典 sharoushi-agent.com/kasuhara-measures.json と n/title を
//   ここに固定して突き合わせる（外部ファイルに依存すると環境で結果が変わるため、
//   期待値をテストに埋める＝ピン留め。JSON側を変えたらこのテストも一緒に変える）。
// ============================================================================

const EXPECTED_TITLES: Record<number, string> = {
  1: '方針の明確化・周知',
  2: 'あらかじめ定めた対処の周知',
  3: '相談窓口の設置と周知',
  4: '担当者が対応できる手順',
  5: '事実確認',
  6: '被害者への配慮',
  7: '再発防止',
  8: '悪質事案への対処方針',
  9: 'プライバシー保護',
  10: '不利益取扱いの禁止',
}

test('10措置の正典: nは1〜10が一度ずつ・titleはリーフレット由来の正典と一致', () => {
  assert.equal(KASUHARA_MEASURES.length, 10)
  const ns = KASUHARA_MEASURES.map(m => m.n).sort((a, b) => a - b)
  assert.deepEqual(ns, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  for (const m of KASUHARA_MEASURES) {
    assert.equal(m.title, EXPECTED_TITLES[m.n], `措置${m.n}のtitleが正典とずれている`)
    assert.ok(m.criteria.length > 10, `措置${m.n}の判定基準が空`)
    assert.ok(m.guideHref.startsWith('https://sharoushi-agent.com/'), `措置${m.n}のガイドURLが自社ドメインでない`)
  }
})

test('正典の語り口: 努力義務と書かない・適法性の断定を書かない', () => {
  for (const m of KASUHARA_MEASURES) {
    assert.doesNotMatch(m.criteria, /努力義務/)
    assert.doesNotMatch(m.criteria, /違法|適法/)
  }
})

test('normalizeVerdicts: 10行そろった正常応答を並べ替えて返す', () => {
  const raw = {
    measures: [...Array(10)].map((_, i) => ({
      n: 10 - i, verdict: i % 2 ? 'ok' : 'missing', evidence: `第${10 - i}条`, note: 'x',
    })),
  }
  const out = normalizeVerdicts(raw)
  assert.ok(out)
  assert.equal(out.length, 10)
  assert.deepEqual(out.map(v => v.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('normalizeVerdicts: 行が欠けた・未知のverdictの応答は全体を不採用（部分的な表を出さない）', () => {
  const nine = { measures: [...Array(9)].map((_, i) => ({ n: i + 1, verdict: 'ok', evidence: '', note: '' })) }
  assert.equal(normalizeVerdicts(nine), null)
  const badVerdict = {
    measures: [...Array(10)].map((_, i) => ({ n: i + 1, verdict: i === 3 ? 'maybe' : 'ok', evidence: '', note: '' })),
  }
  assert.equal(normalizeVerdicts(badVerdict), null)
  assert.equal(normalizeVerdicts(null), null)
  assert.equal(normalizeVerdicts({}), null)
})

test('normalizeVerdicts: evidence/note は上限で刈る（LLMの長文を画面とDBへ素通しさせない）', () => {
  const raw = {
    measures: [...Array(10)].map((_, i) => ({
      n: i + 1, verdict: 'weak', evidence: 'あ'.repeat(500), note: 'い'.repeat(500),
    })),
  }
  const out = normalizeVerdicts(raw)
  assert.ok(out)
  for (const v of out) {
    assert.ok(v.evidence.length <= 120)
    assert.ok(v.note.length <= 200)
  }
})

test('規程追補案: 会社名が差し込まれ・×△の措置だけが別規程条項に載る', () => {
  const verdicts = [...Array(10)].map((_, i) => ({
    n: i + 1,
    verdict: (i + 1 === 3 || i + 1 === 9 ? 'missing' : i + 1 === 6 ? 'weak' : 'ok') as 'ok' | 'weak' | 'missing',
  }))
  const draft = buildPolicyDraft({ companyName: '株式会社テスト商店', verdicts })
  assert.match(draft, /株式会社テスト商店/)
  assert.match(draft, /措置3: 相談窓口の設置と周知/)
  assert.match(draft, /措置6: 被害者への配慮/)
  assert.match(draft, /措置9: プライバシー保護/)
  assert.doesNotMatch(draft, /措置1: 方針の明確化/)
  assert.doesNotMatch(draft, /措置10: 不利益取扱いの禁止/)
  // 本体条文（骨子）と委任条文は常に載る
  assert.match(draft, /顧客等からの著しい迷惑行為への対応/)
  assert.match(draft, /別に定めるハラスメント防止規程による/)
  // 免責（公式ひな形ではない・専門家確認）は必ず末尾に出す
  assert.match(draft, /公式ひな形でも個別の法的助言でもありません/)
  assert.match(draft, /専門家に確認のうえ/)
})

test('規程追補案: 全部○でも本体条文・確認3点・免責は出す（空の紙を渡さない）', () => {
  const verdicts = [...Array(10)].map((_, i) => ({ n: i + 1, verdict: 'ok' as const }))
  const draft = buildPolicyDraft({ companyName: '', verdicts })
  assert.match(draft, /当社/)
  assert.match(draft, /10措置すべてに対応する定めが見つかりました/)
  assert.match(draft, /貼り付け前に確認する3点/)
  assert.match(draft, /専門家に確認のうえ/)
})

test('規程追補案: 会社名は60字で刈る（画面入力の素通しを防ぐ）', () => {
  const verdicts = [...Array(10)].map((_, i) => ({ n: i + 1, verdict: 'ok' as const }))
  const draft = buildPolicyDraft({ companyName: 'あ'.repeat(200), verdicts })
  assert.doesNotMatch(draft, /あ{61}/)
})
