'use client'

import { useState } from 'react'
import { MessageSquareText, Check, X } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// CompareToggle — 「汎用AI vs 番頭」のインタラクティブ比較（B05 軽量版・2026-07-23）。
//   同じ質問に対する回答の違いを、トグルで切り替えて見せる。動画は作らない。
//   従来の静的2カード（箇条書きの主張）を、実際の会話例による「見て分かる」対比に
//   置き換える＝主張でなく挙動で差を示す。
//
//   誠実性: どちらの回答も様式化した例。汎用AI側は「間違える」姿ではなく
//   「前提を聞き返す」姿で描く（実際の挙動として妥当な範囲・貶めない）。
//   番頭側の回答はデモと同じ製造業サンプルの前提に基づく一般情報。
//
//   no-JS/SEO: 両方の回答を常に DOM に置き、hidden クラスの付け替えだけで切替。
//   計測: 新イベント名は増やさない。demo_question_clicked に source='compare' を
//   props で載せる（既存デモ集計とはpropsで分離）。
// ============================================================================

const QUESTION = '来週、うちは残業させても大丈夫？'

type Side = 'generic' | 'banto'

export default function CompareToggle() {
  const [side, setSide] = useState<Side>('generic')

  const select = (next: Side) => {
    if (next === side) return
    setSide(next)
    track('demo_question_clicked', { source: 'compare', industry: 'seizo' })
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* トグル */}
      <div
        role="tablist"
        aria-label="同じ質問への回答を比べる"
        className="mx-auto mb-4 flex w-fit rounded-full border border-neutral-200 bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={side === 'generic'}
          onClick={() => select('generic')}
          className={
            side === 'generic'
              ? 'flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-semibold text-white'
              : 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:text-neutral-800'
          }
        >
          <MessageSquareText className="h-4 w-4" aria-hidden />
          汎用AIに聞くと
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'banto'}
          onClick={() => select('banto')}
          className={
            side === 'banto'
              ? 'flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white'
              : 'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:text-brand-700'
          }
        >
          <BantoMark className="h-4 w-4" aria-hidden />
          番頭に聞くと
        </button>
      </div>

      {/* 会話パネル（両側とも常にDOMに保持し、hidden で切替） */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="space-y-3 px-4 py-4">
          {/* 共通の質問 */}
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
              {QUESTION}
            </p>
          </div>

          {/* 汎用AIの回答: 前提の聞き返しが先に来る */}
          <div className={side === 'generic' ? 'flex items-start gap-2' : 'hidden'}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-600">
              会社の状況によります。判断のため、次を教えてください。
              (1) 業種と従業員数 (2) 所定労働時間と休日 (3) 36協定を締結・届出済みか
              (4) 締結済みなら上限時間の定め。これらが分かれば具体的に検討できます。
            </div>
          </div>

          {/* 番頭の回答: 覚えている前提から直接答える */}
          <div className={side === 'banto' ? 'flex items-start gap-2' : 'hidden'}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
              自社は<span className="font-semibold text-neutral-900">36協定が未締結</span>
              なので、現状のまま残業をさせると労働基準法に触れるおそれがあります。まず過半数代表の選出と協定の締結・届出から。手順を出しましょうか。
              <span className="text-neutral-500">（一般的な情報です）</span>
            </div>
          </div>
        </div>

        {/* 差分の一行キャプション */}
        <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-2.5">
          <p
            className={
              side === 'generic'
                ? 'flex items-center gap-1.5 text-xs text-neutral-500'
                : 'hidden'
            }
          >
            <X className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
            答えの前に、毎回この聞き返しに答える往復が入ります。
          </p>
          <p
            className={
              side === 'banto'
                ? 'flex items-center gap-1.5 text-xs text-neutral-600'
                : 'hidden'
            }
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
            前提は覚えているので、1通目から自社の状況に沿った答えが返ります。
          </p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500">
        どちらも回答の一例です。番頭の回答は一般的な情報提供であり、個別の法的助言ではありません。
      </p>
    </div>
  )
}
