'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('memoly_cookie_accepted')
    if (!accepted) setShow(true)
  }, [])

  function accept() {
    localStorage.setItem('memoly_cookie_accepted', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] px-4 py-3"
      role="banner"
      aria-label="Cookie使用の通知"
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-neutral-600 leading-relaxed">
          本サービスはログイン状態の維持にCookieを使用します。Vercel Analyticsによる匿名の統計収集を行うことがあります。
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
