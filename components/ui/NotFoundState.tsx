import Link from 'next/link'
import { Compass, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'

// ============================================================================
// NotFoundState — セグメント not-found.tsx 共通の面（番頭デザインシステム準拠）。
//   サーバーコンポーネントでよい（インタラクション無し）。各 not-found.tsx から
//   backHref/backLabel だけ差し替えて使う。
// ============================================================================

export function NotFoundState({
  title = 'ページが見つかりません',
  description = 'お探しのページは移動または削除された可能性があります。URL をご確認ください。',
  backHref = '/company',
  backLabel = 'ホームへ戻る',
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <Card className="w-full text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
        >
          <Compass className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold tabular-nums text-neutral-400">404</p>
        <h1 className="mt-1 text-lg font-bold text-neutral-900">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">
          {description}
        </p>
        <div className="mt-6 flex justify-center">
          <Link href={backHref} className={buttonClass({ variant: 'secondary' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </div>
      </Card>
    </div>
  )
}
