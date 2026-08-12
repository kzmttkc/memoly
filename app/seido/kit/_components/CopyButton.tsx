'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// 文面セットの各文面をワンクリックでクリップボードへ（honbun 専用の小物）
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* クリップボード不可の環境では黙って何もしない（本文は画面上にある） */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg border border-neutral-500 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
      aria-label={`${label}をコピー`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'コピーしました' : '本文をコピー'}
    </button>
  )
}
