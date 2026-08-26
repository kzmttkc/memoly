'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

// ============================================================================
// UitruthCrossCta — 公開フッタの常設クロス送客枠（同じ運営の UITruth へ）。
//
//   なぜ切り出すか: 2026-08-20 にこの枠を PublicFooter へ足したが、表示もクリックも
//   イベントを1本も出しておらず効果が測れなかった（Plausible 実測でKabauホストの
//   当日イベントは pageview / demo_autoplayed / kasuhara_selfcheck_item_toggled のみ）。
//   計測には useEffect が要るが、PublicFooter は約20の公開ページから読まれる
//   サーバーコンポーネントで、'use client' を足すとフッタ全体（と各ページの静的性）に
//   影響が及ぶ。そこで**この枠だけ**をクライアント境界に切り出す。
//   TrackedCTA（/business の signup CTA）と同じ設計思想＝見た目・href は不変。
//
//   計測の対応関係（sharoushi 側と揃える。横比較のため意図的に同名）:
//     - 表示: uitruth_cta_view / props {source:'footer_perm', site:'banto'}
//       sharoushi は site/js/actions.js の [data-track-view] が threshold 0.4 で
//       1回だけ発火する（props は {source:'footer_perm'}）。同じ閾値・同じ
//       「1回だけ」規則を React 側で再実装する。site prop だけを足して分離する。
//     - クリック: 明示イベントは足さない。Kabauと sharoushi は同一の Plausible
//       スクリプト（pa-zK4ObFABW1NCS-rSYTlSn.js）を読んでおり、その設定は
//       outboundLinks:!0（有効）。Kabauの plausible-init.js は init() に上書き設定を
//       渡さないため、外部リンククリックは "Outbound Link: Click"（props.url に
//       utm 込みの完全 URL）として自動計測される。url の utm_source が
//       banto / sharoushi を分けるので、両サイトを同一イベントで横比較できる。
//       ※自動計測の除外条件は「plausible-event-* クラスが3階層以内にある」ことだけで、
//         この枠は該当しない。イベントを二重に立てると総数が二重計上になるため足さない。
//
//   ユーザー体験: 計測は表示側の1発だけで、クリック経路には一切介入しない
//   （onClick を持たない＝計測が失敗しても遷移は絶対に止まらない）。
//   IntersectionObserver 非対応環境では黙って計測を諦める
//   （マウント即発火にして「見られていないものを見られた」と数える方が有害）。
// ============================================================================

/** UITruth 送客先。utm はここでしか持たない（クリック計測の識別子を兼ねる）。 */
export const UITRUTH_HREF =
  'https://uitruth.app/?utm_source=banto&utm_medium=referral&utm_campaign=footer_perm'

export function UitruthCrossCta() {
  const boxRef = useRef<HTMLDivElement>(null)
  // React StrictMode の二重マウントやスクロール往復で重複発火させないためのガード。
  const firedRef = useRef(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
    if (firedRef.current) return
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          io.unobserve(e.target)
          if (firedRef.current) return
          firedRef.current = true
          // track() 側で try/catch 済み。計測失敗は描画に影響しない。
          track('uitruth_cta_view', { source: 'footer_perm', site: 'banto' })
        }
      },
      // sharoushi 側 [data-track-view] と同じ閾値（4割見えたら「見られた」）。
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={boxRef}
      className="mb-8 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-600"
    >
      ChatGPTはあなたの会社をどう紹介していますか？ 登録不要・無料で計測できます。{' '}
      <a
        href={UITRUTH_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center font-semibold text-neutral-700 underline underline-offset-2 hover:text-brand-700 sm:min-h-0"
      >
        uitruth.app で計測する →
      </a>
      <span className="ml-1 text-xs text-neutral-400">（同じ運営のサービス）</span>
    </div>
  )
}
