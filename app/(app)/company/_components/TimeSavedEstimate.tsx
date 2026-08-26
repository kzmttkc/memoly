'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { track } from '@/lib/analytics'
import { fetchHomeStatus, type HomeStatus } from './home-status'

// ============================================================================
// TimeSavedEstimate — 「Kabauが肩代わりした時間（推定）」（外部評価 E02）。
//   記憶メーターの直下に置き、相談の積み上げを「時間」という顧客の言葉に翻訳する。
//
//   誠実さの設計（誇張禁止）:
//     - 式は「相談回数 × 15分」だけ。15分は"自分で法令・通達を調べて答えに辿り着く
//       までの控えめな仮定"であり、根拠のない大きい係数（30分・1時間）は使わない。
//     - 表示は必ず「推定」と明記し、式そのものを注記で開示する（ブラックボックスにしない）。
//     - 相談2回未満では出さない（1回×15分を誇るのはノイズ）。
//
//   C10（活性化定義v2）の計測もここで行う:
//     新定義「記憶1件 + 相談1回」を満たした瞬間に、既存イベント company_activated へ
//     props { definition: 'memory1_consult1' } を付けて1回だけ発火する。
//     - 新イベント名は作らない（既存語彙にpropsを足す原則・banto_activated_v2は作らない）。
//     - 既存のオンボ発火（props=variantのみ・definition無し）は一切変更しない。
//       レポート側（banto_funnel_report.py）が definition プロパティで新旧を分離集計する。
//     - localStorage で発火済みを覚え、再訪のたびに重複計上しない（v1と同じ「1回きり」の意味論）。
// ============================================================================

/** 1相談あたりの調べ物時間の仮定（分）。控えめ固定・UIの注記にも同じ数字を出す。 */
const MINUTES_PER_CONSULT = 15
/** 表示を始める最小相談回数（1回では出さない）。 */
const MIN_CONSULTS_TO_SHOW = 2

const ACTIVATED_V2_KEY = 'banto_activated_v2_fired'

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

export function TimeSavedEstimate({ companyId }: { companyId: string }) {
  const [status, setStatus] = useState<HomeStatus | null>(null)

  useEffect(() => {
    if (!companyId) return
    let alive = true
    fetchHomeStatus(companyId)
      .then(data => {
        if (alive) setStatus(data)
      })
      .catch(() => {
        /* 取得失敗時は何も出さない（ベストエフォート・ホームを妨げない） */
      })
    return () => {
      alive = false
    }
  }, [companyId])

  // C10: 活性化v2（記憶1件+相談1回）を満たした最初の観測で1回だけ計測する。
  useEffect(() => {
    if (!status) return
    try {
      if (status.memories >= 1 && status.consult.userMessageCount >= 1) {
        if (!localStorage.getItem(ACTIVATED_V2_KEY)) {
          localStorage.setItem(ACTIVATED_V2_KEY, new Date().toISOString().slice(0, 10))
          track('company_activated', { definition: 'memory1_consult1' })
        }
      }
    } catch {
      /* localStorage 不可・計測失敗は無視（機能本体に影響させない） */
    }
  }, [status])

  if (!status) return null
  const consults = status.consult.userMessageCount
  if (consults < MIN_CONSULTS_TO_SHOW) return null

  const totalMin = consults * MINUTES_PER_CONSULT

  return (
    <Card className="py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success-50 text-success-700">
          <Clock3 className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-500">Kabauが肩代わりした調べ物の時間（推定）</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums text-neutral-900">
              約{formatMinutes(totalMin)}
            </span>
          </p>
        </div>
      </div>
      {/* 式の開示（誠実関所）: 何をどう仮定した数字かを常に見せる。 */}
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        これまでの相談{consults}回 × 1回あたり{MINUTES_PER_CONSULT}分
        （ご自身で調べる場合の控えめな仮定）で計算した推定です。実際の時間はご状況により異なります。
      </p>
    </Card>
  )
}
