// ============================================================================
// analytics-once — 「1訪問に1回だけ」の発火ガード
//
//   なぜ要るか（2026-08-25 実測）:
//     Plausible 30日・hostname=banto-roumu.com
//       signup_started       events 67 / visitors 6 = 1人あたり11.2回
//       signup_context_shown events 34 / visitors 5 = 1人あたり 6.8回
//       signup_completed     events  2 / visitors 2 = 1.0（正常）
//
//     signup_started は useEffect の依存に **useMemo が返すオブジェクト**
//     (attribution) を置いていた。依存配列は参照同一性で比較するため、
//     searchParams の同一性が変わって useMemo が作り直されるたびに effect が
//     再実行され、同じ訪問で何度も発火していた。signup_context_shown は依存が
//     プリミティブなので参照同一性では再発火しないが、どちらも発火ガードが
//     無く、同一タブ内の再マウント（Suspense 境界の再サスペンド・戻る/進む）で
//     素通りしていた。
//
//     段2（名前を取る・gtm-doctrine.md §2）の件数を数えるのに、この母数が
//     壊れていると「増えたのか」を判定できない。
//
//   直し方の考え方:
//     参照同一性に一切依存しない。**安定した文字列キー**で「この訪問でもう
//     発火したか」を憶える。依存配列が何回変わっても、コンポーネントが何回
//     マウントし直されても、1訪問1回に収束する。
//
//     憶える先は sessionStorage（タブを閉じれば消える＝訪問の粒度）。
//     localStorage にすると「別日に来た同じ人」が永久に計上されなくなり、
//     visitors（期間内のユニーク）と粒度が合わなくなる。
//
//   このファイルは純粋関数だけを持つ（window に触らない）。ストアを引数で
//   受けるので node --test でそのまま検証できる。実際に sessionStorage を
//   渡すのは lib/analytics.ts の trackOncePerVisit。
// ============================================================================

/** sessionStorage の中で他の用途と衝突しないための接頭辞。 */
export const ONCE_KEY_PREFIX = 'banto_once_'

/** shouldFireOnce が要求するストアの最小面（sessionStorage の部分集合）。 */
export interface OnceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * この訪問で `key` がまだ発火していなければ true を返し、発火済みとして記録する。
 * 2回目以降は false。
 *
 * ストアが例外を投げる環境（プライベートブラウズ・storage 無効）では
 * **true を返す**。計測の重複より、画面が動くことを優先する
 * （既存の track() が計測失敗を握りつぶすのと同じ方針）。
 */
export function shouldFireOnce(key: string, store: OnceStore): boolean {
  const storageKey = ONCE_KEY_PREFIX + key
  try {
    if (store.getItem(storageKey)) return false
    store.setItem(storageKey, '1')
    return true
  } catch {
    // storage が使えない環境。ここで止めると計測が丸ごと落ちるので通す。
    return true
  }
}
