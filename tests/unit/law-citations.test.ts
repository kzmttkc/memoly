// ============================================================================
// law-citations.test.ts — 回答末尾の「参照した法令・指針」ブロックの捏造防止テスト
//   (WORK_ORDERS Trust Stack v2 #4・2026-08-21)
//
//   守るもの:
//     1. 条番号は e-Gov法令API（/api/2/law_data/{law_id}?elm=MainProvision-Article_N）
//        で実在を確認できたものだけを表示する（fail-closed）。
//     2. 実在しない条（API が 400/400021）は条番号を落とす（法令名だけ残す）。
//     3. API 失敗（ネットワーク断・5xx・タイムアウト）のときは条番号を一切出さず、
//        「自動確認ができなかった」と明示する（黙って捏造しない・黙って省かない）。
//     4. 確定ファクトに当たらない質問は「一般的な情報提供（出典なし）」と明示し、
//        専門家相談を促す。
//     5. カスハラ文脈の回答にだけ Kabau 実務パック導線が付く（他の話題には付かない）。
//
//   ネットワークには出ない（fetch はフェイク）。実APIの疎通は
//   scripts/verify_egov_citations.mjs で別途確認する。
// Run: npm run test:unit
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractArticleRefs,
  egovArticleElm,
  verifyArticleExists,
  buildAnswerSources,
  formatSourcesTrailer,
  SOURCES_HEADING,
  SOURCES_NONE_HEADING,
  SOURCES_UNVERIFIED_HEADING,
  KABAU_BLOCK_HEADING,
} from '../../lib/law-citations.ts'
import { KABAU_PACK_URL } from '../../lib/kabau-pack.ts'

