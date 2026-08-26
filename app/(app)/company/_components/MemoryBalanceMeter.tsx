'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { Card } from '@/components/ui/Card'

// ============================================================================
// MemoryBalanceMeter — 「Kabauが自社について覚えていること：N件」を常時表示する。
// ----------------------------------------------------------------------------
//   LTV施策(解約防止の主装置)。Kabauの価値は「使うほど自社を覚える＝乗り換えると
//   ゼロからやり直し」という沈没コストにある。それを毎週増える実数として見せ、
//   解約の心理的コストを上げる（ダークパターンではなく事実の可視化）。
//
//   - 実数は /api/company/memory/stats（記憶 + 自社ルール + オンボ登録属性の件数）。
//   - オンボ5問(company_attributes)も total に含むため、登録直後から 0件 にならない。
//   - 真に何も無いとき（属性も記憶も0）だけ煽らず「これから覚えていきます」と前向きに出す。
//   - クリックで /company/memory（会社の記憶）へ。中身を実際に確認できる導線にする。
//   - Phase1コンプラ: 断定/誇大なし。配色は @theme トークンのみ。
// ============================================================================

interface MemoryStats {
  total: number
  memories: number
  decisions: number
  rules: number
  profiles: number
  profileFacts: number
  /** 直近7日で増えた記憶の件数（D09）。旧APIレスポンス互換のため optional。 */
  weekDelta?: number
  /** 取り込んだ規程原文の本数（P1-2 内訳）。旧APIレスポンス互換のため optional。 */
  ruleDocs?: number
  /** 記憶に対象者ラベルが付いている人数（P1-2 内訳）。旧APIレスポンス互換のため optional。 */
  subjects?: number
}

export function MemoryBalanceMeter({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    fetch(`/api/company/memory/stats?companyId=${companyId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: MemoryStats) => {
        if (alive) setStats(data)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [companyId])

  // 取得失敗時はカードごと出さない（壊れた数字を見せない）。
  if (failed) return null

  const total = stats?.total ?? 0
  const decisions = stats?.decisions ?? 0
  const weekDelta = stats?.weekDelta ?? 0
  const ruleDocs = stats?.ruleDocs ?? 0
  const subjects = stats?.subjects ?? 0
  const loading = stats === null

  // P1-2: 記憶残高の内訳「規程n件・過去の判断n件・対象者n人」。0の項目は出さない
  //   （「規程0件」は不足の宣告になり、積み上げの実感を削ぐため）。
  const breakdown = [
    ruleDocs > 0 && `規程 ${ruleDocs}件`,
    decisions > 0 && `過去の判断 ${decisions}件`,
    subjects > 0 && `対象者 ${subjects}人`,
  ].filter(Boolean) as string[]

  return (
    <Link
      href={`/company/memory?companyId=${companyId}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label="会社の記憶を見る"
    >
      <Card interactive className="bg-brand-50/40">
        <div className="flex items-center gap-4">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <BantoMark className="h-5.5 w-5.5" aria-hidden />
            {/* 記憶が生きている（積み上がっている）ことを穏当な発光ドットで示す。 */}
            {!loading && total > 0 && (
              <span
                className="banto-live-dot absolute -right-0.5 -top-0.5 ring-2 ring-white"
                aria-hidden
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500">Kabauが自社について覚えていること</p>
            {loading ? (
              <p className="mt-0.5 text-sm text-neutral-400">読み込み中...</p>
            ) : total > 0 ? (
              <>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-neutral-900">{total}</span>
                  <span className="text-sm text-neutral-600">件</span>
                  {/* D09: 直近7日の増分。増えたときだけ出す（0や取得不可では出さない）。 */}
                  {weekDelta > 0 && (
                    <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-success-700">
                      先週比 +{weekDelta}
                    </span>
                  )}
                </p>
                {/* P1-2: 3内訳（規程・過去の判断・対象者）。総数の「中身」を見せて実在感を出す。 */}
                {breakdown.length > 0 && (
                  <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                    {breakdown.join('・')}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-700">
                相談を重ねるほど、自社のことを覚えていきます。
              </p>
            )}
          </div>
          <ArrowRight className="h-4.5 w-4.5 shrink-0 text-neutral-400" aria-hidden />
        </div>
        {!loading && total > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            相談・判断・規程を重ねるほど積み上がります。増えるほど、Kabauは御社専用に鋭くなります。
          </p>
        )}
      </Card>
    </Link>
  )
}
