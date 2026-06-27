import { cn } from '@/lib/cn'

// ============================================================================
// RiskMeter — 労務リスク健全度スコアの表示。
//   色だけに頼らず「数値 + 帯ラベル(良好/要注意/要改善)」を必ず併記する
//   （アクセシビリティ: 色覚に依存しない）。
//   variant:
//     'hero' = 大スコア + リング(結果カードの主役)
//     'bar'  = カテゴリ別の細い帯(一覧)
// ============================================================================

export type RiskBand = 'good' | 'caution' | 'attention'

const BANDS: Record<
  RiskBand,
  { label: string; text: string; bar: string; ring: string; chip: string }
> = {
  good: {
    label: '良好',
    text: 'text-success-700',
    bar: 'bg-success-500',
    ring: 'ring-success-500/30',
    chip: 'bg-success-50 text-success-700 border-success-500/30',
  },
  caution: {
    label: '要注意',
    text: 'text-warning-700',
    bar: 'bg-warning-500',
    ring: 'ring-warning-500/40',
    chip: 'bg-warning-50 text-warning-700 border-warning-500/30',
  },
  attention: {
    label: '要改善',
    text: 'text-danger-700',
    bar: 'bg-danger-500',
    ring: 'ring-danger-500/40',
    chip: 'bg-danger-50 text-danger-700 border-danger-500/30',
  },
}

export function riskBand(score: number): RiskBand {
  if (score >= 75) return 'good'
  if (score >= 50) return 'caution'
  return 'attention'
}

export function riskBandMeta(score: number) {
  return BANDS[riskBand(score)]
}

// 大スコア（結果カードの主役）。数値 + /100 + 帯ラベルチップ。
export function RiskMeterHero({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const b = riskBandMeta(score)
  return (
    <div
      className={cn(
        'rounded-2xl bg-neutral-50 p-5 ring-1',
        b.ring,
        className,
      )}
    >
      <div className="flex items-end gap-3">
        <span className={cn('text-6xl font-extrabold leading-none tabular-nums', b.text)}>
          {score}
        </span>
        <span className="mb-1.5 text-lg text-neutral-400">/ 100</span>
        <span
          className={cn(
            'mb-2 ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 ' +
              'text-sm font-semibold',
            b.chip,
          )}
        >
          {b.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">労務健全度スコア（目安）</p>
    </div>
  )
}

// カテゴリ別の帯。名前 + 数値 + 帯ラベル(極小) + プログレスバー。
export function RiskMeterBar({
  name,
  score,
}: {
  name: string
  score: number
}) {
  const b = riskBandMeta(score)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-700">{name}</span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-xs font-semibold tabular-nums', b.text)}>{score}</span>
          <span className="text-[10px] text-neutral-400">{b.label}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={cn('h-full rounded-full transition-all', b.bar)}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  )
}
