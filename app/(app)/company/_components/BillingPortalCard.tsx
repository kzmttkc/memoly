'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ============================================================================
// BillingPortalCard — 管理画面から解約・支払い方法の変更まで到達させる
// ----------------------------------------------------------------------------
// なぜ要るか（2026-08-13 機能 -2 / UX 2-11 の是正）:
//   /api/company/billing/portal は 2026-07-30 に作られ、Kabau専用の
//   カスタマーポータル設定（解約=請求期間の終了時 / 支払い方法の更新=有効 /
//   プラン切替=無効）まで用意されていた。にもかかわらず**どの画面からも
//   呼ばれておらず**、/pricing には「管理画面上で解約手続きを完了する機能は
//   提供しておらず」と書いたままだった。作ってあるものが繋がっていないだけ。
//
//   同時に UX 監査 2-11「管理画面でできる唯一の操作が退会＝全データ削除」への
//   解毒剤でもある。契約をやめたい人が、アカウント削除しか選択肢がない状態を
//   解消する（解約はデータを消さない）。
//
//   ガードは API 側が正典（ログイン必須・admin 限定・stripe_customer_id 必須）。
//   ここでは admin にだけ出し、顧客未作成（NO_CUSTOMER=400）は文言で説明する。
// ============================================================================

export function BillingPortalCard({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function openPortal() {
    if (loading || !companyId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/company/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
        message?: string
      }
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      if (data.error === 'NO_CUSTOMER') {
        setMessage(
          'お支払い情報がまだ登録されていません。有料プランのお申し込み後にご利用いただけます。',
        )
      } else {
        setMessage(data.message ?? data.error ?? 'お支払い情報の管理画面を開けませんでした。')
      }
    } catch {
      setMessage('通信に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">お支払いと解約の管理</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            支払い方法の変更・請求書の確認・解約をこの画面から行えます。解約しても記録（相談履歴・記憶・規程・期限）は残ります。
          </p>
        </div>
        <Button variant="secondary" onClick={openPortal} disabled={loading}>
          <CreditCard className="mr-1.5 h-4 w-4" aria-hidden />
          {loading ? '開いています...' : 'お支払い情報を管理する'}
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-neutral-600">
          {message}
        </p>
      )}
    </Card>
  )
}
