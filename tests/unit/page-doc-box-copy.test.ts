import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import PageDocEngine from '../../lib/page-doc-engine.js'

// /roumu の段2の枠（PageDocBox.tsx）の文言の関門。
//
// なぜ要るか: 引き換え物の文言はサイト側（~/Takeshi_Automation/site/js/page-doc.js）が正典で、
// ここはその写し。ところが既存の「写しの一致テスト」はエンジンと Word 生成だけを比べ、
// 画面部品の文言は比べない。そのためサイト側だけ直した 2026-09-19 の修正が 1 日取り残された
// （アプリは「Word・N枚」と言い続け、落ちてくるのは .docx 1つ）。リポが分かれていて逐語照合は
// できないので、ここでは「二度と言ってはいけない形」と「言わなければならない形」を関門にする。

const src = readFileSync(new URL('../../app/roumu/[slug]/_components/PageDocBox.tsx', import.meta.url), 'utf8')

// コメント（経緯）は枚数に触れてよい。画面に出る側だけを見る
const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

test('渡す書類の枚数を主張しない（返るのは .docx 1つ）', () => {
  assert.doesNotMatch(code, /枚/)
  assert.doesNotMatch(code, /forms\('kitei', v\)\.length\}/)
  // 剥がし漏れの検出: コメントを剥がしても中身が残っていること
  assert.ok(code.includes('InlinePageDocBox'), 'コメント除去が効きすぎている')
})

test('引き換え物は「Word ファイル1つ」と言い、中身は書類名で名指しする', () => {
  assert.match(src, /Word ファイル1つ/)
  assert.match(src, /御社の答えを差し込んだ/)
  assert.match(src, /forms\('kitei', v\)\.map\(f => f\.title\)\.join\('・'\)/)
})

test('メール欄のラベルは入力欄が何かを言う（ボタンの動作の言い直しにしない）', () => {
  assert.match(src, /メールアドレス（必須・同じ書類をこの宛先にも送ります）/)
  assert.doesNotMatch(src, /className="block text-sm font-bold text-neutral-900">届出に使う書類を Word でダウンロードする/)
  assert.match(src, /aria-required="true"/)
})

test('空欄と形式違いを別の reason で数える', () => {
  assert.match(src, /reason: 'empty_email'/)
  assert.match(src, /reason: 'invalid_email'/)
})

test('書類名は3問の答えに追随する（文言の前提）', () => {
  assert.deepEqual(
    PageDocEngine.forms('kitei', { size: 'lt10', union: 'yes', rules: 'have' }).map(f => f.title),
    ['意見書'],
  )
  assert.deepEqual(
    PageDocEngine.forms('kitei', { size: 'ge10', union: 'no', rules: 'have' }).map(f => f.title),
    ['過半数代表者の選出記録', '意見書', '就業規則変更届'],
  )
})
