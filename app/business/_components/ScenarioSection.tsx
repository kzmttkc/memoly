import { Building2, Clock } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SCENARIOS } from '../_lib/scenarios'

// ============================================================================
// ScenarioSection — 「導入シナリオ（社内検証に基づく）」の器（B02/B03の骨組み・
//   2026-07-23 Takeshi裁定で先行実装）。
//
//   - データは _lib/scenarios.ts の TS 配列駆動。配列が空なら何も描画しない。
//   - デザインは「お客様の声」互換のカードグリッド。ただしラベル・見出しは
//     「導入シナリオ（社内検証に基づく利用例）」で固定し、実在顧客の声と誤認される
//     表記（氏名・会社名風の架空固有名詞・「お客様の声」見出し）は使わない。
//   - サーバーコンポーネント（インタラクションなし・計測なし）。
// ============================================================================

export default function ScenarioSection() {
  if (SCENARIOS.length === 0) return null

  return (
    <section id="cases" className="scroll-mt-20 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge tone="neutral" className="mb-3">
            導入シナリオ（社内検証に基づく利用例）
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            実際の使われ方を、当時の記録から
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            いまの入口は、就業規則のファイルを置くことです。以下は、獲得の顔を変える前（2026年7月）の社内検証の当時の記録です。
            実在企業の声ではなく、作り手が業種別の会社設定で実際にKabauを使って検証した内容です。引用はそのセッションのままです。
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map(s => (
            <Card key={`${s.industry}-${s.topic}`} className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                  <Building2 className="h-3 w-3" aria-hidden />
                  {s.industry}・{s.employees}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 tabular-nums">
                  <Clock className="h-3 w-3" aria-hidden />
                  所要 {s.duration}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-900">{s.topic}</p>
              <blockquote className="mt-2 flex-1 border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-neutral-600">
                {s.quote}
              </blockquote>
              <p className="mt-3 text-[11px] text-neutral-500 tabular-nums">
                社内検証 {s.verifiedOn}
              </p>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
          上記は作り手による社内検証の当時の記録であり、お客様の体験談ではありません。
          {' '}
          <Link href="/zure" className="underline underline-offset-2 hover:text-brand-700">
            いま就業規則のファイルを置く
          </Link>
        </p>
      </div>
    </section>
  )
}
