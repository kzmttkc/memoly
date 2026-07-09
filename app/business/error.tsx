'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'

// 公開LP(/business)のエラー境界。公開ルートなので戻り先は /business。
export default function BusinessError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[business:error-boundary]', error)
  }, [error])

  return (
    <div className="company-light min-h-[100dvh] bg-white">
      <ErrorState reset={reset} digest={error.digest} backHref="/business" backLabel="トップへ戻る" />
    </div>
  )
}
