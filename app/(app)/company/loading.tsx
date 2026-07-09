import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

// ============================================================================
// /company 配下 共通ローディングUI。AppShell（layout.tsx）内で描画されるため、
//   ここではページ本文のスケルトンだけを出す。ページ遷移／サーバー取得の待ち時間に
//   白画面ではなく骨格を見せ、体感速度と安心感を上げる（全 /company/* に効く）。
// ============================================================================
export default function CompanyLoading() {
  return (
    <div className="mx-auto max-w-4xl" aria-busy="true" aria-label="読み込み中">
      {/* ページ見出し行 */}
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>

      {/* 上部のサマリカード帯 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <Card key={i} className="space-y-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-16" />
          </Card>
        ))}
      </div>

      {/* 本文カード */}
      <Card className="space-y-4">
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-5/6" />
        </div>
        <div className="pt-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </Card>
    </div>
  )
}
