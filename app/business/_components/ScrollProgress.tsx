'use client'

import { useEffect, useRef } from 'react'

// ============================================================================
// ScrollProgress — 長尺LPの読了位置を示す極細プログレスバー（B19・2026-07-23）。
//   - compositor 安全: 幅でなく transform: scaleX を直接 DOM に書く。
//     React の再レンダリングは一切走らせない（state を持たない）。
//   - passive scroll + requestAnimationFrame で1フレーム1回に間引く。
//   - 装飾のため aria-hidden・pointer-events-none。CSPの style-src 制約は
//     JSからの CSSOM 操作（el.style.transform）には及ばないため安全。
// ============================================================================

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.transform = `scaleX(${ratio})`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left scale-x-0 bg-brand-600/80 will-change-transform"
      />
    </div>
  )
}
