'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

// ============================================================================
// BackToTop — 長尺LPの「先頭へ戻る」フローティングボタン（2026-08-11 UI監査#2）。
//
//   背景: /business は 375px 幅で 21,296px（約26画面分）あり、途中まで読んだ読者が
//   ヘッダのCTAや目的のセクションへ戻るのに延々スワイプするしかなかった。既存の
//   ScrollProgress は「どれくらい進んだか」は示すが「戻る手段」ではない。目次(TOC)は
//   情報設計の変更が大きいため採らず、戻る手段だけを足す。
//
//   設計:
//   - 一定量スクロールしてから出現（SHOW_AFTER_PX）。FV圏内では出さない＝主CTAと競合しない。
//   - スクロール監視は passive + requestAnimationFrame で1フレーム1回に間引く
//     （ScrollProgress と同じ作法）。state は真偽値のみで、値が変わらない限り
//     React の再レンダリングは走らない。
//   - prefers-reduced-motion: reduce のときは smooth スクロールもフェードもしない
//     （クリック時に毎回 matchMedia を読み直すので、OS設定の途中変更にも追随する）。
//   - タップ目標 44x44px 以上（h-12 w-12 = 48px）。
//   - aria-label 付きのネイティブ <button>。非表示中は inert 相当（hidden 属性）に
//     して、キーボードのタブ順にも支援技術にも現れないようにする。
//   - 画面最下部の固定要素（Cookie同意バナー = components/ui/CookieBanner.tsx。
//     未同意の初回訪問者には常時表示される）と重ならないよう、その高さぶん持ち上げる。
//     初版は bottom-6 固定で実装したが、375px の Playwright 実測で
//     「バナーがボタンの pointer events を奪いクリック不能」を検出したため修正した。
//     高さの取得元は body の padding-bottom。CookieBanner が ResizeObserver で
//     自身（＋/company のモバイルタブバー）の実高さを測って書き込んでおり、
//     このリポで「下部に居座る固定UIの総高さ」の唯一の書き手＝実質のSSOTになっている
//     （grep 実測: body.style を書くのは CookieBanner のみ）。バナーの出現・消滅は
//     body の style 属性変化として MutationObserver で拾う。
//   - クリック後はヘッダ先頭のロゴリンク（id="page-top"）へフォーカスを移す。これを
//     しないと、キーボード利用者は視覚的にはページ先頭にいるのにタブ順だけページ
//     末尾に取り残される。preventScroll でフォーカス由来の二重スクロールを避ける。
//   - 色は既存トークンのみ（白地・neutral 罫・brand-700 のアイコン）。新色は作らない。
// ============================================================================

/** これ以上スクロールしたら出現する（px）。FV+デモ帯を抜けたあたり。 */
const SHOW_AFTER_PX = 1200

/** 画面下端からの基本マージン（px）。Tailwind の bottom-6 相当。 */
const BASE_GAP_PX = 24

export default function BackToTop() {
  const [visible, setVisible] = useState(false)
  const [bottomChrome, setBottomChrome] = useState(0)
  const rafRef = useRef(0)

  // 下部固定UI（Cookieバナー等）の高さを追う。
  useEffect(() => {
    const measure = () => {
      const pb = parseFloat(getComputedStyle(document.body).paddingBottom || '0')
      setBottomChrome(Number.isFinite(pb) ? pb : 0)
    }
    measure()
    const mo = new MutationObserver(measure)
    mo.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    window.addEventListener('resize', measure)
    return () => {
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    const update = () => {
      rafRef.current = 0
      setVisible(window.scrollY > SHOW_AFTER_PX)
    }
    const onScroll = () => {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const handleClick = () => {
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    // ページ先頭（ヘッダのロゴリンク）へフォーカスを戻す。見つからなくても
    // スクロール自体は済んでいるので、視覚的な挙動は壊れない。
    const top = document.getElementById('page-top')
    if (top instanceof HTMLElement) top.focus({ preventScroll: true })
  }

  return (
    <button
      type="button"
      hidden={!visible}
      onClick={handleClick}
      aria-label="ページの先頭へ戻る"
      style={{ bottom: BASE_GAP_PX + bottomChrome }}
      className="fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-500 bg-white/95 text-brand-700 shadow-md backdrop-blur transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:right-6"
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  )
}
