'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { track } from '@/lib/analytics'
import { useToolOpen } from '@/components/tools/client'

// ============================================================================
// KasuharaSelfCheck — /roumu/kasuhara-gimuka-2026 専用の登録不要セルフ点検
//   (2026-08-03 WORK_ORDERS.md #3「番頭のカスハラページに軽い次の一手を置く」)
//
//   背景: 全流入60訪問/週のうち45がこのLPに集中し直帰98%（2026-07-30実測）。
//   ページは壊れていない（HTTP 200・本文正常）が、次の一手が「無料で会社を
//   登録して試す」という最も重い行動しか無かった。登録不要でその場で完結する
//   軽い導線として、本文にすでにある「社内対応チェックリスト」5項目
//   （lib/usecase.ts kasuhara-gimuka-2026 の既存テキストと同一。新規コピー
//   ではない）をチェック式にして、重いCTAより上（ヒーローのCTA行の直前）に置く。
//
//   計測（既存語彙を踏襲）:
//     - tool_open { tool: 'kasuhara_selfcheck' }（components/tools/client.tsx
//       の共通シャーシを流用。初回マウントで1回）
//     - kasuhara_selfcheck_item_toggled { checked_count }（初回チェックのみ1回）
//     - pack_lp_from_banto { remaining_count }（sharoushi有料パックCTAクリック。
//       WORK_ORDERS.md 指定の識別子をイベント名にそのまま使い、Plausibleで直接追える）
//
//   非保存: 状態はコンポーネント内メモリのみ。サーバー送信・localStorage永続化
//   なし（会社データを扱わない＝「登録不要」の約束と実挙動を一致させる）。
// ============================================================================

// 本文の「社内対応チェックリスト」（同ページ下部セクション）と同一の5項目。
// 新規に書き起こしたものではない（lib/usecase.ts kasuhara-gimuka-2026 の
// sections 内、社内対応チェックリストの箇条書きから「・」を除いただけ）。
const ITEMS = [
  'カスハラに対する会社の方針を文書で明示しているか（就業規則・社内通知など）',
  '従業員向けの相談窓口を決め、周知しているか（担当・連絡方法・記録の残し方）',
  '迷惑行為があったときの対応手順を決めているか（一次対応・記録・引き継ぎ・外部連絡の判断）',
  '被害を受けた従業員への配慮（安全確保・メンタル面のフォロー）を用意しているか',
  '現場の担当者が方針と手順を理解しているか（周知・簡単な研修）',
]

// sharoushi有料パックへのリンク先・文言はWORK_ORDERS.mdで確定済みのものをそのまま使う。
const PACK_HREF =
  'https://sharoushi-agent.com/kasuhara-pack.html?utm_source=banto&utm_medium=referral&utm_campaign=kasuhara_pack'
const PACK_COPY =
  '10の措置のうち自社に足りないものを特定して期限までに揃えるなら、書式一式（19,800円・税込）があります'

export default function KasuharaSelfCheck() {
  useToolOpen('kasuhara_selfcheck')
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false))
  const [toggledOnce, setToggledOnce] = useState(false)

  const doneCount = useMemo(() => checked.filter(Boolean).length, [checked])
  const remaining = ITEMS.length - doneCount

  function toggle(i: number) {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      const nextDone = next.filter(Boolean).length
      if (!toggledOnce) {
        setToggledOnce(true)
        track('kasuhara_selfcheck_item_toggled', { checked_count: nextDone })
      }
      return next
    })
  }

  return (
    <Card padded className="mt-7">
      <p className="text-xs font-medium text-brand-700">無料ツール</p>
      <h2 className="mt-1 text-base font-semibold text-neutral-900">社内対応チェックリスト</h2>
      <p className="mt-1 text-xs text-neutral-500">
        登録不要。整っている項目にチェックを入れてください（ブラウザ内のみで完結し、送信・保存はしません）。
      </p>
      <ul className="mt-4 space-y-3">
        {ITEMS.map((item, i) => (
          <li key={item}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 h-5 w-5 flex-none rounded border-neutral-500 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm leading-relaxed text-neutral-700">{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-neutral-100 pt-4 text-sm font-medium text-neutral-900">
        {doneCount === 0
          ? `${ITEMS.length}項目のうち、まだチェックが入っていません。`
          : remaining === 0
            ? `${ITEMS.length}項目すべてにチェックが入りました。`
            : `${ITEMS.length}項目のうち${remaining}項目が未チェックです。`}
      </p>

      {/* ===== sharoushi有料パックへの導線（文言・リンク先はWORK_ORDERS.md指定のまま） ===== */}
      <Card interactive padded={false} className="mt-4 border-brand-100 bg-brand-50/60">
        <a
          href={PACK_HREF}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('pack_lp_from_banto', { remaining_count: remaining })}
          className="flex items-start justify-between gap-3 p-4 sm:p-5"
        >
          <p className="text-sm leading-relaxed text-neutral-800">{PACK_COPY}</p>
          <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-brand-700" aria-hidden />
        </a>
      </Card>
    </Card>
  )
}
