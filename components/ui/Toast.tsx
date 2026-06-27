'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  show: boolean
  onHide: () => void
  /**
   * 任意のアクション（例: 削除の取り消し）。指定すると本文の右にボタンを出す。
   * アクション付きトーストは自動消滅までの猶予を長めにする。
   */
  action?: { label: string; onClick: () => void }
}

export function Toast({ message, show, onHide, action }: ToastProps) {
  useEffect(() => {
    if (show) {
      // アクション（undo等）があるときは押す猶予を長めに取る。
      const t = setTimeout(onHide, action ? 6000 : 3000)
      return () => clearTimeout(t)
    }
  }, [show, onHide, action])

  if (!show) return null

  return (
    <div
      role="status"
      className="animate-fade-in fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-8"
    >
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick()
            onHide()
          }}
          className="rounded-md px-2 py-0.5 text-sm font-semibold text-brand-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
