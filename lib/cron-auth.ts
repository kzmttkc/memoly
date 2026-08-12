import { createHash, timingSafeEqual } from 'node:crypto'

// ============================================================================
// lib/cron-auth.ts — cron エンドポイントの Bearer 照合（定数時間）
// ----------------------------------------------------------------------------
// なぜ要るか（2026-08-13 セキュリティ採点 -1 の是正）:
//   4本の cron ルートが `auth !== \`Bearer ${process.env.CRON_SECRET}\`` という
//   **短絡評価つきの文字列比較**で認可していた。JS の === は最初に食い違った
//   バイトで打ち切るため、応答時間に「何文字目まで合っていたか」が乗る。
//   ネットワーク越しの実用的な攻撃は難しいが、正しい書き方が同じリポの
//   lib/api-keys.ts:49-54 と app/api/unsubscribe/token.ts:88 に既にあるのに
//   cron だけ非対称なのが問題だった（横に手本があるのに揃っていない）。
//
// 設計:
//   - 長さで早期 return しない。長さの違いそのものが情報なので、両方を
//     SHA-256 で 32 バイト固定長へ潰してから timingSafeEqual にかける
//     （api-keys.ts は hex 固定長が前提なので長さ分岐でよいが、ここは
//       任意長のヘッダを受けるためこの形にする）。
//   - 「未設定」と「不一致」を呼び出し側が区別できるように結果を3値で返す。
//     未設定のまま `Bearer undefined` 一致で通す事故を構造的に防ぐ既存の
//     fail-safe（各ルートの冒頭）を、この関数の中へ寄せた。
// ============================================================================

export type CronAuthResult = 'ok' | 'not-configured' | 'unauthorized'

/** 任意長の文字列同士の定数時間比較（長さの違いも時間に出さない）。 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Authorization ヘッダを CRON_SECRET と定数時間で照合する。
 *   'not-configured' … 秘密が未設定（呼び出し側は認可より先に安全停止する）
 *   'unauthorized'   … ヘッダ無し or 不一致
 *   'ok'             … 一致
 */
export function verifyCronBearer(
  authorizationHeader: string | null | undefined,
  secret: string | undefined = process.env.CRON_SECRET,
): CronAuthResult {
  if (!secret) return 'not-configured'
  if (!authorizationHeader) return 'unauthorized'
  return timingSafeEqualString(authorizationHeader, `Bearer ${secret}`) ? 'ok' : 'unauthorized'
}
