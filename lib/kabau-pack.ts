// ============================================================================
// kabau-pack.ts — 番頭 → Kabau（sharoushi-agent.com）カスハラ実務パック導線の SSOT
//   (WORK_ORDERS.md Trust Stack v2 #3 番頭側・PDCA H45・2026-08-21)
//
//   置き場所は2つ（それぞれ1箇所）:
//     - /roumu/[slug] のカスハラ関連記事の末尾（app/roumu/[slug]/_components/KabauPackCta.tsx）
//     - チャットでカスハラ判定された回答の末尾（lib/law-citations.ts の trailer →
//       components/ui/AnswerSources.tsx が描画）
//
//   文言は Kabau側 site/kasuhara-*-guide.html の .pack-cta 既存文をそのまま使う
//   （新規コピーを書かない・feedback-no-copywriting）。セット割引・同梱課金は作らない
//   （Stripe共有口座のクロス汚染を 8/21 に修理したばかり。ここは外部リンクだけ）。
//
//   計測: クリックは既存の Plausible 計測（lib/analytics track）で
//   kabau_pack_cta_click { source: 'roumu_article' | 'chat_answer', ... } として取れる。
//   Kabau側は utm_source=banto / utm_campaign=kabau_set で着地を識別する。
//
//   このファイルは Node の単体テスト（tests/unit/*.test.ts）から直接 import されるため、
//   '@/...' エイリアスや JSON import を使わない（相対 import も不要な純粋定数＋関数）。
// ============================================================================

/** Kabau 実務パックLP（utm 付き）。WORK_ORDERS.md #3 で確定したURLをそのまま使う。 */
export const KABAU_PACK_URL =
  'https://sharoushi-agent.com/kasuhara-pack.html?utm_source=banto&utm_medium=referral&utm_campaign=kabau_set'

/**
 * Kabau側 site/kasuhara-shugyokisoku-kitei-guide.html の .pack-cta（上段）と同一文。
 *   .pack-cta-title / .pack-cta-sub / .pack-cta-btn に対応。
 */
export const KABAU_PACK_COPY = {
  title: '足りない措置の書式は、Wordで渡せます',
  sub: '就業規則の改定条文3パターンと、窓口・事実確認・研修などの書式10点です。中身を見てから判断できます。',
  button: '実務パックの中身を見る（19,800円）→',
} as const

// カスハラ限定の語彙。セクハラ／パワハラ単独の相談には導線を付けない
//   （legal-facts の harassment_2026 キーワードは「ハラスメント」全般を含むため流用しない）。
const KASUHARA_RE =
  /カスハラ|カスタマーハラスメント|カスタマー・ハラスメント|カスタマーハラス|顧客ハラスメント|著しい迷惑行為|悪質(?:な)?クレーム|クレーマー/

/** 相談文・記事見出しがカスハラ文脈かどうか（限定語彙での判定）。 */
export function isKasuharaQuery(text: string): boolean {
  if (!text) return false
  return KASUHARA_RE.test(text)
}

// /roumu/[slug] のカスハラ関連記事判定。
//   機械追記の usecase-auto.json には 'kashara' 'cashara' 'kasutoma-hara'
//   'customer-harassment' といった slug の表記揺れがある（2026-08-21 実測）ため、
//   slug と h1 の両方で拾う。
const KASUHARA_SLUG_RE = /kasuhara|kashara|cashara|kasutoma-hara|customer-harassment/

/** 記事（slug と h1 だけ見る）がカスハラ関連かどうか。 */
export function isKasuharaUseCase(u: { slug: string; h1: string }): boolean {
  return KASUHARA_SLUG_RE.test(u.slug) || isKasuharaQuery(u.h1)
}
