'use client'

/**
 * Memoly 自前ファネル計測ヘルパー（Plausible カスタムイベント）
 *
 * - layout.tsx で読み込まれる window.plausible キューを使う（既存パターン踏襲）
 * - 計測の失敗が機能を壊さないよう、すべて try/catch で握りつぶす
 * - PII（メール本文・記憶内容）は props に入れない。件数・種別など非個人情報のみ
 */

type PlausibleProps = Record<string, string | number | boolean>

export function track(event: string, props?: PlausibleProps) {
  try {
    if (typeof window === 'undefined') return
    const plausible = (window as unknown as { plausible?: (e: string, opts?: { props: PlausibleProps }) => void }).plausible
    if (props) plausible?.(event, { props })
    else plausible?.(event)
  } catch {
    /* 計測失敗は無視。機能本体に影響させない */
  }
}

const RETURN_KEY = 'memoly_first_visit'

/**
 * リテンション最小代理: 初回訪問日を localStorage に記録し、
 * 別日（暦日が異なる）にアクセスしたら returning_user を1回だけ発火する。
 * 同一日内の複数回ロードでは発火しない（リロード過剰計測を避ける）。
 */
export function trackReturningVisit() {
  try {
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD（ローカル基準で十分な粒度）
    const first = localStorage.getItem(RETURN_KEY)
    if (!first) {
      localStorage.setItem(RETURN_KEY, today)
      return
    }
    if (first !== today) {
      const lastFired = localStorage.getItem('memoly_returning_fired_on')
      if (lastFired !== today) {
        localStorage.setItem('memoly_returning_fired_on', today)
        track('returning_user')
      }
    }
  } catch {
    /* localStorage 不可・計測失敗は無視 */
  }
}
