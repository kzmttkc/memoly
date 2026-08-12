'use client'

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { track } from '@/lib/analytics'

// ============================================================================
// BuyButton — キット購入CTA（クライアント境界）
//   POST /api/seido/kit/checkout → Stripe Checkout へ遷移。
//   未ログイン(401)は signup へ（utm を明示し signup_completed の帰属を保つ）。
//   計測: クリックで seido_kit_cta を1発（props.location で面を区別）。
// ============================================================================

const SIGNUP_HREF = '/signup?next=/seido/kit&utm_source=seido&utm_campaign=kit'

export function BuyButton({ location, label }: { location: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (busy) return
    setBusy(true)
    setError(null)
    track('seido_kit_cta', { location })
    try {
      const res = await fetch('/api/seido/kit/checkout', { method: 'POST' })
      if (res.status === 401) {
        window.location.href = SIGNUP_HREF
        return
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string }
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError('決済ページを開けませんでした。時間をおいてもう一度お試しください。')
    } catch {
      setError('通信に失敗しました。時間をおいてもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={buttonClass({ variant: 'secondary', size: 'lg' })}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {error && <p className="text-xs text-red-100">{error}</p>}
    </div>
  )
}
