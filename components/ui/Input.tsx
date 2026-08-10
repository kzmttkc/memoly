import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
// Input — 白地のテキスト入力。neutral境界 + focus時に brand リング。
//   ラベルは呼び出し側で <label htmlFor> を付ける（アクセシビリティ）。
// ============================================================================

export const inputClass =
  'w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm ' +
  // 2026-08-11 UI監査: プレースホルダ neutral-400 は白地で 2.56:1（AA 4.5:1 未達）。
  // neutral-500（4.76:1）へ引き上げる（入力済みテキスト neutral-900 との階層は維持）。
  'text-neutral-900 placeholder:text-neutral-500 ' +
  'transition-colors duration-150 ' +
  'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  ),
)
Input.displayName = 'Input'
