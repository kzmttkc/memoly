import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// Button — 番頭(Banto) 会社版の共通ボタン
//   variant: primary(brand塗り=主要CTA) / secondary(outline) / ghost(透明) / danger
//   size:    sm / md / lg
//   focus-visible:ring を内蔵（キーボード操作時のみ可視リング＝アクセシビリティ）。
//   asChild は使わない方針（重い依存を入れない）。リンクは <a className={buttonClass(...)}>。
// ============================================================================

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium ' +
  'transition-colors duration-150 select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed ' +
  'disabled:pointer-events-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-sm',
  secondary:
    'bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50 ' +
    'hover:border-neutral-300 focus-visible:ring-brand-500',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 ' +
    'focus-visible:ring-brand-500',
  danger:
    'bg-white text-danger-700 border border-danger-200 hover:bg-danger-50 ' +
    'focus-visible:ring-danger-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
}

// リンク等で <button> を使わず同じ見た目を当てたいときに使う共有クラスビルダ。
export function buttonClass(opts?: {
  variant?: Variant
  size?: Size
  className?: string
}) {
  const { variant = 'primary', size = 'md', className } = opts ?? {}
  return cn(base, variants[variant], sizes[size], className)
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
