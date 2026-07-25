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
import { trackSubscriptionStarted, trackBillingStatus } from '@/lib/analytics'
import { MemoryLossWarning } from '../_components/MemoryLossWarning'
import { DataSecuritySection } from '../_components/DataSecuritySection'
import { IntegrationsSection } from '../_components/IntegrationsSection'

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
  // 2026-07-25 CTO修正: 年額Priceを提供するプラン（今はEntryのみ・lib/plans.ts SSOT）向けの
  //   月額/年額切り替え。既定は月額。年額Price未設定のプランでは選ばせない（API側も400で弾く
  //   二重ガードだが、UI側でも出さないことで無駄なエラー往復を避ける）。
  const [selectedInterval, setSelectedInterval] = useState<Record<string, 'month' | 'year'>>({})
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
      // 収益コホート計装: 観測した課金ステータスの遷移から
      //   payment_failed / payment_recovered / churned を派生発火する（差分時1回）。
      trackBillingStatus(data.status, data.plan)
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
      // 収益コホート計装: checkout 成功で1回だけ subscription_started を発火。
      // plan は遷移直後で webhook 未反映のこともあるため state があれば現プラン、無ければ未確定。
      trackSubscriptionStarted(state?.plan ?? 'unknown')
      // 二重発火を避けるため success フラグを URL から消す。
      params.delete('billing')
      const qs = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    } else if (billing === 'canceled') {
      setToast({ show: true, message: 'お手続きをキャンセルしました。' })
    }
    // state を依存に含めるが、URL の billing を上で消すため再発火しない。
  }, [state])

  async function startCheckout(planId: PlanId) {
    if (!state || submitting) return
    setSubmitting(planId)
    try {
      // 席数を送るのは席課金の士業プランのみ（SSOT: Entry/Standard は会社単位の月額。
      // API 側でも非 multiClient は quantity=1 に固定されるため、ここは表示との一致のため）。
      const seats = PLANS[planId].multiClient
        ? (selectedSeats[planId] ?? Math.max(state.seatsUsed, 1))
        : 1
      // 年額切り替え（Entryのみ提供・lib/plans.ts SSOT）。未選択時は既定の月額。
      const interval = selectedInterval[planId] ?? 'month'
      const res = await fetch('/api/company/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, plan: planId, seats, interval }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setToast({
          show: true,
          message: data.message ?? 'このプランは現在お申し込みいただけません。',
        })
        return
      }
      if (data.code === 'YEARLY_NOT_AVAILABLE') {
        setToast({ show: true, message: '年額プランは現在準備中です。月額プランをご利用ください。' })
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
      {/* 席（シート）課金は士業プランのみ（SSOT: docs/BANTO_BILLING_GATE.md §4・§5）。
          Entry/Standard は会社単位の月額＝上限人数まで追加費用なし。説明文もプランで
          出し分け、下部の「上限人数までは料金は変わりません」との自己矛盾を防ぐ。 */}
      <PageHeader
        title={PLANS[state.plan].multiClient ? 'プラン・席の管理' : 'プランの管理'}
        description={
          PLANS[state.plan].multiClient
            ? '現在のプランと席数を確認できます。士業プランは、事務所の利用メンバー数に応じて席を追加できます。'
            : '現在のプランを確認できます。EntryとStandardは、プランの上限人数まで何人で使っても追加費用はかかりません。席の追加があるのは士業プランのみです。'
        }
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
                {state.plan === 'free' && <Badge tone="neutral">無料プラン</Badge>}
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

      {/* ===== 解約導線手前の記憶喪失警告（課金中adminのみ・正規の引き止め）===== */}
      {isAdmin && state.plan !== 'free' && state.status === 'active' && (
        <MemoryLossWarning companyId={companyId} />
      )}

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
          // 主役プランは SSOT(lib/plans.ts featured)を参照（LPと食い違わせない）。
          const featured = p.featured
          const isCurrent = state.plan === id
          const seatVal = selectedSeats[id] ?? Math.max(state.seatsUsed, 1)
          // 年額を提供するプラン（今はEntryのみ）だけ切り替えUIを出す。
          const offersYearly = p.yearlyJpy != null
          const interval = selectedInterval[id] ?? 'month'
          const isYearly = offersYearly && interval === 'year'
          return (
            <Card
              key={id}
              className={
                featured ? 'border-brand-300 shadow-md ring-1 ring-brand-200' : undefined
              }
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">{p.displayName}</h3>
                {featured && <Badge tone="brand">おすすめ</Badge>}
                {isCurrent && <Badge tone="success">利用中</Badge>}
              </div>
              {/* 2026-07-25 CTO修正: 年額を提供するプラン（Entryのみ）に月額/年額の切り替えを追加。
                  LPの「年額¥39,800（月払いより2ヶ月分お得）」を実際に選んで申し込めるようにする。 */}
              {offersYearly && isAdmin && (
                <div className="mt-4 inline-flex rounded-lg border border-neutral-200 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedInterval(s => ({ ...s, [id]: 'month' }))}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      !isYearly ? 'bg-brand-600 text-white' : 'text-neutral-500'
                    }`}
                  >
                    月額
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInterval(s => ({ ...s, [id]: 'year' }))}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      isYearly ? 'bg-brand-600 text-white' : 'text-neutral-500'
                    }`}
                  >
                    年額
                  </button>
                </div>
              )}
              {/* 課金単位の表記（SSOT: docs/BANTO_BILLING_GATE.md §4・§5・LP /business と同一表記）:
                  Entry/Standard = 1社あたりの月額（seatCap 人数まで追加料金なし）。
                  士業のみ席（シート）単位 = 事務所の利用メンバー数に応じて課金。
                  年額選択時は年額の総額を表示する（月割り換算は誤解を生むため出さない）。 */}
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                  &yen;{(isYearly ? (p.yearlyJpy as number) : p.monthlyJpy).toLocaleString()}
                </span>
                <span className="text-sm text-neutral-500">
                  {isYearly
                    ? '/年（1社あたり）'
                    : p.multiClient
                      ? '/月（1席あたり）'
                      : '/月（1社あたり）'}
                </span>
              </p>
              {p.yearlyJpy && !isYearly && (
                <p className="mt-1 text-xs text-neutral-500 tabular-nums">
                  年額 &yen;{p.yearlyJpy.toLocaleString()}（2ヶ月分お得）
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                {p.multiClient
                  ? `席単位の課金・最大 ${p.seatCap} 席`
                  : `利用メンバー ${p.seatCap}名まで（追加料金なし）`}
              </p>

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
                  {/* 席数の選択は席課金の士業プランのみ。Entry/Standard は会社単位の定額
                      （seatCap 人数分を含む）ため、席の指定と席×単価の掛け算表示を出さない。 */}
                  {p.multiClient && (
                    <>
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
                    </>
                  )}
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
        EntryとStandardの表示価格は1社あたりの月額で、プランの上限人数までは何人で使っても料金は変わりません。
        士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。
        お支払い手続きは決済事業者（Stripe）の安全な画面で行います。
        番頭は労務に関する一般的な情報提供と下書き支援を行うツールで、社会保険労務士による
        個別の相談・書類作成代行を行うものではありません。
      </p>

      {/* ===== 連携とAPI（E08 Slack Webhook / 公開API v1 キー管理・adminのみ）===== */}
      <IntegrationsSection companyId={companyId} isAdmin={isAdmin} />

      {/* ===== データとセキュリティ（F10 エクスポート / F09 監査ログ / F05 導線 / 削除自己サーブ）===== */}
      <DataSecuritySection companyId={companyId} isAdmin={isAdmin} />

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
