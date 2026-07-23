// ============================================================================
// errors.ts — API エラー文言のクライアント日本語化（L4: 生英語エラーの露出を潰す）
//   会社作成/属性保存/自社ルール等の各ハンドラは `data.error ?? '…に失敗しました'`
//   でサーバのエラー文字列をそのまま画面に出していた。サーバが技術的な英語
//   （'Unauthorized' 等）を返すと、日本語UIに赤字の生英語が漏れる（P08 実測）。
//
//   方針（docs/BRAND_VOICE.md 準拠・敬体・次の一手を添える）:
//     - 既知の英語/技術エラーは、意味の通る日本語＋次の一手に置換する。
//     - サーバが日本語（利用者向けに整えた文言）を返していれば、それはそのまま使う。
//     - 未知の英語など日本語以外は、生のまま出さず fallback（日本語敬体）に寄せる。
//   ★純関数・LLM非依存。呼び出し側は `localizeError(data.error, '…に失敗しました')`。
// ============================================================================

const KNOWN: Record<string, string> = {
  unauthorized:
    'ログインが確認できませんでした。お手数ですが、一度ログインし直してからもう一度お試しください。',
  'not authorized':
    'ログインが確認できませんでした。お手数ですが、一度ログインし直してからもう一度お試しください。',
  forbidden:
    'この操作を行う権限が確認できませんでした。会社の管理者の方にご確認いただけますか。',
  'bad request':
    '入力内容を確認できませんでした。お手数ですが、内容をご確認のうえもう一度お試しください。',
  'not found':
    '対象が見つかりませんでした。画面を再読み込みして、もう一度お試しいただけますか。',
  'internal server error':
    'サーバー側で問題が発生しました。少し時間をおいて、もう一度お試しください。',
  'too many requests':
    'アクセスが集中しています。少し時間をおいて、もう一度お試しください。',
}

/** 日本語（かな/カナ/漢字）を1文字でも含むか。 */
function hasJapanese(s: string): boolean {
  return /[ぁ-んァ-ヶー一-龠]/.test(s)
}

/**
 * サーバのエラー文字列を、利用者向けの日本語敬体メッセージに整える。
 * @param raw      サーバ応答の error（string 以外・空文字も許容）
 * @param fallback 既定の日本語敬体メッセージ（呼び出し文脈に合わせた「〜に失敗しました」等）
 */
export function localizeError(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const t = raw.trim()
  if (!t) return fallback
  const mapped = KNOWN[t.toLowerCase()]
  if (mapped) return mapped
  // サーバが日本語で返した利用者向け文言はそのまま尊重する。
  if (hasJapanese(t)) return t
  // 未知の英語/技術文字列は生のまま出さない（日本語UIに英語を漏らさない）。
  return fallback
}
