'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

// ============================================================================
// MobileNav — 公開LP(/business)ヘッダのモバイル用ナビ（2026-07-24 P02）。
//   Loop1 でヘッダに常設した「無料ツール」「労務の記事」は sm 未満で
//   `hidden sm:inline-flex` により非表示になり、登録前のモバイル客（375px）が
//   ヘッダから主要導線へ届かなかった（Loop2 P02 実測・ハンバーガー無し）。
//   この穴だけを埋める最小のハンバーガー開閉。sm 以上では自身が `hidden` になり、
//   デスクトップ導線（page.tsx の hidden sm:inline-flex リンク）を一切壊さない。
//
//   ラベル・リンク先は page.tsx のデスクトップ導線と一致させる。計測なし・
//   内部 Link のみ（既存のヘッダ／下部のツール・記事リンクと同じ素の遷移）。
//   パネルは sticky ヘッダ（position:sticky＝配置コンテキスト）基準の absolute で
//   ヘッダ直下(top-16)にフル幅展開。背景タップで閉じる。
// ============================================================================

const LINKS = [
  { href: '/tools', label: '無料ツール' },
  { href: '/roumu', label: '労務の記事' },
] as const

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>
      {open && (
        <>
          {/* 背景タップで閉じる透明オーバーレイ */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div className="absolute inset-x-0 top-16 z-50 border-b border-neutral-200 bg-white shadow-sm">
            <nav className="mx-auto flex max-w-5xl flex-col px-6 py-2">
              {LINKS.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
