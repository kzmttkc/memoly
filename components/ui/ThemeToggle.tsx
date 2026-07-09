'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

// ============================================================================
// ThemeToggle — ヘッダ常設のライト/ダーク切替。
//   現在の実効テーマの「逆」に一発で切り替える（Linear/Vercel 流の 1 クリック）。
//   長押し等の複雑さは持たせず、system 追従は設定（コマンドパレット/将来の設定面）で。
//   ハイドレーション不一致を避けるため、マウント前は中立表示にする。
// ============================================================================

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolved === 'dark'
  const label = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        'grid h-9 w-9 place-items-center rounded-lg text-neutral-600 ' +
        'transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
        (className ?? '')
      }
    >
      {/* マウント前は Moon を既定表示（SSR=light 想定と整合、ちらつき最小）。 */}
      {isDark ? (
        <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      ) : (
        <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
      )}
    </button>
  )
}
