'use client'

import { useEffect } from 'react'
import {
  VARIANT_KEY,
  VARIANT_COOKIE_MAX_AGE,
} from '../_lib/variant-shared'

// ============================================================================
// ForcePaidVariant — 広告着地時に H1 変種を B 固定へ同期する（I11・2026-07-23）。
//
//   仕組み: page.tsx（サーバー）が searchParams の utm_medium=paid 等を検知したら
//   SSR 描画を variant='B' に固定し、本コンポーネントを併置する。middleware には
//   触れない（作業境界）ため、middleware が発行済みの cookie が 'A' のままの
//   可能性がある。そのままだとクライアント計測(trackV→getVariant=cookie読み)が
//   「Aと申告しながらBを見せる」矛盾になるので、マウント時に cookie と
//   localStorage を 'B' へ上書きして SSR 表示と計測を一致させる。
//
//   注意: 広告経由の来訪はこの時点でバケットが B に固定される（意図どおり。
//   広告LPは勝者候補Bを常に見せる、が I11 の要件）。オーガニック来訪の
//   A/B配信には一切影響しない（このコンポーネントは paid 検知時のみ描画）。
// ============================================================================

export default function ForcePaidVariant() {
  useEffect(() => {
    try {
      document.cookie = `${VARIANT_KEY}=B; path=/; max-age=${VARIANT_COOKIE_MAX_AGE}; SameSite=Lax`
      window.localStorage.setItem(VARIANT_KEY, 'B')
    } catch {
      // 計測同期のベストエフォート。失敗しても表示は変えない。
    }
  }, [])
  return null
}
