// ============================================================================
// instrumentation.ts — Sentry 計装（env-gate方式・P1）
// ----------------------------------------------------------------------------
// 方針:
//   - SENTRY_DSN が無ければ完全 no-op（本番挙動・バンドルに一切影響しない）。
//   - @sentry/nextjs は「まだ入れていない」。DSN 投入時に `npm i @sentry/nextjs` する運用。
//     そのため import は動的（変数指定子＋ignoreヒント）にして、未導入でもビルドを壊さない。
//   - 手順（アカウント作成・DSN取得・パッケージ導入）は docs/BANTO_BACKUP_RESTORE.md 末尾
//     の「外形監視/エラー監視のセットアップ」に記載（Takeshi手動タスク）。
//   無料枠: Sentry Developer(無料) は 5,000 errors/月・1ユーザー。就業規則AIの現トラフィックでは十分。
// ============================================================================

// 変数指定子にして bundler の静的解決を回避（未導入でもビルドを通す）。
const SENTRY_PKG = '@sentry/' + 'nextjs'

export async function register() {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SENTRY_PKG)
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      // PIIは送らない（労務データを外部に出さない安全既定）。
      sendDefaultPii: false,
    })
    console.log('[instrumentation] Sentry 有効化しました')
  } catch {
    // 未導入(=パッケージ無し)なら no-op。DSN投入時に `npm i @sentry/nextjs`。
    console.warn('[instrumentation] SENTRY_DSN あり／@sentry/nextjs 未導入のためスキップ')
  }
}

// Next.js 公式のサーバ側エラーフック。Sentry 有効時のみ転送。
export async function onRequestError(
  ...args: unknown[]
): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SENTRY_PKG)
    // Sentry SDK が提供する場合のみ転送（シグネチャ差異に耐える）。
    Sentry.captureRequestError?.(...args)
  } catch {
    // no-op
  }
}
