import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { inputClass } from './Input'

// ============================================================================
// Textarea — Input と同じ視覚言語の複数行入力。resize は呼び出し側で制御。
// ============================================================================

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputClass, 'leading-relaxed', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
