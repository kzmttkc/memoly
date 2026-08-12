// ============================================================================
// lib/health-detail.ts — /api/health が外へ出す DB 障害の説明文
// ----------------------------------------------------------------------------
// なぜ要るか（2026-08-13 セキュリティ採点 -2 の是正）:
//   /api/health は**無認証**で叩ける外形監視用エンドポイントである。
//   旧実装は DB エラー時に `detail: error.message` をそのまま返していた。
//   PostgREST / Postgres のエラー本文にはテーブル名・列名・制約名・関数名が
//   そのまま入る（例: `relation "company_members" does not exist`,
//   `new row violates row-level security policy for table "companies"`）。
//   正常時は漏れないので普段は見えないが、**DB障害中という一番騒がしい瞬間に、
//   誰にでもスキーマが読める**という設計だった。
//
//   一方で監視としての用は「落ちている/落ちていない」が分かれば足りる。
//   よって外へは固定文字列だけを返し、実際の原因は console 経由でサーバー側
//   （Vercel のログ）にだけ残す。
// ============================================================================

/** 無認証の応答に載せてよい、DB 不通時の固定説明。原因は含めない。 */
export const DB_FAILURE_DETAIL = 'database check failed'

/**
 * DB エラーの生メッセージを、外に出せる固定文字列へ落とす。
 * 生メッセージはサーバー側ログにだけ残す（引数が undefined でも落ちない）。
 */
export function dbFailureDetail(rawMessage?: string | null): string {
  if (rawMessage) {
    // ログはサーバー側にしか出ない。ここで初めて生の内容を扱う。
    console.error('[health] db check failed:', rawMessage)
  }
  return DB_FAILURE_DETAIL
}
