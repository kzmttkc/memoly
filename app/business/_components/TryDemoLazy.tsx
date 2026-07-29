'use client'

import dynamic from 'next/dynamic'
import { INDUSTRIES } from '../_lib/industries'

// ============================================================================
// TryDemoLazy — 体験デモ(TryDemo)を初期バンドルから外し、クライアントで遅延ロードする。
//   /business の SSR/初期JSペイロード削減（LP-4）。TryDemo はスクリプト型の状態機械で
//   最も重いクライアント部品だが、ヒーロー直下の非SEOなインタラクション要素なので
//   ssr:false で初期HTML/初期JSから切り離してよい（本文のSEOコンテンツは server 側で無傷）。
//
//   2026-07-29 CTO修正（UX監査Round6#2・最重要）: 従来のロード中フォールバックは
//   `py-16`の単一の空カード(h-[26rem])のみで、実コンポーネント（`py-20`・見出し3行・
//   業種タブ行・カード・質問チップ行・CTAブロックの合計、実測でカードだけでも
//   遥かに高い）とは高さも構造も大きく異なっていた。読み込み中の見た目からTryDemo本体
//   への差し替え時に大きなレイアウトシフト（CLS）が発生し、ユーザーが業種タブや
//   質問チップを狙ってクリックした直後に要素の位置がずれ、クリックが無関係な場所へ
//   落ちる（＝「業種タブが6回中5回無反応」の実体と判定）。実コンポーネントと同一の
//   見出しテキスト・業種タブ行（同じ業種数・同じラベル・同じ高さ）・カード外枠を
//   骨格として先に描画し、置き換わっても主要な操作対象の位置がずれないようにする。
// ============================================================================

const TryDemo = dynamic(() => import('./TryDemo'), {
  ssr: false,
  loading: () => (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">
          体験デモ
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          サンプル会社で、答え方の違いを試す
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          業種を選ぶと、その業種のサンプル会社の前提を踏まえて番頭がどう答えるかを体験できます。質問をクリックしてください。
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl" aria-hidden>
        {/* 業種タブ行のプレースホルダ（実コンポーネントと同じ高さ・同じ業種数） */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-neutral-400">業種</span>
          {INDUSTRIES.map(i => (
            <span
              key={i.key}
              className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs text-neutral-300 motion-safe:animate-pulse"
            >
              {i.label}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-md ring-1 ring-neutral-200/60 motion-safe:animate-pulse">
          <div className="h-[26rem] w-full bg-neutral-50" />
        </div>
      </div>
    </section>
  ),
})

export default function TryDemoLazy() {
  return <TryDemo />
}
