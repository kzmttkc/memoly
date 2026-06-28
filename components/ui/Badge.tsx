import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// Badge — semantic ラベル。色だけに頼らずテキスト(label)とペアで使う前提。
//   tone: neutral / brand / success / warning / danger / info
//   ライト背景で 4.5:1 を満たす濃いテキスト + 淡い面 + 同系境界。
// ============================================================================

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-success-50 text-success-700 border-success-500/30',
  warning: 'bg-warning-50 text-warning-700 border-warning-500/30',
  danger: 'bg-danger-50 text-danger-700 border-danger-500/30',
  info: 'bg-info-50 text-info-700 border-info-500/30',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = 'neutral', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ' +
          'text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  ),
)
Badge.displayName = 'Badge'
