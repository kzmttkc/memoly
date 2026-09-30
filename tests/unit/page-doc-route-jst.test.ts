import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import PageDocEngine from '../../lib/page-doc-engine.js'

// /api/roumu/page-doc のメール本文は JST の日付で組む関門。
//
// なぜ要るか: サーバ（Vercel）は UTC。today を省略すると JST 10-01 00:00〜09:00 のメールだけ
// 見出しが施行前の「10月1日までの順番」のまま出る（2026-09-30 に発見）。

const src = readFileSync(new URL('../../app/api/roumu/page-doc/route.ts', import.meta.url), 'utf8')
const code = src.replace(/^\s*\/\/.*$/gm, '')

test('build に JST の日付を渡している（today の省略をしない）', () => {
  assert.match(code, /PageDocEngine\.build\('kitei', values, todayJst\)/)
  assert.doesNotMatch(code, /PageDocEngine\.build\('kitei', values\)/)
  assert.match(code, /Date\.now\(\) \+ 9 \* 60 \* 60 \* 1000/)
})

test('UTC 09-30 15:00 = JST 10-01 00:00 は施行日当日の見出しになる', () => {
  const utc = Date.UTC(2026, 8, 30, 15, 0, 0)
  const todayJst = new Date(utc + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  assert.equal(todayJst, '2026-10-01')
  const values: Record<string, string> = {}
  for (const k of Object.keys(PageDocEngine.LABELS.kitei)) values[k] = Object.keys((PageDocEngine.LABELS.kitei as any)[k] ?? {})[0] ?? ''
  const text = PageDocEngine.build('kitei', values, todayJst)
  assert.ok(text, 'エンジンが本文を返す')
  assert.doesNotMatch(text as string, /10月1日までの順番/)
  assert.match(text as string, /本日（2026-10-01）から措置義務が始まります/)
})

test('添付の名前も施行日で切り替わる（10-01 以降に「10月1日までの順番」と名乗らない）', () => {
  assert.match(code, /todayJst >= PageDocEngine\.ENFORCE_DATE \? '足す条文といま着手する順番\.docx'/)
})

test('枠の説明文は施行日の前後どちらでも正しい（「10月1日までの順番が出ます」と約束しない）', () => {
  const box = readFileSync(new URL('../../app/roumu/[slug]/_components/PageDocBox.tsx', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(box, /10月1日までの順番が出ます/)
})
