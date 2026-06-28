'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageSquareText, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { CompanyGuard } from '../_components/CompanyGuard'
import { WeeklyDigest } from '../_components/WeeklyDigest'

// ============================================================================
// /company/home — 会社を選択した先のトップ（ダッシュボード）。
//   先頭に「今週、自社に関係する変更」能動フィード（WeeklyDigest）を常設し、
//   受け身（押したら走る診断）を能動（戻る理由が届く）へ変える起点にする。
//   その下に主要導線（相談 / 書類 / リスク診断 / 助成金・法改正）をまとめる。
//   companyId は URL クエリから引き継ぐ（AppShell と同じ流儀）。
// ============================================================================

function HomeInner() {
  const companyId = useSearchParams().get('companyId') ?? ''

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="自社のホーム"
        description="今週、自社に関係する変更をまずお届けします。気になったカードから、その場で相談・書類作成・診断に進めます。"
      />

      <WeeklyDigest companyId={companyId} />

      {/* 主要導線（フィードの下・二次アクション）。 */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href={`/company/chat?companyId=${companyId}`}
          className={buttonClass({ variant: 'secondary', className: 'h-auto flex-col gap-1.5 py-4' })}
        >
          <MessageSquareText className="h-5 w-5" aria-hidden />
          相談
        </Link>
        <Link
          href={`/company/documents?companyId=${companyId}`}
          className={buttonClass({ variant: 'secondary', className: 'h-auto flex-col gap-1.5 py-4' })}
        >
          <FileText className="h-5 w-5" aria-hidden />
          書類
        </Link>
        <Link
          href={`/company/risk?companyId=${companyId}`}
          className={buttonClass({ variant: 'secondary', className: 'h-auto flex-col gap-1.5 py-4' })}
        >
          <ShieldCheck className="h-5 w-5" aria-hidden />
          リスク診断
        </Link>
        <Link
          href={`/company/insights?companyId=${companyId}`}
          className={buttonClass({ variant: 'secondary', className: 'h-auto flex-col gap-1.5 py-4' })}
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          助成金・法改正
        </Link>
      </div>
    </div>
  )
}

export default function CompanyHomeDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <HomeInner />
      </CompanyGuard>
    </Suspense>
  )
}
