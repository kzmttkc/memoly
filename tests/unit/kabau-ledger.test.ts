import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseKabauLedger, formatKabauFactsBlock } from '../../lib/kabau-ledger.ts'

test('不正な JSON は空配列', () => {
  assert.deepEqual(parseKabauLedger('not json'), [])
  assert.deepEqual(parseKabauLedger('{}'), [])
  assert.deepEqual(parseKabauLedger(JSON.stringify({ facts: [{ key: 'x' }] })), [])
})

test('確定行だけ残す', () => {
  const facts = parseKabauLedger(
    JSON.stringify({
      facts: [
        {
          key: 'kasuhara_start',
          value: '2026-10-01',
          retrieved_on: '2026-08-20',
          source_url: 'https://www.mhlw.go.jp/example',
          status: '確定',
        },
        {
          key: 'pending',
          value: '未定',
          retrieved_on: '2026-08-20',
          source_url: 'https://www.mhlw.go.jp/example',
          status: '予定',
        },
      ],
    }),
  )
  assert.equal(facts.length, 1)
  assert.equal(facts[0].key, 'kasuhara_start')
})

test('ブロックは確認日つき。空なら空文字', () => {
  assert.equal(formatKabauFactsBlock([]), '')
  const block = formatKabauFactsBlock([
    {
      key: 'kasuhara_start',
      value: '2026-10-01',
      retrieved_on: '2026-08-20',
      source_url: 'https://www.mhlw.go.jp/example',
      source_name: '厚生労働省',
      status: '確定',
    },
  ])
  assert.match(block, /Kabau公開台帳/)
  assert.match(block, /2026-08-20/)
  assert.match(block, /2026-10-01/)
})
