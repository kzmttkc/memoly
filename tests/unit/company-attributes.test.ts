import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeAttributes,
  triToBool,
  boolToTri,
} from '../../lib/company-attributes.ts'

// sanitizeAttributes は DB の CHECK 制約と1対1。想定外値は null/false に丸める。
test('sanitizeAttributes: 正当な値はそのまま通す', () => {
  const out = sanitizeAttributes({
    industry_major: 'E',
    employee_band: '10-29',
    has_36kyotei: true,
    has_work_rules: false,
    has_fixed_ot: null,
    benchmark_optout: true,
  })
  assert.equal(out.industry_major, 'E')
  assert.equal(out.employee_band, '10-29')
  assert.equal(out.has_36kyotei, true)
  assert.equal(out.has_work_rules, false)
  assert.equal(out.has_fixed_ot, null)
  assert.equal(out.benchmark_optout, true)
})

test('sanitizeAttributes: 不正な industry/band は null に丸める', () => {
  const out = sanitizeAttributes({
    industry_major: 'ZZ',
    employee_band: '999',
  })
  assert.equal(out.industry_major, null)
  assert.equal(out.employee_band, null)
  // 三値は未指定なら null（false と取り違えない）
  assert.equal(out.has_36kyotei, null)
  assert.equal(out.benchmark_optout, false)
})

test('sanitizeAttributes: 三値は true/false 以外すべて null', () => {
  // @ts-expect-error 実行時の異常値（文字列）を渡して null に丸まることを確認
  const out = sanitizeAttributes({ has_36kyotei: 'yes', has_work_rules: 1, has_fixed_ot: 0 })
  assert.equal(out.has_36kyotei, null)
  assert.equal(out.has_work_rules, null)
  assert.equal(out.has_fixed_ot, null)
})

test('triToBool / boolToTri は往復整合する', () => {
  assert.equal(triToBool('yes'), true)
  assert.equal(triToBool('no'), false)
  assert.equal(triToBool('unknown'), null)
  assert.equal(boolToTri(true), 'yes')
  assert.equal(boolToTri(false), 'no')
  assert.equal(boolToTri(null), 'unknown')
  assert.equal(boolToTri(undefined), 'unknown')
})
