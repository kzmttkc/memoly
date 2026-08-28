import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildZureSheet } from '../../lib/zure-sheet.ts'
import {
  ZURE_SAMPLE_TEXT,
  ZURE_SAMPLE_FILENAME,
  isZureSampleFilename,
} from '../../lib/zure-sample.ts'

test('サンプル本文は有給・残業を検知し、カスハラは触れていない行になる', () => {
  const sheet = buildZureSheet({
    filename: ZURE_SAMPLE_FILENAME,
    text: ZURE_SAMPLE_TEXT,
    unreadNote: null,
  })
  assert.match(sheet.title, /サンプル/)
  const topics = sheet.rows.map(r => r.topic)
  assert.ok(topics.some(t => /有給/.test(t)))
  assert.ok(topics.some(t => /時間外|残業/.test(t)))
  assert.ok(sheet.rows.some(r => r.kind === 'absent' && /カスタマーハラスメント/.test(r.detail)))
})

test('サンプルファイル名の判定', () => {
  assert.equal(isZureSampleFilename('sample-rules.txt'), true)
  assert.equal(isZureSampleFilename('pasted.txt'), false)
})
