'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, MessageSquareText, ArrowRight, RefreshCw } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'
import {
  EN_INDUSTRIES,
  EN_DEFAULT_INDUSTRY,
  getEnIndustry,
  type EnIndustryKey,
  type EnDemoQA,
} from '../_lib/industries.en'

// ============================================================================
// TryDemoEn — English counterpart of TryDemo (../TryDemo.tsx) for /business/en.
//   2026-07-29 CTO (L3 audit #1): the English LP had no demo at all
//   (TryDemo/ScenarioSection/CompareToggle/LeadCapture were simply not
//   imported). This is a same-mechanism, English-content version. It
//   intentionally does NOT share the industry-selection store with the
//   Japanese hero (../_lib/industry-selection.ts) — /business/en has no
//   IndustryHeroPreview to sync with, so that cross-linking would be dead
//   code here. Everything else (script demo, no real API calls, typing
//   animation, pending-click handling) mirrors the reviewed JP component.
//
//   Phase1 compliance carried over from the JP demo: scripted sample answers
//   only (no real API call), general-information caveat inline in the
//   answers, no "AI labor consultant" framing.
// ============================================================================

type Turn = { id: number; q: string; a: string }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Carries utm_source/utm_campaign/utm_medium from the landing URL into the
// signup href, same approach as TryDemo.tsx's signupHrefWithAttribution but
// keeping lang=en on the destination (audit #2 root cause: lang gets dropped
// when it's a sibling query param instead of baked into `next`).
function signupHrefWithAttribution(): string {
  const base = '/signup?next=/company&lang=en'
  if (typeof window === 'undefined') return base
  const landing = new URLSearchParams(window.location.search)
  const qs = new URLSearchParams('next=/company')
  qs.set('lang', 'en')
  for (const key of ['utm_source', 'utm_campaign', 'utm_medium']) {
    const v = landing.get(key)
    if (v) qs.set(key, v.slice(0, 60))
  }
  return `/signup?${qs.toString()}`
}

