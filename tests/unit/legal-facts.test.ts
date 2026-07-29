import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGAL_FACTS,
  getLegalFact,
  getFactsByTopic,
  selectFactsForQuery,
  formatFactsBlock,
} from '../../lib/legal-facts.ts'
import { readFileSync } from 'node:fs'

// ============================================================================
// legal-facts.test.ts — 確定法令ファクトの「捏造防止インバリアント」と
//   「system プロンプトへ本当に載るか（ゴール逆算検証）」のテスト。
//
//   ここが守るもの:
//     1. 出典なし・施行日なしのファクトを将来うっかり足せないようにする。
//     2. 出典URLは一次情報のドメインだけに限定する（引用先の捏造を機械的に止める）。
//     3. 追加したトピックが selectFactsForQuery → buildCompanySystemPrompt の
//        経路で実際に注入されることを確認する（呼ばれないファクトは無価値）。
// ============================================================================

// 一次情報として許すドメイン（増やすときは一次情報であることを確認してから）。
const ALLOWED_HOSTS = [
  'www.nta.go.jp', // 国税庁
  'www.mhlw.go.jp', // 厚生労働省
  'www.nenkin.go.jp', // 日本年金機構
  'laws.e-gov.go.jp', // e-Gov法令検索（法令原文）
]

test('全ファクトが key / label / value / sourceName / sourceUrl / effectiveDate を持つ', () => {
  for (const f of LEGAL_FACTS) {
    assert.ok(f.key.length > 0, `key が空: ${JSON.stringify(f)}`)
    assert.ok(f.label.length > 0, `label が空: ${f.key}`)
    assert.ok(f.value.length > 0, `value が空: ${f.key}`)
    assert.ok(f.sourceName.length > 0, `sourceName が空: ${f.key}`)
    assert.ok(f.sourceUrl.length > 0, `sourceUrl が空: ${f.key}`)
    assert.ok(f.effectiveDate.length > 0, `effectiveDate が空: ${f.key}`)
  }
})

test('出典URLは https かつ一次情報ドメインのみ（引用先の捏造を機械的に止める）', () => {
  for (const f of LEGAL_FACTS) {
    const u = new URL(f.sourceUrl)
    assert.equal(u.protocol, 'https:', `https でない: ${f.key}`)
    assert.ok(
      ALLOWED_HOSTS.includes(u.host),
      `一次情報ドメイン外: ${f.key} → ${u.host}`,
    )
  }
})

