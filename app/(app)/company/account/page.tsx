'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataSecuritySection } from '../_components/DataSecuritySection'

// ============================================================================
// /company/account — アカウント・データ管理（発見性の是正・F05 persona07/05）
// ----------------------------------------------------------------------------
//   退会（アカウント削除）・データのエクスポート・操作の監査ログを、プラン/請求
//   ページの奥に埋めず「設定メニューから1クリック」で辿れる独立ページに集約する。
//   実挙動は既存の DataSecuritySection をそのまま再利用する（削除の二段確認・
//   エクスポート・監査ログのロジックを重複させない＝後方互換）。
//
//   companyId は URL クエリ優先、無ければ所属先頭（created_at 最古）を既定にする。
//   エクスポート/監査ログは admin かつ会社スコープの機能なので、対象会社の role で
//   isAdmin を決める。アカウント削除はユーザー全体の操作（DELETE /api/account）で、
//   会社の有無・ロールに関わらず DataSecuritySection 内で常に表示される。
//
//   直リンク /account は next.config の redirect でここへ寄せている（persona が
//   /account を叩いて 404 だった問題の是正）。
// ============================================================================

interface Membership {
  companyId: string
  role: 'admin' | 'member'
  name: string
  plan: string
  seatsPurchased: number
}

function AccountInner() {
  const urlCompanyId = useSearchParams().get('companyId') ?? ''
  const [companies, setCompanies] = useState<Membership[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/company')
      .then(r => (r.ok ? r.json() : { companies: [] }))
      .then(d => {
        if (!cancelled) setCompanies(d.companies ?? [])
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (companies === null) {
    return <p className="text-sm text-neutral-500">読み込み中...</p>
  }

  // 対象会社: URL 指定があればそれ、無ければ所属先頭。所属0社なら会社スコープ機能は
  // 出さず（isAdmin=false）、アカウント削除・セキュリティ導線のみ表示される。
  const current = companies.find(c => c.companyId === urlCompanyId) ?? companies[0]
  const companyId = current?.companyId ?? ''
  const isAdmin = current?.role === 'admin'

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="アカウント・データ管理"
        description="データのエクスポート、操作の監査ログ、アカウントの削除（退会）をここから行えます。"
      />
      <DataSecuritySection companyId={companyId} isAdmin={isAdmin} />
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <AccountInner />
    </Suspense>
  )
}
