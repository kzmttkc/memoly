// ============================================================================
// uitruth-cross-cta.test.ts — 公開フッタの UITruth クロス送客枠が「測れる状態」を保つ。
//
// なぜ要るか: 2026-08-20 にこの枠を足したとき、表示もクリックもイベントを1本も
//   出しておらず、効果を測る手段が無いまま約20の公開ページに常設された
//   （Plausible 実測: 番頭ホストの当日イベントは pageview / demo_autoplayed /
//    kasuhara_selfcheck_item_toggled のみで CTA 関連は0件）。
//   計測は「無くても画面が壊れない」ため、人手のレビューでは抜けても気づけない。
//   ここで機械的に固定する。
//
// 守るもの:
//   1. PublicFooter はサーバーコンポーネントのまま（枠だけがクライアント境界）
//   2. 表示イベント名・props が sharoushi 側と揃っている（横比較の前提）
//   3. 表示イベントがマウント即発火でない（見られていないものを見たと数えない）
//   4. クリックは Plausible の Outbound Link 自動計測に乗る前提が崩れていない
//      （同一スクリプト・init で outboundLinks を上書きしない）。前提が崩れたら
//      明示イベントが必要になるので、その時にここが落ちて気づける
//   5. 明示クリックイベントを足していない（自動計測との二重計上を防ぐ）
// ============================================================================
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8')

const cta = read('components', 'ui', 'UitruthCrossCta.tsx')
const footer = read('components', 'ui', 'PublicFooter.tsx')
const layout = read('app', 'layout.tsx')
const plausibleInit = read('public', 'plausible-init.js')

test('PublicFooter はサーバーコンポーネントのまま（枠だけをクライアント化する）', () => {
  assert.ok(
    !/^\s*'use client'/m.test(footer),
    "PublicFooter に 'use client' が入るとフッタ全体がクライアント化する。枠だけを切り出すこと",
  )
  assert.ok(
    footer.includes('showCrossCta') && footer.includes('<UitruthCrossCta />'),
    'PublicFooter は opt-in で UitruthCrossCta を描画できること（既定オフ）',
  )
  assert.ok(
    /showCrossCta\s*=\s*false/.test(footer),
    '労務面の焦点のため showCrossCta の既定は false（外部評価 2026-08-29）',
  )
  assert.ok(
    !footer.includes('uitruth.app'),
    'uitruth.app へのアンカーを PublicFooter に直書きすると計測が抜ける（枠は UitruthCrossCta に一本化）',
  )
  assert.ok(/^'use client'/m.test(cta), "UitruthCrossCta は 'use client' であること")
})

test('送客先URLの utm が3つ揃っている（Outbound Link のクリック識別子を兼ねる）', () => {
  const m = cta.match(/https:\/\/uitruth\.app\/\?[^'"\s]+/)
  assert.ok(m, 'UITruth への href が見つからない')
  const params = new URL(m[0]).searchParams
  assert.equal(params.get('utm_source'), 'banto')
  assert.equal(params.get('utm_medium'), 'referral')
  assert.equal(params.get('utm_campaign'), 'footer_perm')
})

test('表示イベントは sharoushi と同名・同 props（site だけで両サイトを分離する）', () => {
  assert.ok(
    cta.includes("track('uitruth_cta_view'"),
    'sharoushi 側 [data-track-view="uitruth_cta_view"] と同名にすること（横比較のため）',
  )
  assert.ok(cta.includes("source: 'footer_perm'"), "props.source は 'footer_perm'")
  assert.ok(cta.includes("site: 'banto'"), "props.site は 'banto'")
})

test('表示イベントはマウント即発火でなく、可視到達で1回だけ発火する', () => {
  assert.ok(cta.includes('IntersectionObserver'), 'IntersectionObserver で可視を判定すること')
  const intersecting = cta.indexOf('isIntersecting')
  const fire = cta.indexOf("track('uitruth_cta_view'")
  assert.ok(intersecting !== -1, 'isIntersecting の判定が無い＝画面外でも計上される')
  assert.ok(
    intersecting < fire,
    '発火が isIntersecting 判定より前にある＝見られていないものを見られたと数えてしまう',
  )
  // 1回だけ: 再発火ガード（unobserve と fired フラグ）の両方を要求する。
  assert.ok(cta.includes('unobserve'), 'スクロール往復で重複発火しないよう unobserve すること')
  assert.ok(/firedRef\.current\s*=\s*true/.test(cta), '重複発火ガード（firedRef）を持つこと')
})

test('クリックは Plausible の Outbound Link 自動計測に乗る前提が保たれている', () => {
  // 前提1: sharoushi と同一の Plausible スクリプト（outboundLinks 有効な配信設定）を読む。
  assert.ok(
    layout.includes('plausible.io/js/pa-zK4ObFABW1NCS-rSYTlSn.js'),
    'スクリプトIDを変えると outbound 自動計測の有効/無効が変わる。変更時はクリック計測を再確認すること',
  )
  // 前提2: init に設定を渡して outboundLinks を上書きしていない。
  assert.ok(
    /plausible\.init\(\s*\)/.test(plausibleInit),
    'init() に設定オブジェクトを渡すと outboundLinks を上書きし得る',
  )
  assert.ok(
    !/outboundLinks/.test(plausibleInit),
    'plausible-init.js で outboundLinks に触れている。クリック計測の前提が変わっていないか確認すること',
  )
  // 前提3: Plausible の自動計測除外（plausible-event-* クラスが3階層以内）に該当しない。
  assert.ok(
    !/className="[^"]*plausible-event-/.test(cta),
    'plausible-event-* クラスが付くと Outbound Link 自動計測から除外される',
  )
})

test('明示クリックイベントを足していない（自動計測との二重計上を防ぐ）', () => {
  assert.ok(
    !cta.includes('uitruth_cta_click'),
    'Outbound Link 自動計測が効いている間は明示クリックイベントを足さない（総数が二重になる）',
  )
  assert.ok(
    !/onClick=/.test(cta),
    'クリック経路に介入しないこと（計測失敗で遷移が止まる余地を作らない）',
  )
})
