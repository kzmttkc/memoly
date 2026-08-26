'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

// ============================================================================
// lib/theme — Kabau 会社版のテーマ制御（ライト既定 + トグル + システム追従）。
// ----------------------------------------------------------------------------
//   CEO裁定: ICP（中小企業の総務/経営者）向けに既定はライト。ユーザーが
//   ダーク/ライト/システムを選べ、選択は localStorage('banto-theme') に永続化する。
//   'system' 時は prefers-color-scheme の変化にライブ追従する。
//
//   実効テーマは <html data-theme="light|dark"> で表現し、CSS 側は
//   [data-theme='dark'] .company-light に限定して適用する（他ルートへ非波及）。
//   初回ペイントの FOUC は /public/banto-theme-init.js（beforeInteractive）が防ぐ。
//   本 Provider はマウント後の同期・トグル・システム追従を担う。
// ============================================================================

export type ThemePref = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'banto-theme'

interface ThemeCtx {
  /** ユーザーの選好（light / dark / system） */
  pref: ThemePref
  /** 実際に適用中のテーマ（system を解決した結果） */
  resolved: Resolved
  setPref: (p: ThemePref) => void
  /** light ⇄ dark を素早く往復（system は現在の実効の逆へ確定）。 */
  toggle: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

function systemDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolve(pref: ThemePref): Resolved {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return systemDark() ? 'dark' : 'light'
}

function apply(resolved: Resolved) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 初期値は SSR では 'light'（DOM を触らない）。マウント後に保存値へ同期する。
  //   D11(2026-07-23): 既定はブランド固定ライト。OS がダークでも、ユーザーが明示的に
  //   切り替えるまではライトで出す（保存値が無いときの既定を 'system'→'light' に変更）。
  const [pref, setPrefState] = useState<ThemePref>('light')
  const [resolved, setResolved] = useState<Resolved>('light')

  // マウント時: 保存値を読み、実効テーマを DOM と state に反映。
  useEffect(() => {
    let stored: ThemePref = 'light'
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'light' || v === 'dark' || v === 'system') stored = v
    } catch {
      /* localStorage 不可は system */
    }
    const r = resolve(stored)
    setPrefState(stored)
    setResolved(r)
    apply(r)
  }, [])

  // system 選好のときだけ OS 設定の変化にライブ追従。
  useEffect(() => {
    if (pref !== 'system') return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const r: Resolved = mq.matches ? 'dark' : 'light'
      setResolved(r)
      apply(r)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* 保存失敗は無視（当該セッションのみ有効） */
    }
    const r = resolve(p)
    setResolved(r)
    apply(r)
  }, [])

  const toggle = useCallback(() => {
    setPref(resolve(pref) === 'dark' ? 'light' : 'dark')
  }, [pref, setPref])

  const value = useMemo<ThemeCtx>(
    () => ({ pref, resolved, setPref, toggle }),
    [pref, resolved, setPref, toggle],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Provider 外でも壊さない（no-op なフォールバック）。
    return {
      pref: 'system',
      resolved: 'light',
      setPref: () => {},
      toggle: () => {},
    }
  }
  return ctx
}
