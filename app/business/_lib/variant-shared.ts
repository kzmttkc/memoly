// ============================================================================
// variant-shared — LP A/B 変種の共有定数（'use client' なし）。
//   middleware(edge) / サーバーコンポーネント(page.tsx) / クライアント(variant.ts)
//   の3面から同じ定数を参照するための置き場。'use client' 付きの variant.ts を
//   middleware から import すると RSC バンドラ境界の事故になるため分離した。
//
//   A02 SSRバイアス修正（2026-07-23）:
//     従来は SSR/初回ハイドレーションが常に 'A' で、'B' はマウント後の useEffect
//     差し替えだった。この方式は (1) JS未実行の来訪・ボットが全てAを見る、
//     (2) B群だけ描画差し替えが走り LCP/CLS が A と異なる、という計測バイアスを
//     生んでいた（output/0723/banto_report_factcheck.md で実測確認）。
//     修正後は middleware が着地時に cookie で変種を確定し、SSR HTML の段階で
//     変種が焼き込まれる。クライアント getVariant() も cookie を最優先で読む。
//
//   配信比率: 2026-08-29 HERO_WINNER=B 焼き戻し後、新規割当は B=100%。
//   既存来訪者は既に cookie/localStorage に固定済みの変種を維持する。
// ============================================================================

export type LpVariant = 'A' | 'B'

/** cookie / localStorage 共通キー（従来の値を引き継ぐため名前は変えない） */
export const VARIANT_KEY = 'banto_lp_variant'

/** cookie の生存期間: 180日（従来値を踏襲） */
export const VARIANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180

/** B案（カテゴリ即解型H1）の配信比率。新規割当にのみ適用。勝ち焼き戻し後は 1.0。 */
export const VARIANT_B_RATIO = 1.0

/** SSR で page.tsx へ変種を渡す内部ヘッダ名（middleware が付与） */
export const VARIANT_HEADER = 'x-banto-lp-variant'

/**
 * 主要クローラの UA 判定。ボットは cookie を保持しないため毎リクエストで
 * 変種が振れて検索スナップショットが揺れる。多数派の 'B' に固定して安定させる
 * （cookie は発行しない＝キャッシュ/計測を汚さない）。
 */
export const BOT_UA_RE =
  /bot|crawl|spider|slurp|bingpreview|googlebot|duckduck|baiduspider|yandex|gptbot|claudebot|perplexity|applebot|facebookexternalhit|linkedinbot|twitterbot/i

export function isLpVariant(v: unknown): v is LpVariant {
  return v === 'A' || v === 'B'
}
