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

// ============================================================================
// 2026-08-12 機能品質監査（中）: LLM失敗のフォールバックが利用者に開示されていなかった。
//   /api/company/risk-audit は失敗時に決定的スコアへ落として fallback:true を返すが、
//   画面はそれを Plausible の計測プロパティにしか渡しておらず、利用者は
//   「AIが読んだ結果」と「ルールベースの結果」を区別できなかった。
//   本日この会社で確立した方針（サンプル結果の明示・「まだ測っていない」の明示）に揃え、
//   画面へ開示する。ここでは出所判定の純関数と、画面が実際にその開示を描画していることを
//   固定する（旧実装＝計測にしか渡さない版に当てると落ちる）。
// ============================================================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { riskResultOrigin, RISK_FALLBACK_NOTICE } from '../../lib/risk-fallback.ts'

test('出所判定: LLM成功は ai、失敗フォールバックは fallback', () => {
  assert.equal(riskResultOrigin({ sampleMode: false, provisional: false, fallback: false }), 'ai')
  assert.equal(riskResultOrigin({ sampleMode: false, provisional: false }), 'ai')
  assert.equal(riskResultOrigin({ sampleMode: false, provisional: false, fallback: true }), 'fallback')
})

test('出所判定: サンプル・速報は自前の開示を持つので fallback を名乗らせない', () => {
  // サンプル会社モードは「架空のサンプル会社の結果です」を常時出す経路。
  assert.equal(riskResultOrigin({ sampleMode: true, provisional: false, fallback: true }), 'sample')
  // 速報（provisional）は「まず自動計算の速報を表示しています」を出す経路。
  assert.equal(riskResultOrigin({ sampleMode: false, provisional: true, fallback: true }), 'provisional')
  // 同時に立った場合の優先はサンプル（架空データである事実が最も重い）。
  assert.equal(riskResultOrigin({ sampleMode: true, provisional: true }), 'sample')
})

test('開示文: 事実表示のみ。資格・監修・登録状態には触れない（2026-08-12裁定）', () => {
  const text = `${RISK_FALLBACK_NOTICE.title}${RISK_FALLBACK_NOTICE.body}`
  assert.ok(RISK_FALLBACK_NOTICE.title.length > 0)
  assert.ok(RISK_FALLBACK_NOTICE.body.length > 0)
  for (const ng of ['社労士', '監修', '有資格', '登録番号', '絶対', '皆さん', '——']) {
    assert.ok(!text.includes(ng), `開示文に禁止語「${ng}」が含まれている`)
  }
  // 「AIが読んだ結果」ではないことが分かる語（既存の「自動計算」語彙）を使う。
  assert.ok(text.includes('自動計算'), '既存のフォールバック開示語彙「自動計算」を使うこと')
})

test('画面がフォールバックを描画している（計測プロパティ止まりにしない）', () => {
  const src = readFileSync(
    join(import.meta.dirname, '..', '..', 'app', '(app)', 'company', 'risk', 'page.tsx'),
    'utf8',
  )
  // 出所判定を画面が使っていること
  assert.ok(src.includes('riskResultOrigin'), 'risk/page.tsx が riskResultOrigin を使っていない')
  // 開示文が JSX に描画されていること（import しただけ・計測に渡しただけでは通さない）
  assert.ok(
    src.includes('{RISK_FALLBACK_NOTICE.title}') && src.includes('{RISK_FALLBACK_NOTICE.body}'),
    'risk/page.tsx が RISK_FALLBACK_NOTICE を画面へ描画していない',
  )
  // API の fallback フラグが結果オブジェクトの型に載っていること（描画分岐の入力）
  assert.ok(/fallback\?: boolean/.test(src), 'RiskResult に fallback が無い＝描画に届かない')
})
