import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeFallbackRiskAudit,
  type RiskFallbackAttributes,
} from '../../lib/risk-fallback.ts'

const EMPTY: RiskFallbackAttributes = {
  industry_major: null,
  employee_band: null,
  has_36kyotei: null,
  has_work_rules: null,
  has_fixed_ot: null,
}

test('全 null（未回答）: 6カテゴリを返し、中庸スコアで極端に低くしない', () => {
  const r = computeFallbackRiskAudit(EMPTY)
  assert.equal(r.categories.length, 6)
  assert.ok(r.score >= 50, `score=${r.score} は中庸以上のはず`)
  assert.ok(['おおむね良好', '改善の余地あり', '要注意'].includes(r.level))
  // 情報不足では high 指摘は生まれない
  assert.equal(r.topRisks.filter(x => x.severity === 'high').length, 0)
})

test('36協定なし: 労働時間カテゴリが下がり high 指摘が入る', () => {
  const r = computeFallbackRiskAudit({ ...EMPTY, has_36kyotei: false })
  const hours = r.categories.find(c => c.name === '労働時間')
  assert.ok(hours && hours.score <= 40, `hours=${hours?.score}`)
  assert.ok(r.topRisks.some(x => x.severity === 'high' && x.title.includes('36協定')))
})

test('10人以上で就業規則なし: 就業規則カテゴリ大幅減点＋high', () => {
  const r = computeFallbackRiskAudit({
    ...EMPTY,
    employee_band: '30-49',
    has_work_rules: false,
  })
  const rules = r.categories.find(c => c.name === '就業規則')
  assert.ok(rules && rules.score <= 35, `rules=${rules?.score}`)
  assert.ok(r.topRisks.some(x => x.severity === 'high' && x.title.includes('就業規則')))
})

test('10人未満で就業規則なし: medium どまり（high にしない）', () => {
  const r = computeFallbackRiskAudit({
    ...EMPTY,
    employee_band: '5-9',
    has_work_rules: false,
  })
  const rulesRisk = r.topRisks.find(x => x.title.includes('就業規則'))
  assert.ok(rulesRisk)
  assert.notEqual(rulesRisk?.severity, 'high')
})

test('スコアは常に 0..100 に収まり、TOP指摘は最大3件', () => {
  const r = computeFallbackRiskAudit({
    industry_major: 'M',
    employee_band: '50-99',
    has_36kyotei: false,
    has_work_rules: false,
    has_fixed_ot: true,
  })
  assert.ok(r.score >= 0 && r.score <= 100)
  for (const c of r.categories) assert.ok(c.score >= 0 && c.score <= 100)
  assert.ok(r.topRisks.length <= 3)
  // high 指摘（36協定・就業規則）が severity 順で先頭に来る
  assert.equal(r.topRisks[0]?.severity, 'high')
})

test('良好側（すべて整備済）: スコアが上がり high 指摘ゼロ', () => {
  const r = computeFallbackRiskAudit({
    industry_major: 'G',
    employee_band: '10-29',
    has_36kyotei: true,
    has_work_rules: true,
    has_fixed_ot: false,
  })
  // 判定可能な3カテゴリは良好、残り3カテゴリは中庸(60)のため総合は 65 前後になる。
  assert.ok(r.score >= 65, `score=${r.score}`)
  assert.equal(r.topRisks.filter(x => x.severity === 'high').length, 0)
  // 情報が揃っているぶん、未回答時より高いこと
  assert.ok(r.score > computeFallbackRiskAudit(EMPTY).score)
})
