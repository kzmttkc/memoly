'use client'

import { useCallback, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

// ============================================================================
// CopyButton — 1クリックでテキストをクリップボードへ。成功で 2秒間チェック表示。
//   規程抜粋・書類ドラフト・まとめメモなど「コピーして持ち出す」箇所の共通部品。
//   clipboard 不可環境でも壊れない（失敗は onError にフォールバック）。
// ============================================================================

interface Props {
  /** コピーする本文（動的に変わる場合はレンダー毎の最新値を渡す） */
  text: string
  /** 通常時ラベル（省略時「コピー」） */
  label?: string
  /** コピー完了時ラベル（省略時「コピーしました」） */
  copiedLabel?: string
  size?: 'sm' | 'md'
  /** アイコンのみ（コンパクトな一覧行など）。ラベルは aria/title に残す。 */
  iconOnly?: boolean
  className?: string
  onError?: () => void
}

export function CopyButton({
  text,
  label = 'コピー',
  copiedLabel = 'コピーしました',
  size = 'sm',
  iconOnly = false,
  className,
  onError,
}: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      onError?.()
    }
  }, [text, onError])

  // アイコンのみ: ゴースト風の正方形（一覧行の他アイコンと揃える）。
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={copied ? copiedLabel : label}
        title={copied ? copiedLabel : label}
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg text-neutral-500 select-none',
          'transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          className,
        )}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success-600" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    )
  }

  const sizes =
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium select-none whitespace-nowrap',
        'border border-neutral-500 bg-white text-neutral-800',
        'transition-colors duration-150 hover:bg-neutral-50 hover:border-neutral-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-brand-500',
        sizes,
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success-600" aria-hidden />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
    </button>
  )
}
