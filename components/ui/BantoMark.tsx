import type { SVGProps } from 'react'

// ============================================================================
// BantoMark — 就業規則AIブランドマーク L01（2026-07-23 Takeshi承認）。
//   「一本の線（積み上がる記憶）と、続きを示す点」。lucide Brain の全数置換用で、
//   同じ className（h-3.5 w-3.5 等）/ aria-hidden がそのまま使えるドロップイン。
//   currentColor 描画のため、ダークUI（/company data-theme='dark'）でも文脈色に
//   自動追従する（dark専用の別コンポーネントは不要）。
//   タイル付きの完全なロゴ（藍地 #243B6E + 生成りマーク）は public/brand/
//   banto-icon.svg / banto-icon-dark.svg を使う。既存の「bg-brand-600 の角丸
//   タイル + 白マーク」ラッパーは、G05 で brand-600=#243B6E となったため
//   このマークを入れるだけで L01 と同一の見た目になる。
// ============================================================================

export function BantoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <line
        x1="3.2"
        y1="12"
        x2="15.2"
        y2="12"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="20.3" cy="12" r="2.05" fill="currentColor" />
    </svg>
  )
}
