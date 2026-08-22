import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAnswerCitation } from '../../lib/answer-citation.ts'

test('自社・法令・未登録の3行をこの順で出す', () => {
  const text = formatAnswerCitation({
    company: { title: '就業規則', registeredOn: '2026-07-24' },
    legal: {
      label: '時間外労働の上限（原則）',
      sourceName: '厚生労働省',
      effectiveDate: '2019-04-01',
    },
    unregistered: ['賃金規程'],
  })
  const lines = text.split('\n').filter(Boolean)
  assert.equal(lines[0], '【出典】')
  assert.match(lines[1], /^自社: 就業規則（登録 2026-07-24）$/)
  assert.match(lines[2], /^法令: 時間外労働の上限（原則）（厚生労働省 \/ 2019-04-01）$/)
  assert.match(lines[3], /^未登録: 賃金規程$/)
})

test('自社行が無いときは「未登録」と書く（一般論と混ぜない）', () => {
  const text = formatAnswerCitation({
    company: null,
    legal: {
      label: '年5日の年次有給休暇の取得義務',
      sourceName: '厚生労働省',
      effectiveDate: '2019-04-01',
    },
    unregistered: [],
  })
  assert.match(text, /自社: この会社の規程は未登録/)
  assert.match(text, /法令: 年5日/)
  assert.doesNotMatch(text, /未登録: この会社の規程は未登録/)
})

test('法令行が無いときは「この質問に当てはまる確定ファクトは未選択」', () => {
  const text = formatAnswerCitation({
    company: { title: '就業規則' },
    legal: null,
    unregistered: [],
  })
  assert.match(text, /法令: この質問に当てはまる確定ファクトは未選択/)
})

test('英語は Basis: の3行', () => {
  const text = formatAnswerCitation(
    {
      company: { title: 'Work rules', registeredOn: '2026-07-24' },
      legal: {
        label: 'Overtime cap',
        sourceName: 'MHLW',
        effectiveDate: '2019-04-01',
      },
      unregistered: ['Wage rules'],
    },
    'en',
  )
  assert.match(text, /^\[Source\]/m)
  assert.match(text, /Company: Work rules \(registered 2026-07-24\)/)
  assert.match(text, /Law: Overtime cap \(MHLW \/ 2019-04-01\)/)
  assert.match(text, /Not on file: Wage rules/)
})
