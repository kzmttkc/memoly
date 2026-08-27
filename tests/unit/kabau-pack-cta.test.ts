// ============================================================================
// kabau-pack-cta.test.ts — 番頭→就業規則AI実務パック導線（WORK_ORDERS Trust Stack v2 #3・番頭側）
//
//   守るもの:
//     1. /roumu/[slug] のカスハラ関連記事だけに導線が付く（判定はslug＋h1の両方で拾う。
//        機械追記の usecase-auto.json には 'kashara' 'cashara' 'customer-harassment' 等の
//        表記揺れがあり、slugだけだと取りこぼす）。
//     2. 導線の文言は 就業規則AI側 site/kasuhara-*-guide.html の pack CTA 既存文と同一（新規コピー禁止）。
//     3. リンクは utm_source=banto&utm_medium=referral&utm_campaign=kabau_set を持つ。
//     4. クリックは既存の Plausible 計測（lib/analytics track）で kabau_pack_cta_click として取れる。
//     5. セット割引・同梱課金は作らない（このコンポーネントは Stripe/checkout に触れない）。
// Run: npm run test:unit
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  KABAU_PACK_URL,
  KABAU_PACK_COPY,
  isKasuharaUseCase,
  isKasuharaQuery,
} from '../../lib/kabau-pack.ts'

function read(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
}

test('KABAU_PACK_URL: 就業規則AI パックLPへ utm 付きで向く', () => {
  const u = new URL(KABAU_PACK_URL)
  assert.equal(u.origin + u.pathname, 'https://sharoushi-agent.com/kasuhara-pack.html')
  assert.equal(u.searchParams.get('utm_source'), 'banto')
  assert.equal(u.searchParams.get('utm_medium'), 'referral')
  assert.equal(u.searchParams.get('utm_campaign'), 'kabau_set')
})

test('KABAU_PACK_COPY: 就業規則AI側 pack CTA の既存文をそのまま使う（新規コピーを書かない）', () => {
  // site/kasuhara-shugyokisoku-kitei-guide.html の .pack-cta（2026-08-21 実測）と同一文。
  assert.equal(KABAU_PACK_COPY.title, '足りない措置の書式は、Wordで渡せます')
  assert.equal(
    KABAU_PACK_COPY.sub,
    '就業規則の改定条文3パターンと、窓口・事実確認・研修などの書式10点です。中身を見てから判断できます。',
  )
  assert.equal(KABAU_PACK_COPY.button, '実務パックの中身を見る（19,800円）→')
})

test('isKasuharaUseCase: カスハラ関連の全記事（手動・機械追記とも）を拾い、無関係の記事は拾わない', () => {
  const auto = JSON.parse(read('lib/usecase-auto.json')) as { slug: string; h1: string }[]
  const curated = read('lib/usecase.ts')
  const curatedEntries = [...curated.matchAll(/slug: '([^']+)',\s*h1: '([^']+)'/g)].map(m => ({
    slug: m[1],
    h1: m[2],
  }))
  const all = [...curatedEntries, ...auto]
  assert.ok(all.length > 30, `記事が読めていない: ${all.length}`)
  // 正解の定義: h1 にカスハラ/カスタマーハラスメントを含む記事（表記揺れのslugもここで拾える）
  const expected = all.filter(u => /カスハラ|カスタマーハラスメント|カスタマー・ハラスメント/.test(u.h1))
  assert.ok(expected.length >= 15, `カスハラ記事が少なすぎる: ${expected.length}`)
  for (const u of expected) {
    assert.ok(isKasuharaUseCase(u), `取りこぼし: ${u.slug} | ${u.h1}`)
  }
  const nonKasuhara = all.filter(u => !expected.includes(u))
  const falsePositives = nonKasuhara.filter(u => isKasuharaUseCase(u))
  // slug の表記揺れ（kashara/cashara/customer-harassment）で拾った分は h1 にもカスハラが入っているはず。
  assert.deepEqual(
    falsePositives.map(u => u.slug),
    [],
    `カスハラ以外の記事に導線が付く: ${falsePositives.map(u => u.slug).join(', ')}`,
  )
  assert.equal(isKasuharaUseCase({ slug: 'labor-ai-comparison', h1: '労務AIの比較' }), false)
})

test('isKasuharaQuery: カスハラ限定（セクハラ/パワハラ単独では真にしない）', () => {
  assert.equal(isKasuharaQuery('カスハラ対策で就業規則に何を書けばいい？'), true)
  assert.equal(isKasuharaQuery('カスタマーハラスメントの相談窓口'), true)
  assert.equal(isKasuharaQuery('お客様からの著しい迷惑行為への対応'), true)
  assert.equal(isKasuharaQuery('パワハラ防止の措置義務'), false)
  assert.equal(isKasuharaQuery('セクハラの相談があった'), false)
  assert.equal(isKasuharaQuery('有給休暇の付与日数'), false)
  assert.equal(isKasuharaQuery(''), false)
})

test('/roumu/[slug]: カスハラ記事にだけ KabauPackCta を描画し、計測イベントは kabau_pack_cta_click', () => {
  const page = read('app/roumu/[slug]/page.tsx')
  assert.ok(page.includes('isKasuharaUseCase(u)'), 'page.tsx が isKasuharaUseCase で出し分けていない')
  assert.ok(page.includes('<KabauPackCta'), 'page.tsx が KabauPackCta を描画していない')
  assert.equal(page.split('<KabauPackCta').length - 1, 1, '記事ページの導線は1箇所')
  const cta = read('app/roumu/[slug]/_components/KabauPackCta.tsx')
  assert.ok(cta.includes("track('kabau_pack_cta_click'"), '計測イベント名が違う')
  assert.ok(cta.includes('KABAU_PACK_URL'), 'URLは lib/kabau-pack の定数を使う')
  assert.ok(!/stripe|checkout|price_/i.test(cta), 'セット割引・同梱課金を作らない')
})

test('チャット: 回答末尾の 就業規則AI 導線も同じイベント名で計測する', () => {
  const panel = read('components/ui/AnswerSources.tsx')
  assert.ok(panel.includes("track('kabau_pack_cta_click'"), 'AnswerSources の計測イベント名が違う')
  assert.ok(!/stripe|checkout|price_/i.test(panel))
})
