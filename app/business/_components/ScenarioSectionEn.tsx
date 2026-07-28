import { Building2, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SCENARIOS_EN } from '../_lib/scenarios.en'

// ============================================================================
// ScenarioSectionEn — English counterpart of ScenarioSection.tsx for
//   /business/en (2026-07-29 CTO, L3 audit #1). Renders the same verified
//   internal test-session records as the Japanese page (translated in
//   ../_lib/scenarios.en.ts), with the same "these are our own internal
//   verification sessions, not customer testimonials" framing — this
//   constraint is a hard requirement carried over unchanged
//   (feedback_no_sockpuppet_authentic_content).
// ============================================================================

export default function ScenarioSectionEn() {
  if (SCENARIOS_EN.length === 0) return null

  return (
    <section className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge tone="neutral" className="mb-3">
            Real usage scenarios (from our own internal testing)
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            How Banto actually gets used, from our test logs
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            These are not customer testimonials — they are records of the operator&apos;s own
            internal testing, using different company profiles to verify Banto&apos;s behavior.
            Quotes reflect what actually happened in those sessions.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS_EN.map(s => (
            <Card key={`${s.industry}-${s.topic}`} className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                  <Building2 className="h-3 w-3" aria-hidden />
                  {s.industry} &middot; {s.employees}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 tabular-nums">
                  <Clock className="h-3 w-3" aria-hidden />
                  {s.duration}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-900">{s.topic}</p>
              <blockquote className="mt-2 flex-1 border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-neutral-600">
                {s.quote}
              </blockquote>
              <p className="mt-3 text-[11px] text-neutral-400 tabular-nums">Verified internally {s.verifiedOn}</p>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
          The above are records from the operator&apos;s own internal testing, not customer testimonials.
        </p>
      </div>
    </section>
  )
}
