'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Globe } from 'lucide-react'

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

// 2026-08-12 UXペルソナ監査 R-12（イライラ級）: /business は 375px で 21,466px あり、
//   H2「実際の使われ方」(y=3,632) と H2「汎用AIとの違い」(y=7,702) のあいだが
//   4,070px（6画面分）見出し無しで続く。ここを下降中の読者は「今どこか／あと何個か」を
//   完全に失う。「先頭へ戻る」(BackToTop) は戻る手段であって現在地の地図ではない。
//   ハンバーガーは既にモバイルの唯一のナビ入口なので、そこにページ内目次を足す
//   （新しいUIを増やさない）。id は page.tsx / ScenarioSection.tsx の各 section に付与。
const SECTIONS = [
  { href: '#demo', label: 'サンプル会社で試す' },
  { href: '#cases', label: '実際の使われ方' },
  { href: '#vs-ai', label: '汎用AIとの違い' },
  { href: '#features', label: 'できること' },
  { href: '#handover', label: '社労士に渡すメモ' },
  { href: '#security-info', label: 'セキュリティ' },
  { href: '#compare', label: '他システムとの違い' },
  // 2026-07-28 CTO修正（L1監査#5）: モバイルもハンバーガーから料金へ直接届くようにする。
  { href: '#pricing', label: '料金' },
  { href: '#faq', label: 'よくある質問' },
] as const

// 2026-07-29 CTO修正（UX監査Round4#6・重大）: デスクトップ版EN/JPトグル
//   （page.tsx）は `hidden sm:inline-flex` でモバイルには一切出ておらず、
//   モバイルからのJP→EN導線が構造的にゼロだった（EN側は /business/en に
//   別途JP導線があり、そちらは機能していたため「EN→JPは動くがJP→ENは動かない
//   一方通行」に見えていた＝ペルソナ4指摘）。ハンバーガーの通常リンクとは
//   別扱い（見た目で言語切替と分かるようGlobeアイコン付き）にする。

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        // 2026-07-30 UX監査 #8: 32x32 しかなく、モバイルの主要ナビ入口が最も押しにくい
        //   要素だった（推奨44px）。この親は sm:hidden＝モバイル専用なので常に 44px。
        className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
          <div className="absolute inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-neutral-200 bg-white shadow-sm">
            <nav className="mx-auto flex max-w-5xl flex-col px-6 py-2">
              <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                このページの中身
              </p>
              {SECTIONS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {l.label}
                </a>
              ))}
              <p className="mt-2 border-t border-neutral-200 px-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                ほかのページ
              </p>
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
              <Link
                href="/business/en"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Globe className="h-4 w-4" aria-hidden />
                English
              </Link>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
