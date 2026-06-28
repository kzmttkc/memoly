import { cn } from '@/lib/cn'

// ============================================================================
// PageHeader — ページ見出しの統一ブロック。
//   title(neutral-900 太) + 任意の description(neutral-600) + 右側 actions スロット。
//   各ページが手書きしていた h1+p の重複を解消する。
// ============================================================================

export interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-600">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