test('key は重複しない', () => {
  const keys = LEGAL_FACTS.map(f => f.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('各トピックは1件以上のファクトに解決する（存在しない key を参照していない）', () => {
  const topics = [
    'tax_reform_2025',
    'overtime_36',
    'pension_rate',
    'harassment_2026',
    'wari_mashi',
    'nenkyu',
    'shakai_hoken_tekiyo',
  ] as const
  for (const t of topics) {
    const facts = getFactsByTopic(t)
    assert.ok(facts.length > 0, `トピックが空: ${t}`)
  }
})

// --- 追加トピックのキーワード判定（呼ばれなければ意味がない） --------------

test('割増賃金の質問で割増ファクトが選ばれる', () => {
  const keys = selectFactsForQuery('月60時間を超えた残業代の割増率は？').map(f => f.key)
  assert.ok(keys.includes('wari_mashi_60over'))
  assert.ok(keys.includes('wari_mashi_kihon'))
})

test('深夜・休日の質問でも割増ファクトが選ばれる', () => {
  const keys = selectFactsForQuery('深夜に休日労働させた場合の割増はどうなりますか').map(f => f.key)
  assert.ok(keys.includes('wari_mashi_juufuku'))
})

test('年休の質問で年5日の取得義務が選ばれる', () => {
  const keys = selectFactsForQuery('パートさんの有給休暇は年5日取らせないといけない？').map(
    f => f.key,
  )
  assert.ok(keys.includes('nenkyu_5nichi_gimu'))
  assert.ok(keys.includes('nenkyu_hirei_fuyo'))
})

test('社会保険の適用拡大の質問で企業規模要件・加入要件が選ばれる', () => {
  const keys = selectFactsForQuery('週20時間以上働くパートは社会保険に加入させる必要がある？').map(
    f => f.key,
  )
  assert.ok(keys.includes('shaho_tokutei_tekiyo_jigyosho'))
  assert.ok(keys.includes('shaho_tanjikan_youken'))
})

test('36協定の質問で届出義務・適用猶予終了も選ばれる', () => {
  const keys = selectFactsForQuery('36協定を届け出ていない場合の罰則は？').map(f => f.key)
  assert.ok(keys.includes('overtime_36_todokede'))
  assert.ok(keys.includes('overtime_tokubetsu'))
})

test('無関係な質問ではファクトを注入しない（ノイズを出さない）', () => {
  assert.equal(selectFactsForQuery('社員旅行の行き先を相談したい').length, 0)
  assert.equal(selectFactsForQuery('').length, 0)
})

test('年休の質問で割増ファクトは混ざらない（トピックが漏れていない）', () => {
  const keys = selectFactsForQuery('年次有給休暇の付与日数を教えて').map(f => f.key)
  assert.ok(keys.every(k => !k.startsWith('wari_mashi')))
})

// --- system プロンプトへ本当に載るか（ゴール逆算検証） ---------------------

test('formatFactsBlock は値・出典名・出典URLを必ず含む', () => {
  const block = formatFactsBlock(selectFactsForQuery('残業代の割増率'))
  assert.ok(block.includes('【確定ファクト'))
  assert.ok(block.includes('50%以上'))
  assert.ok(block.includes('laws.e-gov.go.jp/law/322AC0000000049'))
  assert.ok(block.includes('出典URL:'))
})

test('質問→ファクト選択→整形ブロックが、期待する値と出典URLを載せる（割増・年休・社保）', () => {
  const cases: { q: string; needles: string[] }[] = [
    {
      q: '月60時間超の残業代の割増率は？',
      needles: ['50%以上', 'https://laws.e-gov.go.jp/law/322AC0000000049'],
    },
    {
      q: '有給休暇を年5日取らせる義務について',
      needles: ['10労働日以上', 'https://laws.e-gov.go.jp/law/322AC0000000049'],
    },
    {
      q: '短時間労働者の社会保険の加入要件',
      needles: [
        '特定適用事業所',
        'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',
      ],
    },
  ]
  for (const c of cases) {
    const block = formatFactsBlock(selectFactsForQuery(c.q))
    assert.ok(block.includes('【確定ファクト'), `確定ファクトブロックが無い: ${c.q}`)
    for (const n of c.needles) {
      assert.ok(block.includes(n), `期待値が載っていない: ${c.q} / ${n}`)
    }
  }
})

// lib/prompts.ts は Next のパスエイリアスを含むため node --test から直接 import できない。
// 代わりに「確定ファクトが system プロンプトへ連結される配線」がソース上に残っているかを
// 構造テストで固定する（配線を外したら落ちる＝ファクトを増やしても呼ばれない事故を防ぐ）。
test('lib/prompts.ts が確定ファクトを system プロンプトへ連結している（配線の固定）', () => {
  const src = readFileSync(new URL('../../lib/prompts.ts', import.meta.url), 'utf8')
  assert.ok(
    src.includes("import { selectFactsForQuery, formatFactsBlock } from './legal-facts'"),
    'legal-facts の import が変わっている',
  )
  assert.ok(
    src.includes('formatFactsBlock(selectFactsForQuery(userQuery ?? \'\'))'),
    'チャットの質問文からファクトを選ぶ呼び出しが無い',
  )
  assert.ok(src.includes('${factsBlock}'), 'factsBlock が system プロンプトへ埋め込まれていない')
})

// --- 過去判断 × 最新法令の突合（decision-conflict）に新ファクトが効くか -----
//   lib/decision-conflict.ts は '@/lib/...' エイリアスを使うため node --test から
//   直接 import できない。参照している key が実在することと、突合に必要な
//   施行日（YYYY-MM-DD）を持つことを、ソース＋ファクト側から固定する。

test('decision-conflict が参照する新ファクトの key が実在し、施行日が突合可能', () => {
  const src = readFileSync(new URL('../../lib/decision-conflict.ts', import.meta.url), 'utf8')
  for (const key of ['wari_mashi_60over', 'nenkyu_5nichi_gimu']) {
    assert.ok(src.includes(`'${key}'`), `decision-conflict が ${key} を参照していない`)
    const fact = getLegalFact(key)
    assert.ok(fact, `ファクトが存在しない: ${key}`)
    // parseEffectiveDate（decision-conflict 側）が読める形＝先頭に YYYY-MM-DD が必要。
    assert.match(fact.effectiveDate, /^\d{4}-\d{2}-\d{2}/, `施行日が突合できない: ${key}`)
  }
  assert.match(getLegalFact('wari_mashi_60over')!.effectiveDate, /^2023-04-01/)
  assert.match(getLegalFact('nenkyu_5nichi_gimu')!.effectiveDate, /^2019-04-01/)
})

test('将来施行のファクトは decision-conflict に入れない（確認対象カードの乱発防止）', () => {
  const src = readFileSync(new URL('../../lib/decision-conflict.ts', import.meta.url), 'utf8')
  for (const key of [
    'shaho_tokutei_tekiyo_jigyosho',
    'kasuhara_sochi_gimu_2026',
    'shukatsu_sekuhara_gimu_2026',
  ]) {
    assert.ok(!src.includes(`'${key}'`), `将来施行のファクトが混入している: ${key}`)
  }
})
