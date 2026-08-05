import { createHmac, timingSafeEqual } from 'node:crypto'

// ============================================================================
// 配信停止トークン（2026-07-30 法務監査#4 の是正・特定電子メール法／RFC 8058）
// ----------------------------------------------------------------------------
//   実測された欠陥:
//     送信メールは 'List-Unsubscribe-Post: List-Unsubscribe=One-Click' を宣言して
//     いたのに、List-Unsubscribe の URL は画面（/unsubscribe）で、しかも未ログインだと
//     「ログインが必要です」で終わり、/api/unsubscribe の POST は未ログインで 401 を
//     返していた。つまり **宣言だけして実際には1件も停止できない** 状態で、
//     Gmail/Yahoo の一括送信者要件（ワンクリック配信停止の動作）も満たしていない。
//     メールの受信者は多くの場合ブラウザにログインセッションを持たない（別端末・
//     メールクライアント内蔵ブラウザ）ため、ログイン必須の停止導線は構造的に機能しない。
//
//   直し方: 宛先ユーザーIDに HMAC 署名を付けたトークンをメールのURLへ載せ、
//     受け取り側は署名を検証するだけで（ログインなしに）停止できるようにする。
//     ・有効期限は付けない。配信停止リンクは何か月後に押されても効くべきもので、
//       期限切れは「停止できない」という同じ欠陥に戻るため。
//     ・トークンで出来ることは「自分宛の配信を止める」だけ。読み出しも変更も他には無い。
//
//   鍵: UNSUBSCRIBE_SECRET（推奨・任意の長いランダム文字列）。
//     未設定のときは SUPABASE_SERVICE_ROLE_KEY を鍵として流用する（cron 送信経路では
//     必ず設定済みの秘密で、サーバ側にしか存在しない。HMAC は鍵を復元されないため
//     流用しても鍵自体は漏れない）。どちらも無い環境では署名できないので null を返し、
//     呼び出し側はワンクリック用ヘッダを付けない（動かない機能を宣言しないため）。
// ============================================================================

/** 停止できる配信の種類。メールの種類ごとに、止める対象を取り違えないため分ける。 */
export type UnsubscribeScope = 'digest' | 'deadline'

/** scope → auth.users.user_metadata に立てるフラグ（複数可）。 */
export const SCOPE_FLAGS: Record<UnsubscribeScope, string[]> = {
  // 週次ダイジェストと Day2 初回フォローは、どちらも任意購読のお知らせ系。
  // 片方だけ止まると「停止したのにまだ来る」になるので同時に止める。
  digest: ['digest_unsubscribed', 'day2_unsubscribed'],
  // 期限リマインドは利用者が自分で登録した期限のトランザクショナル通知。
  // お知らせ系とは別フラグで管理する（deadline-reminder 側が参照する）。
  deadline: ['deadline_unsubscribed'],
}

const SIG_LENGTH = 32 // hex 32文字 = 128bit。総当たりに対して十分。

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex').slice(0, SIG_LENGTH)
}

/** scope 文字列が有効な UnsubscribeScope か（route.ts の scope クエリ検証でも使う）。 */
export function isValidScope(s: string): s is UnsubscribeScope {
  return s === 'digest' || s === 'deadline'
}

/**
 * 配信停止トークンを作る。鍵が無い環境では null（＝ワンクリックを名乗らない）。
 * 形式: base64url("<scope>:<userId>") + "." + hmac先頭32hex
 */
export function signUnsubscribeToken(userId: string, scope: UnsubscribeScope): string | null {
  const key = secret()
  if (!key) return null
  // 停止の実行そのものが admin クライアント（service_role）を要る。UNSUBSCRIBE_SECRET
  // だけあって service_role が無い環境では、署名は通るのに停止処理が例外で落ちる＝
  // 「押しても止まらない停止リンク」になる。署名できる＝止められる、を崩さない。
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const payload = Buffer.from(`${scope}:${userId}`, 'utf8').toString('base64url')
  return `${payload}.${sign(payload, key)}`
}

/** トークンを検証する。改ざん・鍵不一致・形式不正はすべて null。 */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
): { userId: string; scope: UnsubscribeScope } | null {
  const key = secret()
  if (!key || !token) return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const given = token.slice(dot + 1)
  if (given.length !== SIG_LENGTH) return null

  // 署名比較は定数時間で（先頭一致から総当たりできないようにする）。
  const expected = sign(payload, key)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(given, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let decoded: string
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const sep = decoded.indexOf(':')
  if (sep <= 0) return null
  const scope = decoded.slice(0, sep)
  const userId = decoded.slice(sep + 1)
  if (!isValidScope(scope) || !userId) return null

  return { userId, scope }
}

/**
 * メールに載せる2種類のURLを作る。
 *   oneClick … List-Unsubscribe ヘッダ用（POSTで即停止するAPI）。鍵が無ければ null。
 *   page     … 本文フッタの「配信停止はこちら」用（人が踏む画面）。
 */
export function buildUnsubscribeUrls(
  baseUrl: string,
  userId: string,
  scope: UnsubscribeScope,
): { oneClick: string | null; page: string } {
  const token = signUnsubscribeToken(userId, scope)
  if (!token) {
    // 2026-08-05 敵対的再監査で発見: 鍵未設定でトークンが作れない環境では、従来
    // `${baseUrl}/unsubscribe`（scope情報なし）にフォールバックしていた。/unsubscribe の
    // token無し経路（画面から自分でログインして止める場合）は POST /api/unsubscribe に
    // scope を渡す手段がなく、常に 'digest' 固定で停止していた（route.ts参照）。
    // つまり deadline 通知の配信停止リンクがこの経路に落ちると、ユーザーには
    // 「配信停止しました」と表示されるのに deadline は実際には止まっていない
    // ＝サイレントに失敗して停止できたと誤認させるルートになっていた。
    // scope をクエリへ載せて、フォールバック時も正しいスコープを止められるようにする。
    return { oneClick: null, page: `${baseUrl}/unsubscribe?scope=${scope}` }
  }
  const q = encodeURIComponent(token)
  return {
    oneClick: `${baseUrl}/api/unsubscribe?token=${q}`,
    page: `${baseUrl}/unsubscribe?token=${q}`,
  }
}

/**
 * Resend に渡す List-Unsubscribe 系ヘッダ。
 * ワンクリックURLを作れないときは **ヘッダごと付けない**（RFC 8058 は
 * List-Unsubscribe-Post を宣言した以上その URL が POST で動くことを要求するため、
 * 動かないまま宣言するのは受信側の信頼を損なうだけになる）。
 */
export function unsubscribeHeaders(oneClickUrl: string | null): Record<string, string> {
  if (!oneClickUrl) return {}
  return {
    'List-Unsubscribe': `<${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
