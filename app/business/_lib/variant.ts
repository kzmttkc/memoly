'use client'

import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'

// ============================================================================
// LP A/B variant レール — /business 公開LPの「変種別 PDCA」を物理的に回すための土台。
//
//   なぜ必要か: これまで LP には variant/experiment/bucket の分岐機構が無く、
//   ファネルイベント(signup_cta_clicked / demo_engaged / lead_captured / …)は
//   揃っていても「どの変種の来訪か」を示すキーが無いため、変種別集計＝A/B の
//   閉ループ(PDCA)が物理的に回せなかった。ここで着地時に安定バケット(A/B)を
//   1回だけ決めて固定し、このページの全 track() に variant を注入する。
//
//   設計原則（回帰リスクゼロ）:
//     - 変種決定は必ずクライアント側（localStorage +補助cookie に固定）。
//       サーバーコンポーネント/metadata/ISR は一切触らない＝静的化(/business)を
//       壊さない。ビルド時に特定の変種へ固定化されることもない。
//     - SSR と最初のハイドレーションは常に 'A'（現行UIと完全一致）。マウント後の
//       useEffect で実バケットを読み、'B' の来訪だけがアイブロー＋サブコピーを
//       差し替える。variant='A' の来訪は最初から最後まで現行UIと同一（回帰なし）。
//     - low-cardinality 2値のみ（'A' | 'B'）。lib/analytics.ts の track 規約
//       （PIIなし・低カーディナリティ）を厳守。utm 引き継ぎ(TrackedCTA)は無傷。
// ============================================================================

export type LpVariant = 'A' | 'B'

const VARIANT_KEY = 'banto_lp_variant'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180 // 180日

/**
 * 着地時に安定バケット(A/B)を1回だけ決めて固定し、返す。
 *   - 既に localStorage に決定済みならそれを返す（同一来訪者は常に同じ変種）。
 *   - 未決定なら 50/50 で割り当て、localStorage + 補助 cookie に固定する。
 *   - サーバー / localStorage 不可時は 'A'（現行UI）にフォールバック＝安全側。
 * PII は扱わない。値は 'A' | 'B' の 2値のみ。
 */
export function getVariant(): LpVariant {
  if (typeof window === 'undefined') return 'A'
  try {
    const stored = window.localStorage.getItem(VARIANT_KEY)
    if (stored === 'A' || stored === 'B') return stored
    const assigned: LpVariant = Math.random() < 0.5 ? 'A' : 'B'
    window.localStorage.setItem(VARIANT_KEY, assigned)
    document.cookie = `${VARIANT_KEY}=${assigned}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    return assigned
  } catch {
    return 'A'
  }
}

/**
 * 変種を購読する React フック。
 *   SSR と最初のハイドレーションは 'A' を返し（サーバー出力と一致＝ハイドレーション
 *   不整合を起こさない）、マウント後に実バケットへ更新する。'A' は不変・'B' のみ
 *   マウント後に差し替わる（現行UI＝'A' は回帰ゼロ）。
 */
export function useVariant(): LpVariant {
  const [variant, setVariant] = useState<LpVariant>('A')
  useEffect(() => {
    setVariant(getVariant())
  }, [])
  return variant
}

type TrackProps = Record<string, string | number | boolean>

/**
 * track() に現在の変種(variant='A'|'B')を注入して送出する薄いラッパ。
 *   /business 配下のクライアントコンポーネントはこれを経由して計測することで、
 *   全ファネルイベントが変種キーを持ち、変種別集計(PDCA)が回せるようになる。
 *   variant は低カーディナリティ2値のみ・PIIは載せない（既存 track 規約を継承）。
 */
export function trackV(event: string, props?: TrackProps) {
  track(event, { ...(props ?? {}), variant: getVariant() })
}
