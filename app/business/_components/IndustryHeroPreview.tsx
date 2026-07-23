'use client'

import { useState } from 'react'
import { Brain, Building2 } from 'lucide-react'
import { trackV as track } from '../_lib/variant'
import {
  INDUSTRIES,
  DEFAULT_INDUSTRY,
  getIndustry,
  type IndustryKey,
} from '../_lib/industries'

// ============================================================================
// IndustryHeroPreview — ヒーロー右側の製品プレビュー（A14+B13+I01・2026-07-23）。
//   従来の ProductPreview（page.tsx 内・製造業固定）を置き換える。
//     - 業種タブ（製造/飲食/IT/介護）で、覚えているプロファイルと1往復の
//       質問・回答例が切り替わる。「自分の業種でも前提を覚えてくれる」を
//       着地直後に体感させる。
//     - I01: 背面グロー装飾と重いカード枠を外し、フラットな1枚のパネルに整理
//       （ヒーローのカード過多を減らす）。
//   計測: 新イベント名は増やさない。タブ切替は既存語彙 demo_question_clicked に
//   source='hero_tab' と industry を props で載せて分離する（既存デモの集計は
//   source 無し/『demo』のままなので汚れない）。
//   SSR: 初期表示は製造（従来と同一内容）＝A/BテストのFV体験を変えない。
// ============================================================================

export default function IndustryHeroPreview() {
  const [key, setKey] = useState<IndustryKey>(DEFAULT_INDUSTRY)
  const ind = getIndustry(key)

  const select = (next: IndustryKey) => {
    if (next === key) return
    setKey(next)
    track('demo_question_clicked', { source: 'hero_tab', industry: next })
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* 業種タブ（A14）: 「自分の業種の前提で答える」を切替で見せる */}
      <div
        role="tablist"
        aria-label="業種を選んで答え方の例を見る"
        className="mb-2 flex items-center gap-1"
      >
        <span className="mr-1 text-[11px] font-medium text-neutral-400">業種の例</span>
        {INDUSTRIES.map(i => (
          <button
            key={i.key}
            type="button"
            role="tab"
            aria-selected={i.key === key}
            onClick={() => select(i.key)}
            className={
              i.key === key
                ? 'rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white'
                : 'rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] text-neutral-500 transition-colors hover:border-brand-300 hover:text-brand-700'
            }
          >
            {i.label}
          </button>
        ))}
      </div>

      {/* パネル本体（I01: グロー・多重カードを排したフラットな1枚） */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* ウィンドウバー */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
            <Brain className="h-3 w-3" aria-hidden />
          </span>
          <span className="text-xs font-semibold text-neutral-700">番頭</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
            記憶あり
          </span>
        </div>

        <div className="space-y-3 px-4 py-4">
          {/* 覚えている会社プロファイル */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              覚えている自社プロファイル
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ind.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 tabular-nums"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ユーザーの質問（右寄せ吹き出し） */}
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
              {ind.hero.q}
            </p>
          </div>

          {/* 番頭の回答（左寄せ・自社前提の一句を強調） */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Brain className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
              {ind.hero.aPre}
              <span className="font-semibold text-neutral-900">{ind.hero.aEm}</span>
              {ind.hero.aPost}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
