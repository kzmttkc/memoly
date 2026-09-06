import { test } from 'node:test'
import assert from 'node:assert/strict'

// ============================================================================
// insights-source.test.ts — 「取得できなかった」を「無かった」と言わない検査
// ----------------------------------------------------------------------------
//   能動インサイト（助成金 / 法改正）は Anthropic 呼び出しが落ちると空配列を返す。
//   従来はそのとき source を 'sonnet' と自称していたため、下流（API / 画面）から
//   「調べた結果0件」と区別できず、画面が「見つかりませんでした」と断定していた。
//   労務製品として誤った事実の提示になるので、失敗は失敗として名乗らせる。
//
//   検査の対象は2つ:
//     1. lib/insights-core.ts  — 例外時の source が 'sonnet' にならない
//     2. lib/insights-fallback.ts — 空配列でも失敗由来なら 'empty' と判定しない
//        （画面の「見つかりませんでした」の出し分けは、この純関数1点に集約する）
// ============================================================================

// Anthropic SDK のコンストラクタは apiKey 未設定で throw するため、import 前に置く。
process.env.ANTHROPIC_API_KEY ??= 'test-key-not-used'

const { anthropic } = await import('../../lib/claude.ts')
const { loadSubsidies, loadLawChanges } = await import('../../lib/insights-core.ts')
const { insightsSectionState, INSIGHTS_UNAVAILABLE_NOTICE } = await import(
  '../../lib/insights-fallback.ts'
)

type Create = typeof anthropic.messages.create
const realCreate = anthropic.messages.create.bind(anthropic.messages) as Create

/** モデル呼び出しを必ず失敗させる（Anthropic 障害の再現）。 */
function stubThrows() {
  anthropic.messages.create = (async () => {
    throw new Error('Anthropic is down (test stub)')
  }) as unknown as Create
}

/** モデルが指定の本文を返す（正常系の再現）。 */
function stubReturns(text: string) {
  anthropic.messages.create = (async () => ({
    content: [{ type: 'text', text }],
  })) as unknown as Create
}

function restore() {
  anthropic.messages.create = realCreate
}

test('助成金: モデルが例外を投げたら source は sonnet を名乗らない', async () => {
  stubThrows()
  try {
    const r = await loadSubsidies('テスト株式会社', [], 'company-1')
    assert.deepEqual(r.subsidies, [])
    assert.notEqual(r.source, 'sonnet', '失敗なのに sonnet を自称してはいけない')
    assert.equal(r.source, 'unavailable')
  } finally {
    restore()
  }
})

test('法改正: モデルが例外を投げたら source は unavailable', async () => {
  stubThrows()
  try {
    const r = await loadLawChanges('テスト株式会社', [])
    assert.deepEqual(r.lawChanges, [])
    assert.notEqual(r.source, 'sonnet')
    assert.equal(r.source, 'unavailable')
  } finally {
    restore()
  }
})

test('助成金: 本当に0件で返ったときは sonnet のまま（失敗と区別できる）', async () => {
  stubReturns('{"subsidies": []}')
  try {
    const r = await loadSubsidies('テスト株式会社', [], 'company-1')
    assert.deepEqual(r.subsidies, [])
    assert.equal(r.source, 'sonnet')
  } finally {
    restore()
  }
})

test('法改正: 本当に0件で返ったときは sonnet のまま', async () => {
  stubReturns('{"lawChanges": []}')
  try {
    const r = await loadLawChanges('テスト株式会社', [])
    assert.deepEqual(r.lawChanges, [])
    assert.equal(r.source, 'sonnet')
  } finally {
    restore()
  }
})

test('画面の出し分け: 失敗由来の空配列は empty にしない（見つかりませんでした を出さない）', () => {
  assert.equal(insightsSectionState('unavailable', 0), 'unavailable')
  assert.notEqual(insightsSectionState('unavailable', 0), 'empty')
})

test('画面の出し分け: 本当に0件のときだけ empty', () => {
  assert.equal(insightsSectionState('sonnet', 0), 'empty')
  assert.equal(insightsSectionState('sonnet', 2), 'ok')
  assert.equal(insightsSectionState('dify', 0), 'empty')
})

test('開示文言: 「該当なし」と読めない文言で、断定していない', () => {
  assert.ok(INSIGHTS_UNAVAILABLE_NOTICE.title.length > 0)
  assert.ok(INSIGHTS_UNAVAILABLE_NOTICE.body.length > 0)
  // 失敗時に「見つかりませんでした」と読める文言を混ぜない。
  assert.ok(!INSIGHTS_UNAVAILABLE_NOTICE.title.includes('見つかりません'))
  assert.ok(!INSIGHTS_UNAVAILABLE_NOTICE.body.includes('見つかりません'))
})
