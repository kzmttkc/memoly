import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BUSINESS_ADDRESS } from '../../lib/brand.ts'
import { PLANS } from '../../lib/plans.ts'

// ============================================================================
// tokushoho-address.test.ts — 買い手が会社に出す紙（2026-09-06 Takeshi 決裁）の関門。
//   1. 特商法の所在地欄が BUSINESS_ADDRESS を常時表示し、住所の欄に請求開示の文言が残らない
//   2. BUSINESS_ADDRESS が正典 business-facts.md の値と一致する（正典が手元にある環境だけ）
//   3. 料金カードの Entry / Standard に「規程N本まで」が plans.ts の documentCap から出る
// ============================================================================

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

test('特商法: 所在地の行が BUSINESS_ADDRESS を出し、請求開示の文言を含まない', () => {
  const src = read('app/tokushoho/page.tsx')
  const m = src.match(/<Row label="所在地">([\s\S]*?)<\/Row>/)
  assert.ok(m, '所在地だけの Row が無い（電話番号と束ねたまま）')
  assert.ok(m[1].includes('{BUSINESS_ADDRESS}'), '所在地の Row が BUSINESS_ADDRESS を参照していない')
  assert.ok(!/請求/.test(m[1]), '所在地の Row に請求開示の文言が残っている')
  assert.ok(!src.includes('label="所在地・電話番号"'), '旧「所在地・電話番号」行が残っている')
})

test('BUSINESS_ADDRESS は正典 business-facts.md の所在地と一致する', (t) => {
  const canon = join(homedir(), 'Takeshi_Automation/.company/steering/business-facts.md')
  if (!existsSync(canon)) return t.skip('正典が無い環境（CI）')
  const line = readFileSync(canon, 'utf8').split('\n').find(l => l.includes('所在地（対外表示）'))
  assert.ok(line, '正典に「所在地（対外表示）」の行が無い')
  const value = line.match(/\*\*(東京都[^*]+)\*\*/)?.[1]
  assert.equal(BUSINESS_ADDRESS, value)
})

test('料金カード: Entry / Standard の単位表記に規程の本数上限が入る', () => {
  const src = read('app/pricing/_lib/plan-copy.ts')
  for (const id of ['starter', 'standard'] as const) {
    assert.equal(typeof PLANS[id].documentCap, 'number', `${id} の documentCap が数値でない`)
    assert.ok(
      src.includes(`規程\${PLANS.${id}.documentCap}本まで`),
      `${id} の unit に規程本数が無い`,
    )
  }
})
