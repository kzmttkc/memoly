import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquareText, FileText, ShieldCheck, Lock, ArrowRight, Globe, Check } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PLANS } from '@/lib/plans'

// ============================================================================
// /business/en — English summary landing page (2026-07-28 CTO, L1 audit #3)
// ----------------------------------------------------------------------------
//   Scope: this is a concise English SUMMARY of the Japanese /business LP, not
//   a full translation of every article/tool on the site (out of scope per
//   the audit instruction). It exists so an English-reading visitor (e.g. an
//   overseas HQ manager of a Japan subsidiary) can understand what Banto does,
//   trust the security/privacy posture, and sign up, without needing to read
//   Japanese. The product chat itself already answers in English when asked
//   in English (existing, verified behavior) — this page makes that
//   discoverable instead of buried behind a single JP-only hint line.
//
//   Phase1 compliance carried over from the JP LP: no "supervised by a
//   licensed labor consultant" / "AI labor consultant" / guaranteed legal
//   accuracy claims. General information only, not individual legal advice.
// ============================================================================

export const metadata: Metadata = {
  title: 'Banto — A labor-compliance AI that remembers your company | For Japan HR & operators',
  description:
    'Banto remembers your company\'s work rules and past decisions in Japan, so you don\'t have to re-explain them every time you ask about Japanese labor law. Free to start.',
  alternates: { canonical: '/business/en' },
  openGraph: {
    title: 'Banto — A labor-compliance AI that remembers your company',
    description:
      'Banto remembers your company\'s work rules and past decisions in Japan, so you don\'t have to re-explain them every time.',
    url: 'https://banto-roumu.com/business/en',
    siteName: 'Banto',
    locale: 'en_US',
    type: 'website',
  },
}

// Jargon glossary — plain-English gloss for Japanese labor-law terms that
// appear elsewhere on the site (audit #3: "English annotation for terms like
// '36 Agreement'"). Kept here rather than as tooltips scattered across the
// Japanese page, so the English reader gets the explanation where they read.
const GLOSSARY = [
  {
    term: '36 Agreement (36kyotei, "saburoku kyotei")',
    body:
      'A labor-management agreement required under Article 36 of Japan\'s Labor Standards Act before a company can legally have employees work overtime or on statutory holidays. Without one, overtime itself is technically unlawful.',
  },
  {
    term: 'Statutory working hours',
    body: '8 hours/day and 40 hours/week under the Labor Standards Act. Hours beyond this are overtime and require both the 36 Agreement and premium pay.',
  },
  {
    term: 'Paid leave (yukyu) 5-day rule',
    body:
      'Employees granted 10+ days of annual paid leave must actually take at least 5 days per year; the employer can be penalized if they don\'t track and ensure this.',
  },
  {
    term: 'Shakaihoshi roumushi (labor & social security attorney)',
    body:
      'A licensed Japanese professional for labor/social-insurance filings and individual advice. Banto is not a substitute for one — see the Compliance note below.',
  },
]

const FEATURES = [
  {
    icon: BantoMark,
    title: 'Remembers',
    body:
      'Tell Banto your work rules, 36 Agreement status, and past decisions once. It keeps that context so you don\'t re-explain it every time, unlike a generic AI chat.',
  },
  {
    icon: MessageSquareText,
    title: 'Answers',
    body: 'Ask a labor-law question in plain English or Japanese and get an answer based on your company\'s actual situation, not a generic disclaimer.',
  },
  {
    icon: FileText,
    title: 'Drafts',
    body: 'Get a first draft of work rules, a 36 Agreement, or an employment notice with your company\'s numbers already filled in.',
  },
  {
    icon: ShieldCheck,
    title: 'Flags',
    body: 'See a plain-language risk score and whether new subsidies or law changes actually apply to your company.',
  },
]

