'use client'

import { useState } from 'react'
import { Mail, ArrowRight, Check, ClipboardCheck, Download, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// LeadCaptureEn — English counterpart of LeadCapture.tsx for /business/en
//   (2026-07-29 CTO, L3 audit #1). Same micro-CV mechanism and same API
//   (/api/company/leads, source='checklist_dl' — already in the server
//   allowlist, no backend change needed) and the same PDF asset.
//
//   Honesty note: the PDF itself (labor hand-over checklist) is written in
//   Japanese, because it is a checklist of Japanese labor-law hand-over
//   items. We say so explicitly rather than implying an English document —
//   it's still useful as a reference for an English-reading manager working
//   with a Japan-based team (feedback_no_sockpuppet_authentic_content /
//   general honesty principle: don't imply a capability that doesn't exist).
// ============================================================================

const SOURCE = 'checklist_dl'
const PDF_URL = '/downloads/banto-hikitsugi-checklist.pdf'

export default function LeadCaptureEn() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState('error')
      setErrorMsg('Please check the format of your email address.')
      return
    }
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/company/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: SOURCE, website }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setState('error')
        setErrorMsg(data?.error ?? 'Something went wrong. Please try again in a moment.')
        return
      }
      track('lead_captured', { source: 'lead_magnet_en' })
      setState('done')
    } catch {
      setState('error')
      setErrorMsg('Network error. Please try again in a moment.')
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <Card className="mx-auto max-w-2xl border-brand-200 ring-1 ring-brand-100">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>

          {state === 'done' ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Thank you</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                You can download the labor hand-over checklist (PDF, 2 pages, written in Japanese)
                right away below.
              </p>
              <a
                href={PDF_URL}
                target="_blank"
                rel="noopener"
                onClick={() => track('lead_captured', { source: 'lead_magnet_download_en' })}
                className={buttonClass({ variant: 'primary', className: 'mt-6' })}
              >
                <Download className="h-4 w-4" aria-hidden />
                Download the checklist (PDF, Japanese)
              </a>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
                <Check className="h-4 w-4" aria-hidden />
                You&apos;re signed up
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                Labor hand-over checklist (free PDF, in Japanese)
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                A 2-page checklist of the items that most often get missed when an HR/labor role
                changes hands in a Japan-based team. The PDF itself is written in Japanese (for use
                with your Japan-based staff or a local advisor). Enter your email and download it
                immediately — no other signup required.
              </p>

              <form onSubmit={onSubmit} className="mt-7 w-full max-w-md">
                <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
                  <label htmlFor="lc-en-website">Website</label>
                  <input
                    id="lc-en-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      aria-label="Email address"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => {
                        setEmail(e.target.value)
                        if (state === 'error') setState('idle')
                      }}
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className={buttonClass({ variant: 'primary', className: 'shrink-0 disabled:opacity-60' })}
                  >
                    {state === 'sending' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Sending
                      </>
                    ) : (
                      <>
                        Sign up &amp; download
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </button>
                </div>

                {state === 'error' && (
                  <p role="alert" className="mt-3 text-sm text-danger-600">
                    {errorMsg}
                  </p>
                )}

                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  We&apos;ll use your email only to send this resource and occasional updates about
                  Banto. You can unsubscribe at any time.
                </p>
              </form>
            </>
          )}
        </div>
      </Card>
    </section>
  )
}
