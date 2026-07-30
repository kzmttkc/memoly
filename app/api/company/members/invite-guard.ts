// ============================================================================
// invite-guard.ts — 席招待で「そのアカウントへ席を入れてよいか」を決める純関数
// ----------------------------------------------------------------------------
// 【なぜ要るか（2026-07-30 監査・重大）】
//   番頭の Supabase Auth は mailer_autoconfirm=True で運用しており
//   （app/api/auth/confirm-signup/route.ts のコメント参照）、POST /auth/v1/signup は
//   メール確認なしで即 access_token を返す。つまり **メールアドレスの所有を証明せずに
//   任意のアドレスでアカウントを作れる**。
//
//   一方、席招待（POST /api/company/members）は「既存 auth.users をメールで解決して
//   即座に company_members へ入れる」方式。この2つが噛み合うと:
//     1. 攻撃者が keiri@ターゲット社.co.jp で先にアカウントを作る（所有していなくてよい）
//     2. 後日ターゲット社の admin が同じアドレスを招待する
//     3. 席が **攻撃者のアカウント** に入り、就業規則の原文と労務相談履歴を全部読める
//   ＝メール先取りによる席乗っ取り。
//
// 【暫定対処】
//   email_confirmed_at が入っていないアカウントには席を入れない。
//   autoconfirm=True の現状では「正規に signup したユーザー」も confirmed になるため
//   正規フローは無退行。将来 autoconfirm=False に戻したときも、確認済みだけが招待対象
//   という不変条件はそのまま正しい。
//
// 【これは暫定である／恒久解は招待トークン方式】
//   本来は「admin が招待を発行 → 招待トークン付きURLを本人のメールに送る →
//   受信できた本人がクリックして席が入る」という invitation テーブル方式にすべき。
//   そうすればアカウントの先取り有無に関係なく、メールを受信できた者だけが席を得る。
//   本ファイルの判定は、その恒久解が入るまでの穴埋め（DB migration 不要な最小修正）。
// ============================================================================

/** Supabase Admin API の User から、招待判定に必要な最小の形だけを取る。 */
export interface InviteTargetUser {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

/**
 * このユーザーへ席を入れてよいか。
 *   true  = メール所有が確認済み（席を入れてよい）
 *   false = 未確認（先取り登録の可能性がある。席を入れてはいけない）
 *
 * 呼び出し側は false でもエラーを返さず、未登録・既メンバーと**同一文言の 200**を返すこと
 * （応答差からメールの登録有無・確認有無が推測できる存在オラクルを作らないため）。
 */
export function isInvitableUser(user: InviteTargetUser | null | undefined): boolean {
  if (!user) return false
  return typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0
}
