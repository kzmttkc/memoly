// ============================================================================
// slack.ts — Slack Incoming Webhook 送信ヘルパ（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   会社が自社Slackで発行した Incoming Webhook URL へ通知テキストを送る。
//   新規契約・アプリ審査は不要（Webhook はユーザー側 Slack ワークスペースの機能）。
//
//   秘匿の原則:
//     - Webhook URL は秘密情報として扱い、**絶対にログへ出さない**
//       （console.* に URL を含めない。失敗時も companyId とステータスのみ記録）。
//     - /api/company/export のエクスポート対象にも含めない（export 側は列挙制）。
//
//   fail-safe: 送信失敗・タイムアウトでも例外を投げない（メール配信を巻き添えにしない）。
// ============================================================================

// Slack Incoming Webhook の正規URL形式。services/ 以下はワークスペース/チャネル/トークン。
const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/

const SEND_TIMEOUT_MS = 5000

/** Incoming Webhook URL として妥当か（形式検証・保存前に必ず通す）。 */
export function isValidSlackWebhookUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length <= 300 && SLACK_WEBHOOK_RE.test(url)
}

/** 表示用マスク（末尾4文字のみ見せる）。生URLをUIへ返さないための整形。 */
export function maskSlackWebhookUrl(url: string): string {
  return `https://hooks.slack.com/services/…${url.slice(-4)}`
}

/**
 * Slack へテキストを1通送る。成功=true / 失敗=false（例外は投げない）。
 * URL はログに出さない。text は mrkdwn として解釈される。
 */
export async function sendSlackMessage(
  webhookUrl: string,
  text: string,
  companyId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (!res.ok) {
      // URL は絶対に出さない（company と HTTP ステータスのみ）。
      console.error(
        `[slack] send failed company=${companyId ?? 'unknown'} status=${res.status}`,
      )
      return false
    }
    return true
  } catch (e) {
    console.error(
      `[slack] send threw company=${companyId ?? 'unknown'}: ${(e as Error).name}`,
    )
    return false
  }
}
