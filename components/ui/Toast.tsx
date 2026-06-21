'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  show: boolean
  onHide: () => void
}

export function Toast({ message, show, onHide }: ToastProps) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onHide, 3000)
      return () => clearTimeout(t)
    }
  }, [show, onHide])

  if (!show) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-lg animate-fade-in">
      {message}
    </div>
  )
}
