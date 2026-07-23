'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ============================================================================
// Cookie同意バナー（2026-07-22 CTO監査で position:fixed の重なり不具合を修正）
//   このバナーは fixed で画面最下部に張り付く。従来は body側に余白を確保しておらず、
//   未同意の初回訪問者には「/company のモバイル下部タブナビ」「/signup のログイン導線・
//   同意テキスト」「/blog のカード末尾」など、各ページの最下部コンテンツがバナーの
//   裏に隠れて操作/閲覧できなくなっていた（本番スクリーンショットで実測確認）。
//   ResizeObserver でバナー自身の実高さを測り、<body> に同じ分だけ padding-bottom を
//   確保することで、常にバナーの上に本来のコンテンツが見える状態を保証する。
//   同意後（show=false）は padding を確実に解除する。
// ============================================================================
export function CookieBanner() {
  const [show, setShow] = useState(false)
  const [tabbarOffset, setTabbarOffset] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 2026-07-23 ブランド移行: 旧キー memoly_cookie_accepted → banto_cookie_accepted。
    // 旧キーで同意済みの既存訪問者にバナーを再表示しないよう、旧キーがあれば
    // 新キーへ移行してから判定する（移行後は旧キーを削除）。
    let accepted = localStorage.getItem('banto_cookie_accepted')
    if (!accepted) {
      const legacy = localStorage.getItem('memoly_cookie_accepted')
      if (legacy) {
        localStorage.setItem('banto_cookie_accepted', legacy)
        localStorage.removeItem('memoly_cookie_accepted')
        accepted = legacy
      }
    }
    if (!accepted) setShow(true)
  }, [])

  useEffect(() => {
    if (!show || !ref.current) {
      document.body.style.paddingBottom = ''
      return
    }
    const el = ref.current
    // /company のモバイル下部タブバー（id="banto-mobile-tabbar"）が同じ画面にある場合、
    // タブバーが lg 未満でのみ描画される（lg 以上では display:none で offsetHeight=0）ため、
    // このオフセットは自動的にブレークポイントへ追従する。無ければ 0（従来通り最下部に張り付く）。
    const measure = () => {
      const tabbar = document.getElementById('banto-mobile-tabbar')
      setTabbarOffset(tabbar?.offsetHeight ?? 0)
      document.body.style.paddingBottom = `${el.offsetHeight + (tabbar?.offsetHeight ?? 0)}px`
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const tabbarEl = document.getElementById('banto-mobile-tabbar')
    if (tabbarEl) ro.observe(tabbarEl)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      document.body.style.paddingBottom = ''
    }
  }, [show])

  function accept() {
    localStorage.setItem('banto_cookie_accepted', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      ref={ref}
      style={{ bottom: tabbarOffset }}
      className="fixed left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] px-4 py-3"
      role="banner"
      aria-label="Cookie使用の通知"
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-neutral-600 leading-relaxed">
          本サービスはログイン状態の維持にCookieを使用します。アクセス解析はPlausible Analytics（Cookie不使用・匿名計測）で行っています。
          <Link href="/privacy" className="text-brand-600 underline ml-1">詳細</Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          同意する
        </button>
      </div>
    </div>
  )
}
