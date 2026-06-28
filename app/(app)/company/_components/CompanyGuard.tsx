'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// ============================================================================
// CompanyGuard — companyId 未指定時の共通ガード。
//   各会社版ページが手書きしていた「会社が指定されていません」表示を一元化する。
//   companyId があれば children をそのまま描画する。
//   （Suspense 境界内で使う前提: useSearchParams を読む。）
// ============================================================================

export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const companyId = useSearchParams().get('companyId') ?? ''

  if (!companyId) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-warning-600" aria-hidden />
        <p className="text-sm text-neutral-700">会社が指定されていません。</p>
        <Link href="/company" className={buttonClass({ variant: 'secondary', className: 'mt-4' })}>
          会社一覧に戻る
        </Link>
      </Card>
    )
  }

  return <>{children}</>
}
