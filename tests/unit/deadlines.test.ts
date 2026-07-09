import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestDeadlines } from '../../lib/deadlines.ts'
import type { CompanyAttributesValues } from '../../lib/company.ts'

const EMPTY: CompanyAttributesValues = {
  industry_major: null,
  employee_band: null,
  has_36kyotei: null,
  has_work_rules: null,
  has_fixed_ot: null,
}

const titles = (attrs: CompanyAttributesValues) => suggestDeadlines(attrs).map(d => d.title)

test('全 null: 常時該当の年次期限のみ（3件）', () => {
  const t = titles(EMPTY)
  assert.deepEqual(t, ['労働保険の年度更新', '算定基礎届', '年末調整'])
})

test('36協定あり: 36協定の更新が加わる', () => {
  const t = titles({ ...EMPTY, has_36kyotei: true })
  assert.ok(t.includes('36協定の更新'))
})

test('50人以上: 定期健康診断＋ストレスチェックが加わる', () => {
  const t = titles({ ...EMPTY, employee_band: '50-99' })
  assert.ok(t.includes('定期健康診断'))
  assert.ok(t.includes('ストレスチェックの実施'))
})

test('1-4人: 定期健康診断は出さない（常時使用の労働者を想定しない）', () => {
  const t = titles({ ...EMPTY, employee_band: '1-4' })
  assert.ok(!t.includes('定期健康診断'))
  assert.ok(!t.includes('ストレスチェックの実施'))
})

test('就業規則が false（無い）: 届出の目安を単発で出す。null では出さない', () => {
  assert.ok(titles({ ...EMPTY, has_work_rules: false }).includes('就業規則の届出'))
  assert.ok(!titles({ ...EMPTY, has_work_rules: null }).includes('就業規則の届出'))
})

test('候補は due_on（具体日）を持たない（system は日付を断定しない）', () => {
  for (const s of suggestDeadlines({ ...EMPTY, has_36kyotei: true, employee_band: '100+' })) {
    assert.ok(!('due_on' in s))
    assert.ok(typeof s.timingLabel === 'string' && s.timingLabel.length > 0)
    assert.ok(s.recurrence === 'yearly' || s.recurrence === 'none')
  }
})