// ----------------------------------------------------------------------------
// フェイク fetch（e-Gov法令API v2 の実レスポンス形を模す。2026-08-21 に実呼び出しで確認）
//   存在する条:   200 {"law_full_text":{"tag":"Article","attr":{"Num":"32"},...}}
//   存在しない条: 400 {"code":"400021","message":"要素（elm）に合致する要素が法令本文に存在しません。"}
//   法令ID誤り:   404 {"code":"404004",...}
// ----------------------------------------------------------------------------
function fakeFetch(mode: 'exists' | 'missing' | 'server_error' | 'throw' | 'timeout') {
  return async (url: string, init?: { signal?: AbortSignal }) => {
    if (mode === 'throw') throw new TypeError('fetch failed')
    if (mode === 'timeout') {
      // 呼び出し側の AbortController で中断されるまで返さない
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    }
    if (mode === 'server_error') return new Response('{"code":"500"}', { status: 500 })
    if (mode === 'missing') {
      return new Response(
        JSON.stringify({ code: '400021', message: '要素（elm）に合致する要素が法令本文に存在しません。' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      )
    }
    const num = /Article_([0-9_]+)/.exec(url)?.[1] ?? '0'
    return new Response(
      JSON.stringify({
        law_info: { law_id: 'x' },
        revision_info: { law_title: '労働基準法' },
        law_full_text: { tag: 'Article', attr: { Num: num }, children: [] },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
}

// ----------------------------------------------------------------------------
// 1) 出典名から「法令名＋条番号」を取り出す
// ----------------------------------------------------------------------------
test('extractArticleRefs: 労働基準法第36条 → lawId=322AC0000000049 / 36', () => {
  const refs = extractArticleRefs('労働基準法第36条／厚生労働省（時間外労働の上限規制）')
  assert.deepEqual(
    refs.map(r => [r.lawId, r.articleNum]),
    [['322AC0000000049', '36']],
  )
})

test('extractArticleRefs: 枝番（第24条の3）は Article_24_3 形式に正規化される', () => {
  const refs = extractArticleRefs('労働基準法第39条第3項／労働基準法施行規則第24条の3')
  assert.deepEqual(
    refs.map(r => [r.lawId, r.articleNum]),
    [
      ['322AC0000000049', '39'],
      ['322M40000100023', '24_3'],
    ],
  )
  assert.equal(egovArticleElm('24_3'), 'MainProvision-Article_24_3')
})

test('extractArticleRefs: 「・」区切りの列挙と範囲（〜）を条ごとに分解し、項・号は条として扱わない', () => {
  const refs = extractArticleRefs('労働基準法第32条・第35条・第36条第1項・第6項・第119条第1号')
  assert.deepEqual(refs.map(r => r.articleNum), ['32', '35', '36', '119'])
  const range = extractArticleRefs('労働基準法第139条〜第142条')
  assert.deepEqual(range.map(r => r.articleNum), ['139', '142'])
})

test('extractArticleRefs: 登録されていない法令名からは条番号を拾わない（知らない法令は出さない）', () => {
  assert.deepEqual(extractArticleRefs('民法第709条'), [])
  assert.deepEqual(extractArticleRefs('国税庁 令和7年度税制改正'), [])
})

// ----------------------------------------------------------------------------
// 2) e-Gov 実在確認（3ケース: 実在 / 非実在 / API失敗）
// ----------------------------------------------------------------------------
test('verifyArticleExists: 実在する条（労働基準法第32条）は exists', async () => {
  const r = await verifyArticleExists('322AC0000000049', '32', {
    fetchImpl: fakeFetch('exists'),
    cache: new Map(),
  })
  assert.equal(r, 'exists')
})

test('verifyArticleExists: 実在しない条（400/400021）は missing', async () => {
  const r = await verifyArticleExists('322AC0000000049', '999', {
    fetchImpl: fakeFetch('missing'),
    cache: new Map(),
  })
  assert.equal(r, 'missing')
})

test('verifyArticleExists: API失敗（5xx / 例外 / タイムアウト）は error（missing と混同しない）', async () => {
  for (const mode of ['server_error', 'throw', 'timeout'] as const) {
    const r = await verifyArticleExists('322AC0000000049', '32', {
      fetchImpl: fakeFetch(mode),
      cache: new Map(),
      timeoutMs: 20,
    })
    assert.equal(r, 'error', `mode=${mode}`)
  }
})

test('verifyArticleExists: 200 でも law_full_text が Article でなければ exists と言わない', async () => {
  const weird = async () =>
    new Response(JSON.stringify({ law_full_text: { tag: 'Paragraph', attr: {}, children: [] } }), {
      status: 200,
    })
  const r = await verifyArticleExists('322AC0000000049', '32', { fetchImpl: weird, cache: new Map() })
  assert.equal(r, 'error')
})

test('verifyArticleExists: exists/missing はキャッシュされ、同じ条に2度問い合わせない', async () => {
  let calls = 0
  const counting = async (url: string) => {
    calls++
    return fakeFetch('exists')(url)
  }
  const cache = new Map()
  await verifyArticleExists('322AC0000000049', '32', { fetchImpl: counting, cache })
  await verifyArticleExists('322AC0000000049', '32', { fetchImpl: counting, cache })
  assert.equal(calls, 1)
})

// ----------------------------------------------------------------------------
// 3) 質問 → 根拠ブロック（fail-closed の合成）
// ----------------------------------------------------------------------------
test('buildAnswerSources: 36協定の質問で労働基準法第36条が e-Gov 確認済みとして載る', async () => {
  const s = await buildAnswerSources('36協定の上限時間を教えてください', {
    fetchImpl: fakeFetch('exists'),
    cache: new Map(),
  })
  assert.equal(s.status, 'sources')
  const roukihou = s.laws.find(l => l.lawId === '322AC0000000049')
  assert.ok(roukihou, '労働基準法が載る')
  assert.ok(roukihou!.articles.some(a => a.num === '36'), '第36条が載る')
  const a36 = roukihou!.articles.find(a => a.num === '36')!
  assert.equal(a36.label, '第36条')
  assert.equal(a36.url, 'https://laws.e-gov.go.jp/law/322AC0000000049#Mp-At_36')
  // 厚労省の一次URL（指針・解説）も一緒に載る
  assert.ok(s.refs.some(r => r.url.startsWith('https://www.mhlw.go.jp/')))
  const trailer = formatSourcesTrailer(s)
  assert.ok(trailer.includes(SOURCES_HEADING))
  assert.ok(trailer.includes('労働基準法 第36条'))
  assert.ok(!trailer.includes(KABAU_PACK_URL), 'カスハラ以外にはKabau導線を付けない')
})

test('buildAnswerSources: 条が実在しない（missing）なら条番号を落とし、法令名だけ残す', async () => {
  const s = await buildAnswerSources('36協定の上限時間を教えてください', {
    fetchImpl: fakeFetch('missing'),
    cache: new Map(),
  })
  assert.equal(s.status, 'sources')
  const roukihou = s.laws.find(l => l.lawId === '322AC0000000049')
  assert.ok(roukihou)
  assert.equal(roukihou!.articles.length, 0)
  const trailer = formatSourcesTrailer(s)
  assert.ok(!/第\d+条/.test(trailer), `条番号が残っている: ${trailer}`)
  assert.ok(trailer.includes('労働基準法'))
})

test('buildAnswerSources: API失敗時は unverified（条番号を一切出さず、確認できなかったと明示する）', async () => {
  for (const mode of ['throw', 'server_error', 'timeout'] as const) {
    const s = await buildAnswerSources('36協定の上限時間を教えてください', {
      fetchImpl: fakeFetch(mode),
      cache: new Map(),
      timeoutMs: 20,
    })
    assert.equal(s.status, 'unverified', `mode=${mode}`)
    const trailer = formatSourcesTrailer(s)
    assert.ok(trailer.includes(SOURCES_UNVERIFIED_HEADING), `mode=${mode}`)
    assert.ok(!/第\d+条/.test(trailer), `mode=${mode}: 条番号が残っている`)
    assert.ok(!trailer.includes('laws.e-gov.go.jp/law/'), `mode=${mode}: 未確認の条文リンクが残っている`)
    assert.ok(trailer.includes('専門家'), `mode=${mode}`)
  }
})

test('buildAnswerSources: 確定ファクトに当たらない質問は「一般的な情報提供（出典なし）」＋専門家相談', async () => {
  let calls = 0
  const s = await buildAnswerSources('来月の社内イベントの案内文を考えてください', {
    fetchImpl: async (u: string) => {
      calls++
      return fakeFetch('exists')(u)
    },
    cache: new Map(),
  })
  assert.equal(s.status, 'none')
  assert.equal(calls, 0, '出典候補が無いときは e-Gov を叩かない')
  const trailer = formatSourcesTrailer(s)
  assert.ok(trailer.includes(SOURCES_NONE_HEADING))
  assert.ok(trailer.includes('一般的な情報提供（出典なし）'))
  assert.ok(trailer.includes('専門家'))
})

test('buildAnswerSources: 空の質問でも必ず何かを明示する（黙って省かない）', async () => {
  const s = await buildAnswerSources('', { fetchImpl: fakeFetch('exists'), cache: new Map() })
  assert.equal(s.status, 'none')
  assert.ok(formatSourcesTrailer(s).includes('一般的な情報提供（出典なし）'))
})

test('buildAnswerSources: 条文以外の一次情報の表示名から未確認の条番号は落とすが、法令番号（法律第63号）は壊さない', async () => {
  const s = await buildAnswerSources('36協定とカスハラ対策について', {
    fetchImpl: fakeFetch('missing'),
    cache: new Map(),
  })
  const names = s.refs.map(r => r.name)
  assert.ok(
    names.some(n => n.includes('令和7年法律第63号') && n.includes('令和8年政令第17号')),
    `法令番号が壊れている: ${names.join(' | ')}`,
  )
  assert.ok(
    names.every(n => !/第\d+条/.test(n)),
    `未確認の条番号が表示名に残っている: ${names.join(' | ')}`,
  )
})

// ----------------------------------------------------------------------------
// 4) カスハラ文脈 → Kabau 実務パック導線（1箇所・Kabau側の既存CTA文を流用）
// ----------------------------------------------------------------------------
test('buildAnswerSources: カスハラの質問には Kabau 実務パック導線が1箇所付く（utm付き）', async () => {
  const s = await buildAnswerSources('カスハラ対策で就業規則に何を書けばいいですか', {
    fetchImpl: fakeFetch('exists'),
    cache: new Map(),
  })
  assert.equal(s.kasuhara, true)
  const trailer = formatSourcesTrailer(s)
  assert.ok(trailer.includes(KABAU_BLOCK_HEADING))
  assert.equal(trailer.split(KABAU_PACK_URL).length - 1, 1, 'Kabau URL は1箇所だけ')
  assert.ok(KABAU_PACK_URL.includes('utm_source=banto'))
  assert.ok(KABAU_PACK_URL.includes('utm_campaign=kabau_set'))
  // Kabau側（site/kasuhara-*-guide.html の pack CTA）の既存文をそのまま使う。新規コピーではない。
  assert.ok(trailer.includes('足りない措置の書式は、Wordで渡せます'))
  assert.ok(trailer.includes('実務パックの中身を見る（19,800円）'))
})

test('buildAnswerSources: セクハラ/パワハラだけの質問には Kabau 導線を付けない（カスハラ限定）', async () => {
  const s = await buildAnswerSources('パワハラ防止の措置義務について教えてください', {
    fetchImpl: fakeFetch('exists'),
    cache: new Map(),
  })
  assert.equal(s.kasuhara, false)
  assert.ok(!formatSourcesTrailer(s).includes(KABAU_PACK_URL))
})

test('buildAnswerSources: API失敗でもカスハラ導線は独立して付く（出典の可否と導線は別系統）', async () => {
  // 36協定（条番号の確認が走る話題）とカスハラを同時に含む質問で、API失敗時の独立性を見る
  const s = await buildAnswerSources('カスハラ対応で残業が増えたときの36協定の扱いは', {
    fetchImpl: fakeFetch('throw'),
    cache: new Map(),
  })
  assert.equal(s.status, 'unverified')
  assert.equal(s.kasuhara, true)
  assert.ok(formatSourcesTrailer(s).includes(KABAU_PACK_URL))
})
