// ============================================================================
// invite-guard.ts — 席招待で「そのアカウントへ席を入れてよいか」を決める純関数
// ----------------------------------------------------------------------------
// 【攻撃（2026-07-30 監査・重大）】
//   番頭の Supabase Auth は mailer_autoconfirm=true で運用しており、
//   POST /auth/v1/signup はメール確認なしで即 access_token を返す。つまり
//   **メールアドレスの所有を証明せずに任意のアドレスでアカウントを作れる**。
//
//   一方、席招待（POST /api/company/members）は「既存 auth.users をメールで解決して
//   即座に company_members へ入れる」方式。この2つが噛み合うと:
//     1. 攻撃者が keiri@ターゲット社.co.jp で先にアカウントを作る（所有していなくてよい）
//     2. 後日ターゲット社の admin が同じアドレスを招待する
//     3. 席が **攻撃者のアカウント** に入り、就業規則の原文と労務相談履歴を全部読める
//   ＝メール先取りによる席乗っ取り。
//
// 【2026-08-12 訂正 — 旧「暫定対処」は本番では何も防いでいなかった】
//   旧実装は「email_confirmed_at が入っていないアカウントには席を入れない」だった。
//   本番設定 mailer_autoconfirm=true の下では **登録した瞬間に全アカウントへ
//   email_confirmed_at が入る**。攻撃者が先取り登録したアカウントも当然 confirmed に
//   なるので、この判定は攻撃者を1人も落とさない＝防御は丸ごと無効化されていた。
//   旧コメントの「正規フローは無退行」は正しかったが、「席乗っ取りを防ぐ」は誤り。
//
//   実測（2026-08-12・GET https://<project>.supabase.co/auth/v1/settings）:
//     {"disable_signup":false,"mailer_autoconfirm":true,"phone_autoconfirm":false,...}
//   再測定は `node scripts/verify_production_state.mjs` が自動で行い、
//   下の MAILER_AUTOCONFIRM_IN_PRODUCTION と食い違えば落ちる。
//
// 【本番 Auth 設定を false に倒すだけでは直らない（重要）】
//   仮に mailer_autoconfirm=false へ戻しても、無認証の公開エンドポイント
//   POST /api/auth/confirm-signup が service_role で任意メールを
//   `email_confirm: true` に更新できる。攻撃者は先取り登録したアドレスへ自分で
//   1回叩けば confirmed を得られるため、email_confirmed_at 判定は再び無効化される。
//   ＝設定変更は必要条件ですらなく、単独では解にならない。
//
// 【したがって現在の判定は fail-closed】
//   email_confirmed_at が「メール所有の証明」として機能しない環境では、
//   この関数は所有を判定する材料を持たない。持っていない材料で true を返すのが
//   一番危険なので、autoconfirm が有効な間は常に false を返す。
//   呼び出し側（route.ts）は、メール解決より **前** に同じ条件で明示的に断る
//   （メールに依存しない分岐なので存在オラクルにはならない）。
//
//   実害の見積り（2026-08-12 本番実測）: companies=2 / company_members=2 ＝
//   1社1席で、招待による席付与は **これまで一度も成立していない**。よって
//   fail-closed で止まる正規フローは現時点で存在しない。
//
// 【恒久解は招待トークン方式（未実装・オーナー判断待ち）】
//   「admin が招待を発行 → 招待トークン付きURLを本人のメールに送る →
//   受信できた本人がクリックして席が入る」という invitation テーブル方式にすれば、
//   アカウントの先取り有無に関係なく、メールを受信できた者だけが席を得る。
//   これは DB migration + 送信メールテンプレートを伴うため別タスク。
// ============================================================================

/**
 * 本番 Supabase Auth の mailer_autoconfirm の実測値（2026-08-12 計測）。
 *
 * true である限り email_confirmed_at はメール所有の証拠にならない。
 * 値がズレたら scripts/verify_production_state.mjs が落ちるので、
 * 「コードは正しいが本番設定で無効」の再発をコード側で検出できる。
 */
export const MAILER_AUTOCONFIRM_IN_PRODUCTION = true

/** Supabase Admin API の User から、招待判定に必要な最小の形だけを取る。 */
export interface InviteTargetUser {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

/**
 * email_confirmed_at を「メール所有の証明」として信用してよいか。
 *   autoconfirm が有効なら、確認済みフラグは登録の副産物でしかなく所有を意味しない。
 */
export function emailConfirmationProvesOwnership(
  mailerAutoconfirm: boolean = MAILER_AUTOCONFIRM_IN_PRODUCTION
): boolean {
  return mailerAutoconfirm === false
}

/**
 * このユーザーへ席を入れてよいか。
 *   true  = メール所有が確認済み（席を入れてよい）
 *   false = 所有を確認できない（先取り登録の可能性がある。席を入れてはいけない）
 *
 * autoconfirm が有効な間は、どんなユーザーに対しても false を返す（fail-closed）。
 *
 * 呼び出し側は false でもエラーを返さず、未登録・既メンバーと**同一文言の 200**を返すこと
 * （応答差からメールの登録有無・確認有無が推測できる存在オラクルを作らないため）。
 */
export function isInvitableUser(
  user: InviteTargetUser | null | undefined,
  mailerAutoconfirm: boolean = MAILER_AUTOCONFIRM_IN_PRODUCTION
): boolean {
  if (!user) return false
  // 材料が信用できない環境では所有を判定しない。
  if (!emailConfirmationProvesOwnership(mailerAutoconfirm)) return false
  return typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0
}
