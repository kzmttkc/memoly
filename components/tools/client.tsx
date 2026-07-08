'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { track } from '@/lib/analytics'

// ============================================================================
// 無料セルフ点検ツール 共通シャーシ（クライアント計装・共通文言部）
//   実在2ツールの Calculator.tsx で文字どおり同一だった部分を抽出:
//     - tool_open 計装（初回マウントで1回）
//     - 「ブラウザ内計算・非送信」の共通注記
//     - 結果の免責（先頭文が共通・確認先だけツールごとに差し替え）
//     - 番頭 登録CTA（結果末尾に1本・高痛点/低痛点で文言を出し分ける枠）
//   計測イベントの語彙は既存のまま: tool_open / tool_completed / signup_cta_clicked。
//   tool_completed の status 分岐は計算仕様に密結合のため各ツール側に残す。
// ============================================================================

/** tool_open 計装。初回マウントで1回だけ発火（既存2ツールと同一挙動）。 */
export function useToolOpen(tool: string) {
  useEffect(() => {
    track('tool_open', { tool })
  }, [tool])
}

/** 入力フォーム末尾の共通注記（ブラウザ内計算・非送信）。 */
export function LocalOnlyNote() {
  return (
    <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
      入力した内容はこのブラウザの中だけで計算します。会社や社員のデータをサーバーに送ることはありません。
    </p>
  )
}

/** 結果末尾の免責。先頭文は共通・2文目（確認先）だけツールごとに渡す。 */
export function ResultDisclaimer({ detail }: { detail: string }) {
  return (
    <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
      {`この点検は、入力内容をもとにした一般的な目安の整理で、合否や適法性を判定するものではありません。 ${detail}`}
    </p>
  )
}

// 結果末尾の番頭登録CTA（枠）。
//   高痛点/低痛点の文言出し分け・status はツール側で決めて渡す（1変数のみ変更の流儀）。
//   Phase1/景表法厳守: 「違反判定/解消」「社労士監修」は書かず、実挙動どおりの約束に留める。
export function ToolSignupCta({
  href,
  location,
  status,
  title,
  body,
  label = '番頭に無料登録する',
}: {
  href: string
  /** signup_cta_clicked の location（ツール識別子） */
  location: string
  /** tool_completed と同じ分岐キー（高痛点コホートの登録CTR比較用） */
  status: string
  title: string
  body: string
  label?: string
}) {
  return (
    <div className="mt-5 rounded-2xl bg-brand-50 p-5">
      <p className="text-sm font-semibold text-neutral-900">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        {body}
      </p>
      <Link
        href={href}
        onClick={() => track('signup_cta_clicked', { location, status })}
        className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-4' })}
      >
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  )
}
