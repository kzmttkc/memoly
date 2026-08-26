'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

// /company 配下のセグメントエラー境界。ダッシュボード各ページの実行時例外を
// 素クラッシュにせず、Kabauデザインの復帰画面に受け止める。
export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[company:error-boundary]', error)
  }, [error])

  return <ErrorState reset={reset} digest={error.digest} backHref="/company" />
}
