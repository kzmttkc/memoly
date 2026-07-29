'use client'

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

// ============================================================================
// Disclosure — キーボード操作を明示的に保証する開閉トリガー(<details>/<summary>互換)。
//
//   2026-07-29 CTO修正（UX監査Round4#10・軽微）: /business の段階的開示
//   （SmartHR併用者向け補足・専門用語補足など）はネイティブ<details>/<summary>で
//   実装済みで、Chromiumでの実測（Enter/Space両方）では正しくトグルすることを
//   確認済み。ただしSummary要素のキーボード活性化はWebKit/Safariで長年
//   不完全だった経緯があり（監査ペルソナ9・情シス担当がキーボード未対応を
//   報告）、ブラウザのネイティブ実装差に依存させず、常に同じ挙動を保証する
//   ためクリック・Enter・Spaceのすべてを明示的にハンドリングする薄いラッパー。
//   - <summary>にtabIndex=0（フォーカス可能を明示）
//   - onClickでネイティブのtoggleをpreventDefaultし、React stateで制御
//   - onKeyDownでEnter/Spaceを明示的にtoggleへ紐付け（ネイティブの活性化に依存しない）
//   - DOM構造は<details>/<summary>のまま＝SEO/GEO(クローラが閉じていても本文を
//     読める)・no-JS時の描画は不変（JS無効時はネイティブ<details>の既定動作に
//     フォールバックする＝Progressive Enhancement）。
// ============================================================================

export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  className?: string
  summaryClassName?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const onSummaryClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault()
    setOpen(v => !v)
  }

  const onSummaryKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      setOpen(v => !v)
    }
  }

  return (
    <details className={className} open={open}>
      <summary
        className={summaryClassName}
        tabIndex={0}
        onClick={onSummaryClick}
        onKeyDown={onSummaryKeyDown}
      >
        {summary}
      </summary>
      {children}
    </details>
  )
}
