'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain } from 'lucide-react'
import { Card } from '@/components/ui/Card'

// ============================================================================
// MemoryLossWarning — 解約導線の手前に出す「記憶喪失」の正規な引き止め。
// ----------------------------------------------------------------------------
//   LTV施策(解約時の記憶喪失警告)。番頭の価値は積み上げた自社の記憶にあり、
//   解約＝その記憶が前提として使えなくなることを、事実として穏当に伝える。
//
//   ダークパターンにしない方針:
//     - 不安を煽らない／カウントダウン・点滅・赤の警告色は使わない。
//     - 「失われます」と断定で脅さず、「使えなくなります／引き継ぎ書き出しができます」と
//       選択肢（記憶のエクスポート導線＝/company/memory）を必ず併設する。
//     - 解約ボタンを隠さない・押しにくくしない（これは別UIの責務。ここは情報提供のみ）。
//
//   表示条件: 課金中（plan!==free かつ status==='active'）の admin のみ。
//   記憶が0件なら何も出さない（守るものが無いのに引き止めない）。
//   実数は /api/company/memory/stats（記憶残高メーターと同じソース）。
// ============================================================================

interface MemoryStats {
  total: number
  decisions: number
}

export function MemoryLossWarning({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState<MemoryStats | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    fetch(`/api/company/memory/stats?companyId=${companyId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: MemoryStats) => {
        if (alive) setStats(data)
      })
      .catch(() => {
        /* 取得失敗時は出さない */
      })
    return () => {
      alive = false
    }
  }, [companyId])

  // 記憶が無ければ引き止めない。
  if (!stats || stats.total <= 0) return null

  return (
    <Card className="mb-6 border-neutral-200 bg-neutral-50">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Brain className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            解約すると、番頭が御社について覚えた {stats.total}件の記憶が使えなくなります
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
            {stats.decisions > 0 && `過去に下した判断 ${stats.decisions}件を含む、`}
            これまで積み上げた自社ルール・相談の記憶は、番頭がそれを前提に回答するための土台です。
            解約後は新しい相談でこれらを前提にできなくなります。
            必要なら、解約の前に
            <Link
              href={`/company/memory?companyId=${companyId}`}
              className="mx-1 font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              会社の記憶を確認・書き出し
            </Link>
            しておけます。
          </p>
        </div>
      </div>
    </Card>
  )
}