export default function BusinessEnglishPage() {
  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/business/en" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BantoMark className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              番頭<span className="ml-1 text-sm font-medium text-neutral-400">Banto</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            {/* Language toggle back to the Japanese LP (audit #3: EN/JP toggle). */}
            <Link
              href="/business"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />
              日本語
            </Link>
            {/* 2026-07-28 CTO fix (L2 audit #5): this link previously dropped to
                /login?next=/company with no lang=en, so an English-reading visitor
                landed on a fully Japanese login screen. /login now supports
                ?lang=en, so carry it through. */}
            <Link
              href="/login?next=/company&lang=en"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              Log in
            </Link>
            <Link
              href="/signup?next=/company&lang=en"
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center sm:pt-16">
        <Badge tone="brand" className="mb-6">A labor-compliance AI that remembers your company</Badge>
        <h1 className="text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl">
          Stop re-explaining your company&apos;s rules to AI every time.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
          Banto remembers your work rules, your 36 Agreement status, and past decisions, so a
          second question starts from where the first one left off. Built for small and
          mid-size businesses operating in Japan — including the Japan subsidiaries of
          overseas companies.
        </p>
        <p className="mx-auto mt-3 flex max-w-xl items-start justify-center gap-1.5 text-sm leading-relaxed text-neutral-500">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
          <span>Ask Banto&apos;s chat in English and it answers in English — this works today, not a roadmap item.</span>
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup?next=/company&lang=en" className={buttonClass({ variant: 'primary', size: 'lg' })}>
            Start free — no credit card
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/business" className={buttonClass({ variant: 'ghost', size: 'lg' })}>
            See the full Japanese site
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-neutral-500">
          Free to start. No credit card required. You can delete all your data at any time.
        </p>
      </section>

      {/* ===== What it does ===== */}
      <section className="border-t border-neutral-200 bg-neutral-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Remember. Answer. Draft. Flag.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map(f => {
              const Icon = f.icon
              return (
                <Card key={f.title} interactive className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{f.body}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== Security ===== */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Your company&apos;s data stays yours
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">Isolated per company</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Data is separated per company at the database row level (Postgres Row-Level Security). No other customer can access your data.
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">Encrypted in transit and at rest</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                All traffic is HTTPS/TLS. Data is stored on Supabase with encryption at rest.
              </p>
            </div>
          </Card>
        </div>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Full details: <Link href="/security" className="text-brand-600 underline">Security &amp; data protection</Link> ·{' '}
          <Link href="/privacy/en" className="text-brand-600 underline">Privacy Policy (English)</Link>
        </p>
      </section>

      {/* ===== Pricing (mirrors JP LP; SSOT = lib/plans.ts) ===== */}
      <section id="pricing" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Pricing</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              You can start on the free plan. Paid plans are self-serve — you are only charged when you
              choose a plan and complete checkout yourself.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Card className="border-brand-300 shadow-md ring-1 ring-brand-200">
              <h3 className="text-lg font-semibold text-neutral-900">{PLANS.starter.displayName}</h3>
              <p className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
                &yen;{PLANS.starter.monthlyJpy.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-neutral-500">/mo (per company, up to {PLANS.starter.seatCap} members)</span>
              </p>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">{PLANS.standard.displayName}</h3>
              <p className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
                &yen;{PLANS.standard.monthlyJpy.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-neutral-500">/mo (per company, up to {PLANS.standard.seatCap} members)</span>
              </p>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">{PLANS.shigyo.displayName} (multi-client)</h3>
              <p className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
                &yen;{PLANS.shigyo.monthlyJpy.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-neutral-500">/mo per seat</span>
              </p>
              <p className="mt-2 text-xs text-neutral-500">For anyone managing multiple client companies — not limited to licensed labor consultants.</p>
            </Card>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/signup?next=/company&lang=en" className={buttonClass({ variant: 'primary', size: 'lg' })}>
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Glossary (audit #3: English annotation for JP labor-law jargon) ===== */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
          Japanese labor-law terms you&apos;ll see
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Some terms are easier to keep in Japanese even in English conversation. Here&apos;s what they mean.
        </p>
        <div className="mt-6 space-y-4">
          {GLOSSARY.map(g => (
            <Card key={g.term} padded>
              <h3 className="text-sm font-semibold text-neutral-900">{g.term}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{g.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== Compliance note ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Card padded className="bg-neutral-50">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Check className="h-4 w-4 text-brand-600" aria-hidden /> What Banto is — and isn&apos;t
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Banto provides general information and drafting assistance based on your company&apos;s own
            inputs. It is not a substitute for a licensed shakaihoshi roumushi (labor &amp; social
            security attorney) and does not provide individualized legal advice or represent you
            before government offices. The operator has passed Japan&apos;s shakaihoshi roumushi exam
            but is not registered with a shakaihoshi roumushi association, so does not offer licensed
            professional services. For decisions that require a final legal judgment, please consult
            a registered professional.
          </p>
        </Card>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <BantoMark className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/business" className="hover:text-brand-700">日本語サイト</Link>
              <Link href="/login?next=/company&lang=en" className="hover:text-brand-700">Log in</Link>
              <Link href="/terms/en" className="hover:text-brand-700">Terms (English)</Link>
              <Link href="/privacy/en" className="hover:text-brand-700">Privacy (English)</Link>
              <Link href="/tokushoho" className="hover:text-brand-700">特定商取引法に基づく表記</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            Banto provides general information, not individualized legal advice or filing
            representation. Please consult a licensed professional for final legal decisions.
          </p>
          <p className="mt-2 text-xs text-neutral-400">© {new Date().getFullYear()} 番頭(Banto) (KIZUNA Creation)</p>
        </div>
      </footer>
    </div>
  )
}
