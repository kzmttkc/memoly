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
