import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRecalledMemory, serializeRecalledMemory } from '../../lib/recall.ts'
import type { CompanyContext, CompanyRuleExcerpt } from '../../lib/company.ts'

function ctx(over: Partial<CompanyContext> = {}): CompanyContext {
  return {
    profiles: [],
    memories: [],
    decisions: [],
    peopleSituations: [],
    ...over,
  }
}

test('空コンテキスト: 件数ゼロ・serialize は null（ヘッダを付けない）', () => {
  const r = buildRecalledMemory(ctx(), [], false)
  assert.equal(r.profileCount, 0)
  assert.equal(r.items.length, 0)
  assert.equal(serializeRecalledMemory(r), null)
})

test('profiles/decisions/rules をラベル化し、非PIIのみ載せる（subject は載せない）', () => {
  const excerpts: CompanyRuleExcerpt[] = [
    { title: '就業規則', excerpt: '第1条...' },
    { title: '就業規則', excerpt: '第2条...' }, // 同一出典は1つに畳む
    { title: '育児介護休業規程', excerpt: '...' },
  ]
  const r = buildRecalledMemory(
    ctx({
      profiles: [{ key: '所定労働時間', value: '8h' }],
      memories: ['相談の要約1', '相談の要約2'],
      decisions: [
        { summary: '氏名を含む本文', topic: '育休', subject: 'Aさん', decidedAt: '2026-01-15T00:00:00Z' },
      ],
    }),
    excerpts,
    true,
  )
  assert.equal(r.profileCount, 1)
  assert.equal(r.memoryCount, 2)
  assert.equal(r.decisionCount, 1)
  assert.equal(r.ruleDocCount, 2) // 就業規則(重複畳み) + 育児介護休業規程
  assert.equal(r.semantic, true)

  // ラベルに subject（氏名等）や判断本文が漏れていないこと
  const labels = r.items.map(i => i.label)
  assert.ok(labels.includes('所定労働時間'))
  assert.ok(labels.includes('就業規則'))
  assert.ok(labels.includes('育休'))
  assert.ok(!labels.some(l => l.includes('Aさん')))
  assert.ok(!labels.some(l => l.includes('氏名を含む本文')))
})

test('serialize は URL エンコード済みJSONを返し、丸められる', () => {
  const r = buildRecalledMemory(ctx({ profiles: [{ key: 'k', value: 'v' }] }), [], false)
  const s = serializeRecalledMemory(r)
  assert.ok(typeof s === 'string')
  const back = JSON.parse(decodeURIComponent(s as string))
  assert.equal(back.profileCount, 1)
})
