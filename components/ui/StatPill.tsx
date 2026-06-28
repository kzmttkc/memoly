import { cn } from '@/lib/cn'

// ============================================================================
// StatPill — 数値メトリクスの小片（席数・件数・金額など）。
//   value は tabular-nums で桁を揃える。label は補足、icon は任意の lucide アイコン。
// ============================================================================

export interface StatPillProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function StatPill({ label, value, icon, className }: StatPillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-neutral-200 ' +
          'bg-neutral-50 px-3 py-1.5',
        className,
      )}
    >
      {icon && <span className="text-neutral-400">{icon}</span>}
      <span className="text-sm font-semibold tabular-nums text-neutral-900">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  )
}
