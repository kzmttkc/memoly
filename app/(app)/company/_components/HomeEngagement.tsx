'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  BookOpenCheck,
  CalendarClock,
  Check,
  Flame,
  MessageSquareText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'

// ============================================================================
// HomeEngagement — ホームの継続利用装置（外部評価 D10/D14/D16/D17+C13）。
//   /api/company/home-status を1回だけ叩き、以下を出し分ける:
//     1. D17+C13 初回チェックリスト（診断1回/規程を覚えさせる/相談3回）。
//        未完了の間はホーム最上部に常設し、先頭に「今日やること1つ」を明示。
//        3つ完了したら出さない（卒業＝以後は能動フィードが主役）。
//     2. D10 連続利用ストリーク（2日以上のときだけ軽く提示・煽らない）。
//     3. D14 リスク診断の前回比（再診断が2回以上あるときだけ）。
//     4. D16(最小形) 通知: 近づいている期限の集約表示（あるときだけ）。
//   すべてベストエフォート: 取得失敗時は何も出さない（ホームの他要素を妨げない）。
// ============================================================================

interface HomeStatus {
  risk: {
    count: number
    latest: { overall: number; at: string } | null
    previous: { overall: number; at: string } | null
  }
  ruleDocs: number
  consult: { userMessageCount: number; consultDays: number; streak: number }
  deadlines: { id: string; title: string; dueOn: string }[]
}

/** 残り日数（当日=0）。deadlines ページの daysUntil と同じ計算。 */
function daysUntil(dueOn: string): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`)
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((due - today) / (24 * 60 * 60 * 1000))
}

export function HomeEngagement({ companyId }: { companyId: string }) {
  const [status, setStatus] = useState<HomeStatus | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    fetch(`/api/company/home-status?companyId=${companyId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: HomeStatus) => {
        if (alive) setStatus(data)
      })
      .catch(() => {
        /* 取得失敗時は何も出さない（ベストエフォート） */
      })
    return () => {
      alive = false
    }
  }, [companyId])

  if (!status) return null

  // ---- D17: チェックリストの3ステップ（達成条件は実データで判定） ----
  const steps = [
    {
      done: status.risk.count > 0,
      label: '労務リスク診断を1回やってみる',
      hint: '5分で自社の現在地がわかります',
      href: `/company/risk?companyId=${companyId}`,
      cta: '診断を始める',
      icon: ShieldCheck,
    },
    {
      done: status.ruleDocs > 0,
      label: '就業規則などの規程を番頭に覚えさせる',
      hint: '貼り付けるだけで、以後の相談が自社前提になります',
      href: `/company/documents?companyId=${companyId}`,
      cta: '規程を取り込む',
      icon: BookOpenCheck,
    },
    {
      done: status.consult.userMessageCount >= 3,
      label: `労務の疑問を3回相談する（いま${Math.min(status.consult.userMessageCount, 3)}/3回）`,
      hint: '相談するほど番頭が自社を覚えます',
      href: `/company/chat?companyId=${companyId}`,
      cta: '相談する',
      icon: MessageSquareText,
    },
  ]
  const firstTodo = steps.find(s => !s.done)
  const doneCount = steps.filter(s => s.done).length

  const riskDiff =
    status.risk.latest && status.risk.previous
      ? status.risk.latest.overall - status.risk.previous.overall
      : null

  return (
    <div className="space-y-4">
      {/* ---- D17+C13: 最初の7日間チェックリスト（未完了の間だけ常設） ---- */}
      {firstTodo && (
        <Card className="border-brand-200 bg-brand-50/40">
          {/* C13: 最上部は「今日やること1つ」に絞る。 */}
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            今日やること
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{firstTodo.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{firstTodo.hint}</p>
            </div>
            <Link
              href={firstTodo.href}
              className={buttonClass({ variant: 'primary', className: 'shrink-0' })}
            >
              <firstTodo.icon className="h-4 w-4" aria-hidden />
              {firstTodo.cta}
            </Link>
          </div>

          {/* 全体の進み（3ステップ）。 */}
          <div className="mt-4 border-t border-brand-100 pt-3">
            <p className="mb-2 text-xs text-neutral-500">
              番頭を使いこなす最初の3ステップ（{doneCount}/3 完了）
            </p>
            <ul className="space-y-1.5">
              {steps.map(s => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      s.done
                        ? 'grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success-500 text-white'
                        : 'h-4 w-4 shrink-0 rounded-full border border-neutral-300 bg-white'
                    }
                    aria-hidden
                  >
                    {s.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={s.done ? 'text-neutral-400 line-through' : 'text-neutral-700'}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* ---- D10: 連続利用ストリーク（2日以上のときだけ・軽く） ---- */}
      {status.consult.streak >= 2 && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-600">
          <Flame className="h-3.5 w-3.5 text-warning-600" aria-hidden />
          {status.consult.streak}日続けて相談しています。番頭が覚える自社の情報も増えています。
        </p>
      )}

      {/* ---- D14: リスク診断の前回比（2回以上診断したときだけ） ---- */}
      {riskDiff !== null && status.risk.latest && (
        <Card className="py-4">
          <div className="flex items-center gap-3">
            {riskDiff >= 0 ? (
              <TrendingUp className="h-5 w-5 shrink-0 text-success-600" aria-hidden />
            ) : (
              <TrendingDown className="h-5 w-5 shrink-0 text-danger-600" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">リスク診断スコア（前回比）</p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums text-neutral-900">
                  {status.risk.latest.overall}
                </span>
                <span className="text-xs text-neutral-500">/100</span>
                <span
                  className={
                    riskDiff >= 0
                      ? 'text-xs font-medium tabular-nums text-success-700'
                      : 'text-xs font-medium tabular-nums text-danger-600'
                  }
                >
                  {riskDiff >= 0 ? `前回より +${riskDiff}` : `前回より ${riskDiff}`}
                </span>
              </p>
            </div>
            <Link
              href={`/company/risk?companyId=${companyId}`}
              className={buttonClass({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}
            >
              再診断する
            </Link>
          </div>
        </Card>
      )}

      {/* ---- D16(最小形): 近づいている期限の集約（あるときだけ） ---- */}
      {status.deadlines.length > 0 && (
        <Card className="py-4">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand-600" aria-hidden />
            <p className="text-sm font-semibold text-neutral-900">近づいている期限</p>
          </div>
          <ul className="space-y-1.5">
            {status.deadlines.map(d => {
              const du = daysUntil(d.dueOn)
              return (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-neutral-700">{d.title}</span>
                  <Badge tone={du <= 7 ? 'warning' : 'neutral'}>
                    <CalendarClock className="h-3 w-3" aria-hidden />
                    {du === 0 ? '本日' : `残り${du}日`}
                  </Badge>
                </li>
              )
            })}
          </ul>
          <Link
            href={`/company/deadlines?companyId=${companyId}`}
            className="mt-2 inline-block text-xs text-brand-600 underline-offset-2 hover:underline"
          >
            期限をすべて見る
          </Link>
        </Card>
      )}
    </div>
  )
}
