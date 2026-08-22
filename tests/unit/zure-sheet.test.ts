import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildZureSheet } from '../../lib/zure-sheet.ts'

test('読めなかったページは1行目に残す', () => {
  const sheet = buildZureSheet({
    filename: '就業規則.pdf',
    text: '第1条 この規則は従業員に適用する。',
    unreadNote: '画像の2ページは本文が取れませんでした。',
  })
  assert.equal(sheet.rows[0].kind, 'unread')
  assert.match(sheet.rows[0].detail, /画像の2ページ/)
})

test('書いてある論点は運用がまだ無いと出す。書いてない論点は1行にまとめる', () => {
  const sheet = buildZureSheet({
    filename: '就業規則.txt',
    text: '第12条 年次有給休暇は入社6か月後に10日を付与する。第20条 懲戒は始末書とする。',
    unreadNote: null,
  })
  const kinds = Object.fromEntries(sheet.rows.map(r => [r.topic, r.kind]))
  assert.equal(kinds['年次有給休暇'], 'rule_only')
  assert.equal(kinds['懲戒'], 'rule_only')
  const absent = sheet.rows.filter(r => r.kind === 'absent')
  assert.equal(absent.length, 1)
  assert.match(absent[0].detail, /カスタマーハラスメント/)
  assert.doesNotMatch(sheet.rows.map(r => r.detail).join(''), /違法|違反/)
  assert.ok(sheet.rows.length <= 4)
})

test('規程と運用の値が違うときはずれとして出す', () => {
  const sheet = buildZureSheet({
    filename: '就業規則.txt',
    text: '有給',
    unreadNote: null,
    profiles: [
      { key: '有給の規程', value: '入社6か月後に10日' },
      { key: '有給の運用', value: '入社直後から付与' },
    ],
  })
  const conflict = sheet.rows.find(r => r.kind === 'conflict')
  assert.ok(conflict)
  assert.match(conflict!.detail, /入社6か月後/)
  assert.match(conflict!.detail, /入社直後/)
})

test('本文が空でも未読の理由で1枚になる', () => {
  const sheet = buildZureSheet({
    filename: 'scan.pdf',
    text: '',
    unreadNote: 'この形式には対応していません。',
  })
  assert.equal(sheet.rows.length, 1)
  assert.equal(sheet.rows[0].kind, 'unread')
  assert.match(sheet.disclaimer, /個別の法的助言ではありません/)
})

test('論点の種類は短いラベルで示す', async () => {
  const { zureKindLabel, sheetTitle } = await import('../../lib/zure-sheet.ts')
  assert.equal(zureKindLabel('unread'), '未読')
  assert.equal(zureKindLabel('absent'), '触れていない')
  const long = `${'あ'.repeat(50)}.docx`
  assert.match(sheetTitle(long), /…のずれ1枚/)
  assert.ok(sheetTitle(long).length < sheetTitle(long.replace('.docx', `${'い'.repeat(20)}.docx`)).length + 20)
})

test('貼った本文の題は pasted にしない', async () => {
  const { sheetTitle } = await import('../../lib/zure-sheet.ts')
  assert.equal(sheetTitle('pasted.txt'), '貼った本文のずれ1枚')
})
