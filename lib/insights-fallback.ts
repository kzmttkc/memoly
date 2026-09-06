// ============================================================================
// insights-fallback.ts — 能動インサイトの「出所」の語彙と開示（LLM非依存・クライアント安全）
// ----------------------------------------------------------------------------
//   背景（2026-09-07）:
//     lib/insights-core.ts は Anthropic 呼び出しが落ちると空配列を返し、しかも
//     source を 'sonnet' と自称していた。下流（API・画面）からは「調べた結果0件」と
//     区別できず、画面は「該当しそうな助成金は見つかりませんでした」「自社に直接
//     関係しそうな法改正は見つかりませんでした」と断定していた。
//     ＝Anthropic の障害が、労務製品における「無い」という積極的な事実主張に化けていた。
//
//   直し方は新規ではなく既存の踏襲: リスク診断は同じ問題を lib/risk-fallback.ts の
//   riskResultOrigin / RISK_FALLBACK_NOTICE で既に解いている。語彙・トーン・
//   「クライアント安全な別モジュールに置く」という配置まで、そちらに揃える。
//
//   配置の理由（risk-fallback.ts と同じ）: 画面はクライアントコンポーネントなので、
//   開示文言を insights-core.ts（Anthropic SDK とプロンプト全文を抱えるサーバ専用）
//   から import するとバンドルへ漏れる。LLM非依存の語彙だけをここに置く。
// ============================================================================

/**
 * 能動インサイト（助成金 / 法改正）の生成結果の出所。
 *   'dify'        — 旧経路（現在は未使用。過去のキャッシュ payload 互換のため残置）
 *   'sonnet'      — モデルが応答した（0件でも「調べた結果0件」）
 *   'unavailable' — モデル呼び出しが失敗した（＝何も分かっていない。0件ではない）
 */
export type InsightsSource = 'dify' | 'sonnet' | 'unavailable'

/**
 * 画面のセクション1つの表示状態。
 *   'unavailable' — 取得できなかった（開示を出す。「見つかりませんでした」は出さない）
 *   'empty'       — 本当に0件だった（「見つかりませんでした」を出してよい唯一の場合）
 *   'ok'          — 件数あり
 */
export type InsightsSectionState = 'unavailable' | 'empty' | 'ok'

/**
 * 「見つかりませんでした」を出してよいかの唯一の判断。
 * 画面はこの関数の戻り値だけで出し分ける（判定を各セクションに散らさない）。
 */
export function insightsSectionState(
  source: InsightsSource | undefined,
  count: number,
): InsightsSectionState {
  // 失敗は件数より重い。0件かどうかは、そもそも調べられていないので判定できない。
  if (source === 'unavailable') return 'unavailable'
  return count > 0 ? 'ok' : 'empty'
}

/** どちらか一方でも取得できていなければ、画面全体として「取得できなかった」扱いにする。 */
export function isInsightsUnavailable(...sources: (InsightsSource | undefined)[]): boolean {
  return sources.some(s => s === 'unavailable')
}

/**
 * 取得に失敗したときの開示（事実表示のみ・断定しない）。
 * 文言のトーンは RISK_FALLBACK_NOTICE に揃える（新しい訴求文言を作らない）。
 */
export const INSIGHTS_UNAVAILABLE_NOTICE = {
  title: 'AIによる精査ができなかったため、今回は結果を表示できません',
  body: '一時的な不具合の可能性があります。時間をおいてもう一度診断してください。対象が無いと判断したわけではありません。',
}
