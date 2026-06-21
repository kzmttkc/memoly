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
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 px-4 py-3"
      role="banner"
      aria-label="Cookie使用の通知"
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          本サービスはログイン状態の維持にCookieを使用します。Vercel Analyticsによる匿名の統計収集を行うことがあります。
          <Link href="/privacy" className="text-violet-400 underline ml-1">詳細</Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          同意する
        </button>
      </div>
    </div>
  )
}
