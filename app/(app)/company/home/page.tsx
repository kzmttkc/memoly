'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageSquareText, FileText, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CompanyGuard } from '../_components/CompanyGuard'
import { WeeklyDigest } from '../_components/WeeklyDigest'
import { MemoryBalanceMeter } from '../_components/MemoryBalanceMeter'
import { HomeEngagement } from '../_components/HomeEngagement'
import { TimeSavedEstimate } from '../_components/TimeSavedEstimate'
import { DailyRoumuCard } from '../_components/DailyRoumuCard'

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
        description="今週の法改正・手続き期限など、自社に関係する動きから表示します。気になったカードから、その場で相談・書類作成・診断に進めます。"
      />

      {/* D17+C13/D10/D14/D16: 初回チェックリスト（今日やること1つを最上部）・
          ストリーク・リスク前回比・近づく期限の集約。未取得/該当なしは何も出ない。 */}
      <div className="mb-6">
        <HomeEngagement companyId={companyId} />
      </div>

      {/* 記憶残高メーター（解約防止の主装置・沈没コストの可視化）。フィードの直前に常設。 */}
      <div className="mb-6">
        <MemoryBalanceMeter companyId={companyId} />
      </div>

      {/* E02: 番頭が肩代わりした時間（推定）。記憶メーターの直下＝価値の翻訳。
          相談2回未満・取得失敗時は何も出ない。C10 活性化v2 の計測もこの中で行う。 */}
      <div className="mb-6">
        <TimeSavedEstimate companyId={companyId} />
      </div>

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

      {/* D23: 今日の1分労務（既存 /roumu 記事の日替わり抜粋・最下部の読み物枠）。 */}
      <div className="mt-10">
        <DailyRoumuCard />
      </div>
    </div>
  )
}

export default function CompanyHomeDashboardPage() {
  return (
    // I07: フォールバックは文字列でなくホームの骨格（見出し+メーター+フィード枠）。
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl" aria-busy="true" aria-label="読み込み中">
          <div className="mb-6 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-full max-w-md" />
          </div>
          <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
          <Skeleton className="mb-3 h-5 w-56" />
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      }
    >
      <CompanyGuard>
        <HomeInner />
      </CompanyGuard>
    </Suspense>
  )
}
