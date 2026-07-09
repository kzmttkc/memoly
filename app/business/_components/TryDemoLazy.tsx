'use client'

import dynamic from 'next/dynamic'

// ============================================================================
// TryDemoLazy — 体験デモ(TryDemo)を初期バンドルから外し、クライアントで遅延ロードする。
//   /business の SSR/初期JSペイロード削減（LP-4）。TryDemo はスクリプト型の状態機械で
//   最も重いクライアント部品だが、ヒーロー直下の非SEOなインタラクション要素なので
//   ssr:false で初期HTML/初期JSから切り離してよい（本文のSEOコンテンツは server 側で無傷）。
//   ロード中は同じ高さのスケルトンを出してレイアウトシフトと #demo アンカーを保つ。
// ============================================================================

const TryDemo = dynamic(() => import('./TryDemo'), {
  ssr: false,
  loading: () => (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div
        aria-hidden
        className="h-[26rem] w-full rounded-2xl border border-neutral-200 bg-neutral-50 motion-safe:animate-pulse"
      />
    </section>
  ),
})

export default function TryDemoLazy() {
  return <TryDemo />
}
