import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isChatAllowed, FILE_FIRST_MESSAGE, FILE_FIRST_CODE } from '../../lib/file-first.ts'

test('取込0件なら相談は止める', () => {
  assert.equal(isChatAllowed(0), false)
  assert.equal(isChatAllowed(1), true)
  assert.match(FILE_FIRST_MESSAGE, /ファイル/)
  assert.match(FILE_FIRST_MESSAGE, /貼/)
  assert.equal(FILE_FIRST_CODE, 'FILE_FIRST')
})
