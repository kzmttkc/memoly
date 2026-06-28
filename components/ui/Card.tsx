import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// Card — 白地 + 薄い境界(neutral-200) + ごく淡い影 + rounded-2xl の面。
//   BtoB SaaS の端正なカード。中身の余白は呼び出し側か padded で制御。
//   interactive=true でホバー時に境界をわずかに濃くする（リンクカード用）。
// ============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padded = true, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-neutral-200 bg-white shadow-sm',
        padded && 'p-5 sm:p-6',
        interactive &&
          'transition-colors duration-150 hover:border-neutral-300',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
