'use client'

import { track } from '@/lib/analytics'
import {
  type LpVariant,
  VARIANT_KEY,
  VARIANT_COOKIE_MAX_AGE,
  VARIANT_B_RATIO,
  isLpVariant,
} from './variant-shared'

// ============================================================================
// LP A/B variant レール — /business 公開LPの「変種別 PDCA」を物理的に回すための土台。
//
//   なぜ必要か: これまで LP には variant/experiment/bucket の分岐機構が無く、
//   ファネルイベント(signup_cta_clicked / demo_engaged / lead_captured / …)は
//   揃っていても「どの変種の来訪か」を示すキーが無いため、変種別集計＝A/B の
//   閉ループ(PDCA)が物理的に回せなかった。着地時に安定バケット(A/B)を
//   1回だけ決めて固定し、このページの全 track() に variant を注入する。
//
//   2026-07-23 A02 SSRバイアス修正:
//     変種の一次決定は middleware（サーバー側）へ移した。middleware が着地時に
//     cookie(banto_lp_variant) を確定し、SSR HTML の段階で変種が焼き込まれる。
//     ここ（クライアント）は cookie を最優先で読み、SSR と必ず同じ変種を返す。
//     localStorage は旧来訪者のバケット維持と cookie 失効時のフォールバック。
//     middleware を通らない経路（万一）だけ、クライアントで 70/30 割当を行う。
//
//   設計原則:
//     - low-cardinality 2値のみ（'A' | 'B'）。lib/analytics.ts の track 規約
//       （PIIなし・低カーディナリティ）を厳守。utm 引き継ぎ(TrackedCTA)は無傷。
//     - 既存の計測語彙（イベント名・variant プロパティ）は変更しない。
// ============================================================================

export type { LpVariant }

function readCookieVariant(): LpVariant | null {
  const m = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${VARIANT_KEY}=(A|B)(?:;|$)`),
  )
  return m && isLpVariant(m[1]) ? m[1] : null
}

/**
 * 現在の変種を返す。優先順位:
 *   1. cookie（middleware=SSR が確定した値。SSR HTML と必ず一致させる）
 *   2. localStorage（旧来訪者のバケット維持）→ cookie にも再固定
 *   3. どちらも無ければクライアントで 70/30 割当（middleware 未経由の保険）
 * PII は扱わない。値は 'A' | 'B' の 2値のみ。
 */
export function getVariant(): LpVariant {
  if (typeof window === 'undefined') return 'A'
  try {
    const fromCookie = readCookieVariant()
    if (fromCookie) {
      // SSR の確定値を正としてローカルにも同期（旧値との食い違いを解消）
      window.localStorage.setItem(VARIANT_KEY, fromCookie)
      return fromCookie
    }
    const stored = window.localStorage.getItem(VARIANT_KEY)
    const assigned: LpVariant = isLpVariant(stored)
      ? stored
      : Math.random() < VARIANT_B_RATIO
        ? 'B'
        : 'A'
    window.localStorage.setItem(VARIANT_KEY, assigned)
    document.cookie = `${VARIANT_KEY}=${assigned}; path=/; max-age=${VARIANT_COOKIE_MAX_AGE}; SameSite=Lax`
    return assigned
  } catch {
    return 'A'
  }
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
