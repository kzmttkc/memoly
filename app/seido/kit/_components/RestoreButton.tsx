'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

// ============================================================================
// RestoreButton — 購入の復元（honbun の未購入ビューに置く）
//   決済完了リダイレクトを踏み損ねた購入者の救済。POST /api/seido/kit/restore が
//   Stripe 側の succeeded 決済を引き当てたらリロードで honbun が開く。
// ============================================================================

export function RestoreButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function restore() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/seido/kit/restore', { method: 'POST' })
      if (res.ok) {
        window.location.reload()
        return
      }
      if (res.status === 404) {
        setMessage('このアカウントでの購入記録が見つかりませんでした。購入時と同じメールアドレスでログインしているかご確認ください。')
      } else {
        setMessage('復元に失敗しました。時間をおいてもう一度お試しください。')
      }
    } catch {
      setMessage('通信に失敗しました。時間をおいてもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline hover:text-brand-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        購入済みの方はこちら（購入を復元する）
      </button>
      {message && <p className="max-w-md text-center text-xs text-neutral-500">{message}</p>}
    </div>
  )
}