export default function TryDemoEn() {
  const router = useRouter()
  const reducedMotion = usePrefersReducedMotion()

  const [industryKey, setIndustryKey] = useState<EnIndustryKey>(EN_DEFAULT_INDUSTRY)
  const industry = getEnIndustry(industryKey)

  const [turns, setTurns] = useState<Turn[]>([])
  const [typing, setTyping] = useState<{ id: number; q: string; full: string } | null>(null)
  const [typedLen, setTypedLen] = useState(0)
  const [started, setStarted] = useState(false)
  const [pending, setPending] = useState<{ qa: EnDemoQA; qIndex: number } | null>(null)

  const nextId = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const engagedRef = useRef(false)
  const autoplayedRef = useRef(false)
  const industryRef = useRef(industry)
  useEffect(() => {
    industryRef.current = industry
  }, [industry])

  const isBusy = typing !== null

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!typing) return
    if (reducedMotion) {
      setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
      setTyping(null)
      setTypedLen(0)
      return
    }
    if (typedLen >= typing.full.length) {
      setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
      setTyping(null)
      setTypedLen(0)
      return
    }
    const ch = typing.full[typedLen]
    const delay = ch === '.' || ch === ',' || ch === ')' ? 90 : 20
    timerRef.current = setTimeout(() => setTypedLen(n => n + 1), delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [typing, typedLen, reducedMotion])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [turns, typedLen, typing, reducedMotion])

  const play = useCallback((qa: EnDemoQA) => {
    setStarted(true)
    const id = nextId.current++
    setTypedLen(0)
    setTyping({ id, q: qa.q, full: qa.a })
  }, [])

  useEffect(() => {
    if (isBusy || !pending) return
    const { qa } = pending
    setPending(null)
    const t = setTimeout(() => play(qa), 0)
    return () => clearTimeout(t)
  }, [isBusy, pending, play])

  const ask = useCallback(
    (qa: EnDemoQA, qIndex: number) => {
      if (!engagedRef.current) {
        engagedRef.current = true
        track('demo_engaged', { locale: 'en' })
      }
      track('demo_question_clicked', { q_index: qIndex, source: 'demo_en', industry: industryKey })
      if (isBusy) {
        setPending({ qa, qIndex })
        return
      }
      play(qa)
    },
    [isBusy, play, industryKey],
  )

  const switchIndustry = useCallback(
    (next: EnIndustryKey) => {
      if (next === industryKey) return
      if (timerRef.current) clearTimeout(timerRef.current)
      setPending(null)
      setIndustryKey(next)
      setTurns([])
      setTyping(null)
      setTypedLen(0)
      track('demo_question_clicked', { source: 'demo_en_tab', industry: next })
    },
    [industryKey],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry || !entry.isIntersecting) return
        if (autoplayedRef.current) return
        autoplayedRef.current = true
        observer.disconnect()
        track('demo_autoplayed', { locale: 'en' })
        play(industryRef.current.qa[0])
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [play])

  const showRecalc = turns.length > 0

  return (
    <section ref={sectionRef} id="demo" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">Try it</p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          See how Banto answers, with a sample company
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Pick an industry, then click a question to see how Banto answers based on that sample
          company&apos;s premises.
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div role="tablist" aria-label="Choose the sample company's industry" className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-neutral-400">Industry</span>
          {EN_INDUSTRIES.map(i => (
            <button
              key={i.key}
              id={`trydemo-en-tab-${i.key}`}
              type="button"
              role="tab"
              aria-selected={i.key === industryKey}
              aria-controls="trydemo-en-tabpanel"
              tabIndex={i.key === industryKey ? 0 : -1}
              onClick={() => switchIndustry(i.key)}
              className={
                i.key === industryKey
                  ? 'rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-700'
              }
            >
              {i.label}
            </button>
          ))}
        </div>

        <Card
          id="trydemo-en-tabpanel"
          role="tabpanel"
          aria-labelledby={`trydemo-en-tab-${industryKey}`}
          tabIndex={0}
          className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60"
        >
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3 w-3" aria-hidden />
            </span>
            <span className="text-xs font-semibold text-neutral-700">Banto</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              Sample company ({industry.label})
            </span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
              Remembers
            </span>
          </div>

          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                What Banto remembers about the sample company
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {industry.tags.map(tag => (
                  <span key={tag} className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 tabular-nums">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div ref={scrollRef} aria-live="polite" className="max-h-[26rem] space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && !typing && (
              <p className="py-6 text-center text-sm text-neutral-400">
                Click a question below to see Banto&apos;s answer here.
              </p>
            )}

            {turns.map(t => (
              <Conversation key={t.id} q={t.q} a={t.a} />
            ))}

            {typing && <Conversation q={typing.q} a={typing.full.slice(0, typedLen)} typing />}

            {showRecalc && !typing && (
              <div className="flex justify-center pt-1">
                <Link
                  href="/signup?next=/company&lang=en"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[13px] font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100"
                  onClick={e => {
                    track('signup_cta_clicked', { location: 'trydemo_en', cta: 'recalc', industry: industryKey })
                    const target = signupHrefWithAttribution()
                    if (target !== '/signup?next=/company&lang=en') {
                      e.preventDefault()
                      router.push(target)
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Re-run this for my own company (free)
                </Link>
              </div>
            )}
          </div>

          <p className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-2 text-[11px] leading-relaxed text-neutral-500">
            These are sample answers. After you sign up, answers are based on your own company&apos;s memory (your own rules, past decisions).
          </p>

          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              Pick a question to try
            </p>
            <div className="flex flex-wrap gap-2">
              {industry.qa.map((qa, i) => (
                <button
                  key={qa.q}
                  type="button"
                  onClick={() => ask(qa, i)}
                  aria-pressed={pending?.qIndex === i}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm ' +
                    'transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 ' +
                    (pending?.qIndex === i
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 bg-white text-neutral-700')
                  }
                >
                  <MessageSquareText className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {qa.q}
                  {pending?.qIndex === i && <span className="text-[10px] font-medium text-brand-500">Up next</span>}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-5 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            {started ? 'You can get the same kind of answer for your own company.' : 'This is how the sample company gets answered.'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Teach Banto your own rules, and answers switch to your company&apos;s premises.
          </p>
          <div className="mt-4 flex min-w-0 justify-center">
            <Link
              href="/signup?next=/company&lang=en"
              className={buttonClass({ variant: 'primary', className: 'whitespace-normal text-center' })}
              onClick={e => {
                track('signup_cta_clicked', { location: 'trydemo_en', engaged: started })
                const target = signupHrefWithAttribution()
                if (target !== '/signup?next=/company&lang=en') {
                  e.preventDefault()
                  router.push(target)
                }
              }}
            >
              Teach Banto my company, try it for real
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          This is a demo with a sample company. It is general information, not individualized legal advice.
        </p>
      </div>
    </section>
  )
}

function Conversation({ q, a, typing = false }: { q: string; a: string; typing?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">{q}</p>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <BantoMark className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
          {a}
          {typing && (
            <span aria-hidden className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-brand-500 align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}
