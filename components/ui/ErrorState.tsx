'use client'

import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button, buttonClass } from '@/components/ui/Button'

// ============================================================================
// ErrorState — セグメント error.tsx 共通の美しいエラー面（番頭デザインシステム準拠）。
//   Card + brand アイコン + 「もう一度試す(reset)」/「戻る」の2アクション。
//   error.tsx は各セグメントに置く薄いラッパにし、見た目はここへ集約する
//   （global-error.tsx はレイアウトごと落ちた最後の砦なので別実装＝インライン）。
// ============================================================================

export function ErrorState({
  reset,
  title = '問題が発生しました',
  description = '一時的なエラーの可能性があります。もう一度お試しください。繰り返す場合は時間をおいてください。',
  backHref = '/company',
  backLabel = 'ホームへ戻る',
  digest,
}: {
  reset?: () => void
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
  digest?: string
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <Card className="w-full text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-danger-50 text-danger-600"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-bold text-neutral-900">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {reset && (
            <Button onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              もう一度試す
            </Button>
          )}
          <a href={backHref} className={buttonClass({ variant: 'secondary' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </a>
        </div>
        {digest && (
          <p className="mt-5 text-xs text-neutral-500">エラーID: {digest}</p>
        )}
      </Card>
    </div>
  )
}
