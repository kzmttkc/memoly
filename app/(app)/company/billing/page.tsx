'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, CreditCard, Users, AlertTriangle, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatPill } from '@/components/ui/StatPill'
import { Toast } from '@/components/ui/Toast'
import { CompanyGuard } from '../_components/CompanyGuard'
import { PLANS, PAID_PLAN_IDS, type PlanId } from '@/lib/plans'

// ============================================================================
// /company/billing — プラン / 席 / アップグレード（admin向け）
// ----------------------------------------------------------------------------
//   現状(無料モニター)を尊重した設計:
//     - billingEnabled=false の間は「無料モニター中・下記は予定価格・現時点で課金は
//       行いません」を明示し、アップグレードボタンは無効化（Phase1コンプラ／景表法）。
//     - billingEnabled=true（キー投入後）になると、admin はプラン＋席数を選んで
//       /api/company/billing/checkout を叩き Stripe Checkout へ遷移できる。
//   member（非admin）には現プラン表示のみ。購入操作は出さない（API側でも403）。
//   配色は @theme トークンのみ（brand/neutral/success/...）＝ESLint一貫性ガード準拠。
//   断定/誇大表現は使わない（士業代替を示唆しない）。
// ============================================================================

interface BillingState {
  plan: PlanId
  planName: string
  seatsPurchased: number
  seatsUsed: number
  status: string
  role: 'admin' | 'member'
  billingEnabled: boolean
}

function BillingInner() {
  const companyId = useSearchParams().get('companyId') ?? ''

  const [state, setState] = useState<BillingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  })

  const load = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/company/billing?companyId=${companyId}`)
      if (res.status === 403) {
        setError('この会社の課金情報を表示する権限がありません。')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '読み込みに失敗しました')
        return
      }
      setState(data)
    } catch {
      setError('読み込みに失敗しました')
    }
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  // checkout から戻ってきたときのフィードバック（?billing=success|canceled）。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billing = params.get('billing')
    if (billing === 'success') {
      setToast({ show: true, message: 'お手続きを受け付けました。反映まで少しお待ちください。' })
    } else if (billing === 'canceled') {
      setToast({ show: true, message: 'お手続きをキャンセルしました。' })
    }
  }, [])

  async function startCheckout(planId: PlanId) {
    if (!state || submitting) return
    setSubmitting(planId)
    try {
      const seats = selectedSeats[planId] ?? Math.max(state.seatsUsed, 1)
      const res = await fetch('/api/company/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, plan: planId, seats }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setToast({
          show: true,
          message:
            data.message ?? '現在は無料モニター期間のため、課金は有効化されていません。',
        })
        return
      }
      if (!res.ok || !data.url) {
        setToast({ show: true, message: data.error ?? 'お手続きを開始できませんでした。' })
        return
      }
      // Stripe Checkout へ遷移。
      window.location.href = data.url
    } catch {
      setToast({ show: true, message: 'お手続きを開始できませんでした。' })
    } finally {
      setSubmitting(null)
    }
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl border-warning-500/30 bg-warning-50">
        <p className="flex items-center gap-2 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      </Card>
    )
  }

  if (!state) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>
  }

  const isAdmin = state.role === 'admin'
  const billingOn = state.billingEnabled

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="プラン・席の管理"
        description="現在のプランと席数を確認できます。複数人で使う場合は席を追加してください。"
      />

      {/* ===== 現在の状態 ===== */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <CreditCard className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-neutral-500">現在のプラン</p>
              <p className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                {state.planName}
                {state.plan === 'free' && <Badge tone="neutral">無料モニター</Badge>}
                {state.status === 'past_due' && <Badge tone="warning">お支払い確認中</Badge>}
                {state.status === 'canceled' && <Badge tone="neutral">解約済み</Badge>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatPill
              label="使用中の席"
              value={`${state.seatsUsed} / ${state.seatsPurchased}`}
              icon={<Users className="h-4 w-4" aria-hidden />}
            />
          </div>
        </div>
      </Card>

      {/* ===== 無料モニターの告知（billing無効時）===== */}
      {!billingOn && (
        <Card className="mb-6 border-info-500/30 bg-info-50">
          <p className="flex items-start gap-2 text-sm text-info-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              現在は無料モニター期間です。すべての機能を無料でお試しいただけます。
              下記は今後の予定価格で、現時点で課金は行いません。
            </span>
          </p>
        </Card>
      )}

      {/* ===== 非admin向けの注記 ===== */}
      {!isAdmin && (
        <Card className="mb-6 border-neutral-200">
          <p className="text-sm text-neutral-600">
            プランや席の変更は、この会社の管理者が行えます。
          </p>
        </Card>
      )}

      {/* ===== プラン一覧 ===== */}
      <div className="grid items-start gap-5 sm:grid-cols-3">
        {PAID_PLAN_IDS.map(id => {
          const p = PLANS[id]
          const featured = id === 'standard'
          const isCurrent = state.plan === id
          const seatVal = selectedSeats[id] ?? Math.max(state.seatsUsed, 1)
          return (
            <Card
              key={id}
              className={
                featured ? 'border-brand-300 shadow-md ring-1 ring-brand-200' : undefined
              }
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">{p.displayName}</h3>
                {featured && <Badge tone="brand">主力</Badge>}
                {isCurrent && <Badge tone="success">利用中</Badge>}
              </div>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                  &yen;{p.monthlyJpy.toLocaleString()}
                </span>
                <span className="text-sm text-neutral-500">/ 席・月</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">最大 {p.seatCap} 席</p>

              <ul className="mt-5 space-y-2">
                <li className="flex items-start gap-2 text-sm text-neutral-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span>1日あたり相談 {p.limits.chat} 回</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-neutral-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span>書類作成・規程レビュー 各 {p.limits.document_generate} 件/日</span>
                </li>
                {p.multiClient && (
                  <li className="flex items-start gap-2 text-sm text-neutral-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    <span>複数の顧問先を切り替え・各社データ分離</span>
                  </li>
                )}
              </ul>

              {isAdmin && (
                <div className="mt-5 space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs text-neutral-600">
                    席数
                    <input
                      type="number"
                      min={1}
                      max={p.seatCap}
                      value={seatVal}
                      onChange={e =>
                        setSelectedSeats(s => ({
                          ...s,
                          [id]: Math.min(
                            p.seatCap,
                            Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                          ),
                        }))
                      }
                      className="h-9 w-20 rounded-lg border border-neutral-200 bg-white px-2 text-right text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={`${p.displayName} の席数`}
                    />
                  </label>
                  <p className="text-right text-xs text-neutral-500 tabular-nums">
                    月額 &yen;{(p.monthlyJpy * seatVal).toLocaleString()}（{seatVal}席）
                  </p>
                  <Button
                    variant={featured ? 'primary' : 'secondary'}
                    className="w-full"
                    disabled={!billingOn || submitting === id}
                    onClick={() => startCheckout(id)}
                  >
                    {submitting === id
                      ? '...'
                      : billingOn
                        ? isCurrent
                          ? 'このプランを更新'
                          : 'このプランにする'
                        : '準備中（無料モニター）'}
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-neutral-500">
        表示価格は1席あたりの月額です。お支払い手続きは決済事業者（Stripe）の安全な画面で行います。
        番頭は労務に関する一般的な情報提供と下書き支援を行うツールで、社会保険労務士による
        個別の相談・書類作成代行を行うものではありません。
      </p>

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <BillingInner />
      </CompanyGuard>
    </Suspense>
  )
}
