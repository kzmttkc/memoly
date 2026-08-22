import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractDocumentText,
  sniffKind,
  PDF_EXTRACT_FAIL,
  fileFromPastedText,
  EXTRACT_MAX_CHARS,
  htmlToPlainText,
  plainTextFromClipboardData,
  unreadNoteForUnsupported,
  emptyOrFolderNote,
} from '../../lib/document-extract.ts'

test('拡張子と MIME から種類を決める', () => {
  assert.equal(sniffKind('rules.pdf', 'application/pdf'), 'pdf')
  assert.equal(sniffKind('rules.docx', 'application/octet-stream'), 'docx')
  assert.equal(sniffKind('rules.txt', 'text/plain'), 'txt')
  assert.equal(sniffKind('rules.doc', 'application/msword'), 'unsupported')
})

test('プレーンテキストはそのまま返す', async () => {
  const buf = new TextEncoder().encode('第12条 試用期間は3か月とする。')
  const r = await extractDocumentText({ buffer: buf, filename: '就業規則.txt', mime: 'text/plain' })
  assert.match(r.text, /第12条/)
  assert.equal(r.unreadNote, null)
})

test('空ファイルは未読として返す', async () => {
  const r = await extractDocumentText({
    buffer: new Uint8Array(),
    filename: 'empty.txt',
    mime: 'text/plain',
  })
  assert.equal(r.text, '')
  assert.ok(r.unreadNote)
})

test('非対応形式は本文を空にして理由を残す', async () => {
  const r = await extractDocumentText({
    buffer: new Uint8Array([1, 2, 3]),
    filename: 'scan.jpg',
    mime: 'image/jpeg',
  })
  assert.equal(r.text, '')
  assert.match(r.unreadNote ?? '', /画像/)
})

test('古いWordは.docxへ誘導する', async () => {
  const r = await extractDocumentText({
    buffer: new Uint8Array([1, 2, 3]),
    filename: '就業規則.doc',
    mime: 'application/msword',
  })
  assert.equal(r.text, '')
  assert.match(r.unreadNote ?? '', /\.docx/)
  assert.doesNotMatch(r.unreadNote ?? '', /対応していません/)
})

test('画像とPagesは形式ごとの案内を出す', async () => {
  const { unreadNoteForUnsupported } = await import('../../lib/document-extract.ts')
  assert.match(unreadNoteForUnsupported('scan.png'), /画像/)
  assert.match(unreadNoteForUnsupported('scan.heic'), /貼/)
  assert.match(unreadNoteForUnsupported('rules.pages'), /Pages/)
})

test('PDFが開けないときはパスワード解除を案内する', () => {
  assert.match(PDF_EXTRACT_FAIL, /パスワード/)
  assert.match(PDF_EXTRACT_FAIL, /スキャン/)
})

test('空の貼り付けは拒否する', () => {
  const r = fileFromPastedText('   \n')
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /空/)
})

test('貼り付けは pasted.txt になる', async () => {
  const r = fileFromPastedText('第12条 試用期間は3か月とする。')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.file.name, 'pasted.txt')
  assert.match(r.file.type, /^text\/plain/)
  assert.equal(r.truncated, false)
  assert.equal(await r.file.text(), '第12条 試用期間は3か月とする。')
})

test('10万字を超える貼り付けは切る', async () => {
  const r = fileFromPastedText('あ'.repeat(EXTRACT_MAX_CHARS + 1))
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.truncated, true)
  assert.equal((await r.file.text()).length, EXTRACT_MAX_CHARS)
})

test('HTMLだけのクリップボードから本文を取る', () => {
  const html = '<p>第12条&nbsp;試用期間は3か月とする。</p><br><p>第13条 懲戒</p>'
  assert.match(htmlToPlainText(html), /第12条/)
  assert.match(htmlToPlainText(html), /第13条/)
  assert.doesNotMatch(htmlToPlainText(html), /<p>/)
  const fromHtmlOnly = plainTextFromClipboardData(t => (t === 'text/html' ? html : ''))
  assert.match(fromHtmlOnly, /試用期間/)
  const preferPlain = plainTextFromClipboardData(t => (t === 'text/plain' ? 'プレーン' : html))
  assert.equal(preferPlain, 'プレーン')
})

test('空ファイルとフォルダはAPIに送る前に止める', () => {
  assert.match(emptyOrFolderNote({ size: 0, name: 'rules.pdf' }) ?? '', /空/)
  assert.match(emptyOrFolderNote({ size: 0, name: '就業規則' }) ?? '', /フォルダ/)
  assert.equal(emptyOrFolderNote({ size: 12, name: 'rules.pdf' }), null)
})

test('zipと表計算は形式ごとの案内を出す', () => {
  assert.match(unreadNoteForUnsupported('rules.zip'), /zip/)
  assert.match(unreadNoteForUnsupported('rules.xlsx'), /表計算/)
})
