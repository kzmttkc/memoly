import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeBlock, enforceTaxonomy } from '../../lib/gap-engine/engine/validateSheet.ts'
import { DISCLAIMER } from '../../lib/gap-engine/taxonomy/items.ts'
import { heuristicGapSheet } from '../../lib/gap-engine/fallback.ts'
import type { GapBlock, GapSheet } from '../../lib/gap-engine/engine/types.ts'

test('sanitizeBlock drops written without real quote', () => {
  const source = '始業は午前9時とする。'
  const block: GapBlock = {
    id: 'kasuhara.policy',
    group: 'kasuhara_2026_10',
    title: 'カスタマーハラスメントの方針',
    status: 'written',
    priority: 'p0_deadline',
    what_found: '捏造',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [{ quote: 'この引用は本文にない' }],
  }
  const out = sanitizeBlock(source, block)
  assert.equal(out.status, 'unmentioned')
  assert.equal(out.citations.length, 0)
})

test('heuristicGapSheet never claims written without quote', () => {
  const sheet = heuristicGapSheet({
    text: '第1条 始業は午前9時、終業は午後6時とする。年次有給休暇を与える。',
    titleGuess: 'thin.txt',
  })
  assert.equal(sheet.disclaimer, DISCLAIMER)
  const hours = sheet.blocks.find(b => b.id === 'abs.hours_start_end')
  assert.ok(hours)
  if (hours!.status === 'written') {
    assert.ok((hours!.citations?.length ?? 0) > 0)
  }
  const kasu = sheet.blocks.find(b => b.id === 'kasuhara.policy')
  assert.equal(kasu?.status, 'unmentioned')
})

test('enforceTaxonomy fills missing taxonomy ids', () => {
  const source = '始業は午前9時とする。'
  const thin: GapSheet = {
    schema_version: 'x',
    disclaimer: '',
    document: {
      title_guess: 'x',
      page_count: 1,
      pages_read: 1,
      pages_unread: [],
      char_count: source.length,
      extracted_ok: true,
    },
    summary: {
      headline: '',
      written_count: 0,
      ops_missing_count: 0,
      unmentioned_count: 0,
      unread_note: null,
    },
    blocks: [],
    contradictions: [],
    followups: [],
  }
  const out = enforceTaxonomy(thin, source)
  assert.ok(out.blocks.length > 10)
  assert.ok(out.blocks.some(b => b.id === 'kasuhara.policy'))
})

// ============================================================================
// 2026-08-31: 同じ型の欠陥が1日で3件出た——「プロンプトが契約を書いていないので、
// モデルが別名で返し、下流が黙って捨てる」。捨てられた側は画面上
// 「このファイルでは触れていない」になるため、**壊れて見えない**のが最悪だった。
//   1件目 status: written を定義しておらず "found" が返る
//   2件目 出力スキーマ自体が無く、根拠が citations でなく quote で返る
//   3件目 逐語引用に「（第2条）」が付いて本文と一致しない
// プロンプト側は直したが、モデルを変えれば同じ形で再発しうる。
// 受け止める側をここで固定する。
// ============================================================================
test('モデルが別名・出典付きで返しても、正しい引用を捨てない', () => {
  const source = '第2条 始業は午前9時、終業は午後6時とする。'
  const drifted = {
    id: 'abs.hours_start_end',
    title: '始業・終業の時刻',
    group: 'absolute_lsa89',
    priority: 'p1_absolute',
    status: 'found',                                        // written の別名
    quote: '始業は午前9時、終業は午後6時とする。（第2条）',   // citations でなく quote・出典付き
    note: '始業・終業の時刻が明記されています。',              // what_found でなく note
    what_found: '',
    what_not_found: '',
    why_it_matters: '',
    next_step: '',
    citations: [],
  } as never

  const out = sanitizeBlock(source, drifted)
  assert.equal(out.status, 'written', 'status の別名 found を written として受け止める')
  assert.equal(out.citations.length, 1, 'quote に入った根拠を citations として拾う')
  assert.ok(out.what_found, 'note に入った要約を what_found として拾う')
})

test('本文に無い引用は、別名で来ても通さない', () => {
  const fabricated = {
    id: 'abs.break', title: '休憩時間', group: 'absolute_lsa89', priority: 'p1_absolute',
    status: 'found', quote: '休憩は3時間とする。', what_found: '', what_not_found: '',
    why_it_matters: '', next_step: '', citations: [],
  } as never
  const out = sanitizeBlock('第3条 休憩は正午から1時間とする。', fabricated)
  assert.equal(out.status, 'unmentioned', '捏造引用は written にしない')
  assert.equal(out.citations.length, 0)
})
