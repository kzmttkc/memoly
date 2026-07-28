'use client'

import { useSyncExternalStore } from 'react'
import { DEFAULT_INDUSTRY, type IndustryKey } from './industries'

// ============================================================================
// industry-selection — ヒーローの業種チップ(IndustryHeroPreview)と体験デモ
//   (TryDemo)の「選択中の業種」を引き継ぐための最小限の共有ストア。
//
//   2026-07-28 CTO修正（L1監査#11）: 従来は各コンポーネントが独立した
//   useState を持ち、ヒーローで選んだ業種が下の体験デモに引き継がれず
//   リセットされていた（ペルソナ1指摘）。
//
//   設計: モジュール変数 + purchase(サブスク)。React Context で親を跨いで
//   包み直す構造変更はせず（回帰リスクを避ける）、useSyncExternalStore で
//   同一クライアントバンドル内の2つの独立した島（IndustryHeroPreview は
//   通常SSR・TryDemo は dynamic(ssr:false)）を素の値の同期のみで繋ぐ。
//   IndustryHeroPreview 自身の初期表示（FV01・selected=null）は不変
//   （Takeshi承認済みブランドのため、この値でヒーロー側の初期状態を
//   上書きしない＝読み出しはせず書き込みのみ行う）。
// ============================================================================

let current: IndustryKey = DEFAULT_INDUSTRY
const listeners = new Set<() => void>()

export function getSharedIndustry(): IndustryKey {
  return current
}

export function setSharedIndustry(next: IndustryKey): void {
  if (current === next) return
  current = next
  listeners.forEach(l => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** TryDemo など、ストア変化を購読して自前のstateへ同期したいコンポーネント向け。 */
export const subscribeSharedIndustry = subscribe

/** クライアント専用（ssr:false）フックとしてのみ使う。SSR文脈では既定値のみ返す。 */
export function useSharedIndustry(): IndustryKey {
  return useSyncExternalStore(subscribe, getSharedIndustry, () => DEFAULT_INDUSTRY)
}
