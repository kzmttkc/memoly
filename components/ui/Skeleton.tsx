import { cn } from '@/lib/cn'

// ============================================================================
// Skeleton — ローディング中のプレースホルダ面。既存デザイントークン(neutral-200)を
//   使い、motion-safe な淡いパルスで「読み込み中」を伝える。prefers-reduced-motion
//   では静止する（motion-safe:）。装飾なので aria-hidden。
// ============================================================================
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-lg bg-neutral-200/70 motion-safe:animate-pulse',
        className,
      )}
    />
  )
}
