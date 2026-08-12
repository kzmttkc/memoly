import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { DigestPayload, DigestCard } from '@/lib/digest'
import { getSeasonalReminders, type SeasonalReminder } from '@/lib/email-seasonal'
import { sendSlackMessage } from '@/lib/slack'
import { buildUnsubscribeUrls, unsubscribeHeaders } from '@/app/api/unsubscribe/token'
import { verifyCronBearer } from '@/lib/cron-auth'

// ============================================================================
// /api/company/weekly-email — 番頭版 週次リテンションメール（Vercel Cron）
//   既存 cron 2本（/api/digest・/api/send-day2-reminder）は memoly_* 個人版のみ対象で
//   番頭（会社スコープ）ユーザーには1通も届いていなかった。本ルートが番頭版の起点。
//
//   フロー:
//     1. CRON_SECRET Bearer 認可（既存 /api/digest と同一の流儀）
//     2. 直近7日にアクティビティ（company_conversations 更新）があった会社を抽出
//     3. 会社ごとに既存ダイジェストキャッシュ（company_digests・getOrGenerateDigest が
//        アプリ内 lazy 生成で書いたもの）を再利用 → LLM は一切呼ばない（コストゼロ）
//     4. メンバー全員のメールへ番頭ブランドのダイジェストを Resend で送信
//
//   fail-safe（現行 /api/digest と同じ思想・env 未設定でも安全に何もしない）:
//     - CRON_SECRET / RESEND_API_KEY / DIGEST_FROM_EMAIL のどれかが未設定なら
//       送信せず { skipped: true, reason } を返す（サンドボックス送信元で本番に出さない）。
//     - ダイジェストキャッシュが無い会社はスキップ（cron から未認証文脈で生成しない。
//       生成はアプリ内 lazy 生成に一本化＝RLS 前提を崩さない・コストも増やさない）。
//     - 配信停止: signup の「お知らせを受け取る」チェック（user_metadata.digest_unsubscribed）
//       を尊重し、true のユーザーには送らない。/unsubscribe（既存ページ）でいつでも停止可。
//
//   Phase1コンプラ: 本文は company_digests のカード（生成時に免責・確定度ラベルを
//   コード強制済み）をそのまま描画する。件名・定型文も「社労士監修」等は使わない。
// ============================================================================

const BANTO_URL = 'https://banto-roumu.com'

// 送信元アドレス。未設定時はメール送信をスキップ（/api/digest と同一の安全動作）。
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL

// キャッシュの鮮度上限。cron は月曜 9時JST（=ISO週の切替直後）に走るため、
// 「当週」キャッシュはまだ無く、直前週に生成されたものを配信するのが通常系。
// 14日より古いキャッシュ（=先々週以前・活動が止まった会社）は配信しない。
const CACHE_MAX_AGE_DAYS = 14

// 1回の cron 実行で処理する会社数の上限（暴走・タイムアウト防止の安全弁）。
const MAX_COMPANIES_PER_RUN = 200

// 1通あたりに載せるカード数の上限（メールは要点だけ。全量はアプリで見る導線に倒す）。
const MAX_CARDS_PER_EMAIL = 5

// Resend への1リクエストの締切（2026-07-30 可用性監査#8）。
//   従来は締切なしで、Resend が応答を返さないと全社ぶんの送信ループがそこで止まり、
//   Vercel の関数タイムアウトまで何も進まなかった（残りの会社に1通も届かない）。
const RESEND_TIMEOUT_MS = 10_000

// 特定電子メール法が求める「送信者の住所」（2026-07-30 法務監査#4）。
//   従来は「所在地：日本」で、住所の表示になっていなかった。
//   ★実在の住所を勝手に書かない。env が未設定のあいだは捏造せず、特商法の開示請求
//     窓口を案内する（Takeshi 手番: SENDER_POSTAL_ADDRESS に実住所を設定すること）。
//   同じ定数が deadline-reminder / send-day2-reminder にもある（3経路で文言を揃える）。
const SENDER_ADDRESS =
  process.env.SENDER_POSTAL_ADDRESS?.trim() ||
  'ご請求により遅滞なく開示します（support@banto-roumu.com 宛に「運営者情報の開示請求」と明記のうえご連絡ください）'

/** LLM由来テキストをHTMLへ埋める前の必須エスケープ（メール内XSS/構造崩れ防止）。 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** カード1枚をメール用HTMLへ（番頭brand=濃紺/インディゴ #324a8a 系）。 */
function cardToHtml(card: DigestCard): string {
  const deadline = card.deadline
    ? `<p style="color:#b45309;font-size:12px;margin:6px 0 0">期日の目安: ${escapeHtml(card.deadline)}</p>`
    : ''
  return `<div style="border:1px solid #d9e0f4;border-radius:12px;padding:14px 16px;margin:0 0 12px">
    <p style="color:#21305a;font-weight:bold;font-size:14px;margin:0 0 6px">${escapeHtml(card.title)}</p>
    <p style="color:#374151;font-size:13px;line-height:1.8;margin:0">${escapeHtml(card.selfImpact)}</p>
    <p style="color:#4b5563;font-size:12px;line-height:1.7;margin:6px 0 0">次の一歩: ${escapeHtml(card.nextAction)}</p>
    ${deadline}
  </div>`
}

/** カード1枚をテキスト版へ（HTMLを読めない環境向けのマルチパート用）。 */
function cardToText(card: DigestCard): string {
  const lines = [`■ ${card.title}`, card.selfImpact, `次の一歩: ${card.nextAction}`]
  if (card.deadline) lines.push(`期日の目安: ${card.deadline}`)
  return lines.join('\n')
}

/** E05: 時期性リマインド1件をメール用HTMLへ（琥珀系で「今の時期の話」と分かる枠）。 */
function seasonalToHtml(r: SeasonalReminder, companyId: string): string {
  const cta = `${BANTO_URL}${r.ctaPath}?companyId=${encodeURIComponent(companyId)}`
  return `<div style="border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:14px 16px;margin:0 0 12px">
    <p style="color:#92400e;font-size:11px;font-weight:bold;margin:0 0 4px">いまの時期のリマインド</p>
    <p style="color:#21305a;font-weight:bold;font-size:14px;margin:0 0 6px">${escapeHtml(r.title)}</p>
    <p style="color:#374151;font-size:13px;line-height:1.8;margin:0 0 8px">${escapeHtml(r.body)}</p>
    <a href="${cta}" style="color:#324a8a;font-size:12px">${escapeHtml(r.ctaLabel)} →</a>
  </div>`
}

/** E05: 時期性リマインド1件をテキスト版へ。 */
function seasonalToText(r: SeasonalReminder, companyId: string): string {
  const cta = `${BANTO_URL}${r.ctaPath}?companyId=${encodeURIComponent(companyId)}`
  return [`■【いまの時期のリマインド】${r.title}`, r.body, `→ ${r.ctaLabel}: ${cta}`].join('\n')
}

// Vercel Cron から呼ばれる（vercel.json: 毎週月曜 0:00 UTC = 9:00 JST）。
export async function GET(req: Request) {
  // --- fail-safe: 必須 env が欠けていれば認可より先に「安全に何もしない」を返す ---
  //   （CRON_SECRET 未設定のまま `Bearer undefined` 比較で通す/弾く事故を構造的に防ぐ）
  // 2026-07-30 可用性監査#8: skipped も HTTP 500 で返す。
  //   従来は 200 だったため、env の設定漏れで1通も送られていなくても Vercel Cron の
  //   実行履歴は緑のままで、誰も気づけなかった。**設定漏れは正常ではない**ので赤くする。
  // 2026-08-13: 照合は lib/cron-auth.ts の定数時間比較に統一。
  const cronAuth = verifyCronBearer(req.headers.get('authorization'))
  if (cronAuth === 'not-configured') {
    console.error('[banto:weekly-email] CRON_SECRET 未設定のため配信をスキップしました。')
    return NextResponse.json({ sent: 0, skipped: true, reason: 'CRON_SECRET not set' }, { status: 500 })
  }
  if (cronAuth !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[banto:weekly-email] RESEND_API_KEY 未設定のため配信をスキップしました。')
    return NextResponse.json({ sent: 0, skipped: true, reason: 'RESEND_API_KEY not set' }, { status: 500 })
  }
  if (!DIGEST_FROM_EMAIL) {
    console.error(
      '[banto:weekly-email] DIGEST_FROM_EMAIL 未設定のため配信をスキップしました。' +
        '独自ドメイン認証後に環境変数 DIGEST_FROM_EMAIL を設定してください。'
    )
    return NextResponse.json({ sent: 0, skipped: true, reason: 'DIGEST_FROM_EMAIL not set' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // --- 対象会社の抽出（2026-07-30 継続利用監査 B-3 の是正）---
  //   従来は「直近7日に会話がある会社」だけを対象にしていた。だが会話が一度も無い会社は
  //   company_conversations に行そのものが存在しないため**永久に対象外**になり、
  //   「登録したが使わずに離れた人」＝最も戻ってきてほしい相手にだけ届かない、という
  //   ウィンバックとして向きが逆の設計だった。
  //   全社を対象にし、直近7日の活動有無で本文を出し分ける（休眠側は再開のきっかけを送る）。
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: allCompanies, error: compErr }, { data: activeConvs }] = await Promise.all([
    admin.from('companies').select('id').limit(MAX_COMPANIES_PER_RUN),
    admin.from('company_conversations').select('company_id').gte('updated_at', since),
  ])
  if (compErr) {
    console.error('[banto:weekly-email] company query failed', compErr)
    return NextResponse.json({ error: '対象会社の集計に失敗しました' }, { status: 500 })
  }
  // 送信失敗の件数（2026-07-30 可用性監査#8）。1件でもあれば最後に HTTP 500 で返す。
  let failed = 0

  const activeIds = new Set((activeConvs ?? []).map(r => r.company_id))
  const companyIds = (allCompanies ?? []).map(c => c.id)
  if (companyIds.length === 0) return NextResponse.json({ sent: 0, companies: 0 })

  const cacheCutoff = new Date(
    Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  let sent = 0
  let companiesSent = 0
  let slackSent = 0

  for (const companyId of companyIds) {
    try {
      // --- 会社名（宛名・件名まわりの文面用） ---
      const { data: company } = await admin
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .maybeSingle()
      const companyName = company?.name ?? '自社'

      // --- 既存ダイジェストキャッシュの再利用（LLM呼び出しゼロ） ---
      //   月曜朝はISO週が切り替わった直後＝「当週」行はまだ無いのが通常。
      //   直近生成分（先週アプリ内で lazy 生成されたもの）を新しい順に1件引く。
      const { data: digestRow } = await admin
        .from('company_digests')
        .select('payload, generated_at')
        .eq('company_id', companyId)
        .gte('generated_at', cacheCutoff)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const payload = digestRow?.payload as DigestPayload | undefined
      const cards = (payload?.cards ?? []).slice(0, MAX_CARDS_PER_EMAIL)

      // 2026-07-30 B-3 是正: 休眠会社（直近7日に会話なし）は、そもそもダイジェストの
      //   キャッシュが作られないため、ここで continue すると永久に何も届かなかった。
      //   アクティブ会社は従来どおり「カードが無ければ送らない」（ノイズ抑制）。
      //   休眠会社はカードが無くても、再開のきっかけを1通だけ送る。
      const isDormant = !activeIds.has(companyId)
      if (cards.length === 0 && !isDormant) continue

      // --- メンバー解決 ---
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId)
      if (!members?.length) continue

      const homeUrl = `${BANTO_URL}/company/home?companyId=${companyId}`
      // E05: 時期性リマインド（36協定更新・年5日有給・カスハラ義務化）。該当時期のみ0〜2件。
      //   ダイジェストカードの後ろに追記する（週次の主役はあくまで自社ダイジェスト）。
      const seasonal = getSeasonalReminders()
      const cardsHtml =
        cards.map(cardToHtml).join('') + seasonal.map(r => seasonalToHtml(r, companyId)).join('')
      const cardsText = [
        ...cards.map(cardToText),
        ...seasonal.map(r => seasonalToText(r, companyId)),
      ].join('\n\n')
      const disclaimer =
        payload?.disclaimer ??
        '対象になりうるものを自社プロファイルから自動で抽出した参考情報です。実際の適用可否・手続き・期日は一次情報と専門家でご確認ください。'

      let companyDelivered = false

      // --- Slack 連携（E08・2026-07-23）: Webhook 登録済みの会社にはメールと同時に届ける ---
      //   未設定/テーブル未適用なら従来どおりメールのみ。URL はログに出さない（lib/slack.ts）。
      const { data: integ } = await admin
        .from('company_integrations')
        .select('slack_webhook_url')
        .eq('company_id', companyId)
        .maybeSingle()
      if (integ?.slack_webhook_url) {
        const ok = await sendSlackMessage(
          integ.slack_webhook_url,
          `:newspaper: *今週の労務ダイジェスト*（${companyName}）\n\n${cardsText}\n\n※${disclaimer}\n<${homeUrl}|番頭で詳しく確認する>`,
          companyId,
        )
        if (ok) slackSent++
      }

      for (const member of members) {
        // ユーザーのメールと配信可否（signup「お知らせを受け取る」= user_metadata）を確認
        const { data: authUser } = await admin.auth.admin.getUserById(member.user_id)
        const email = authUser?.user?.email
        if (!email) continue
        if (authUser?.user?.user_metadata?.digest_unsubscribed) continue

        // 宛先ごとの配信停止URL（署名付き・ログイン不要で止まる）。
        const unsub = buildUnsubscribeUrls(BANTO_URL, member.user_id, 'digest')

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          // 締切なしだと Resend の無応答で全社ぶんの配信が止まる（可用性監査#8）。
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: DIGEST_FROM_EMAIL,
            to: email,
            // 休眠会社（直近7日に会話なし）には、ダイジェストではなく再開のきっかけとして届ける。
            // 中身が薄いのに「今週のダイジェスト」と名乗ると期待を裏切るため、件名で正直に分ける。
            subject: isDormant
              ? '就業規則を貼り付けると、自社の条文で答えます｜番頭'
              : '今週の労務ダイジェスト｜番頭',
            // ワンクリック配信停止（RFC 8058）。URL は署名付きで、POST だけで停止する。
            // 署名鍵が無い環境では unsubscribeHeaders が空を返す（動かない機能を宣言しない）。
            headers: unsubscribeHeaders(unsub.oneClick),
            text: `${companyName}に関係しうる労務の変更点をお届けします。\n\n${cardsText}\n\n※${disclaimer}\n\n→ 番頭で詳しく確認する: ${homeUrl}\n\n配信停止: ${unsub.page}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#324a8a;font-size:18px;margin:0 0 4px">今週の労務ダイジェスト</h2>
              <p style="color:#6b7280;font-size:12px;margin:0 0 16px">${escapeHtml(companyName)}に関係しうる変更点をお届けします。</p>
              ${cardsHtml}
              <p style="color:#9ca3af;font-size:11px;line-height:1.7;margin:12px 0 20px">※${escapeHtml(disclaimer)}</p>
              <a href="${homeUrl}" style="background:#324a8a;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block;font-size:14px">番頭で詳しく確認する</a>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:11px;line-height:1.8">
                【送信者情報】<br>
                サービス名：番頭（banto-roumu.com）<br>
                運営者：Kazumoto Takeshi<br>
                所在地：${escapeHtml(SENDER_ADDRESS)}<br>
                お問い合わせ：support@banto-roumu.com<br><br>
                このメールは番頭の週次ダイジェストとして送信されています。<br>
                <a href="${unsub.page}" style="color:#324a8a">配信停止はこちら</a>
              </p>
            </div>`,
          }),
        })

        if (resendRes.ok) {
          sent++
          companyDelivered = true
        } else {
          // 失敗を数える。以前はログに書くだけで、最後は常に 200 だった＝不達が
          // どこにも表面化しなかった（可用性監査#8）。
          failed++
          console.error(
            `[banto:weekly-email] send failed company=${companyId} status=${resendRes.status}`
          )
        }
      }
      if (companyDelivered) companiesSent++
    } catch (e) {
      // 1社の失敗で全体を止めない（ベストエフォート・既存 /api/digest と同じ）。
      // ただし件数には必ず数える（握り潰さない）。
      failed++
      console.error(`[banto:weekly-email] failed for company ${companyId}:`, e)
    }
  }

  // 失敗が1件でもあれば HTTP 500。Vercel Cron の実行履歴が赤くなり、不達に気づける。
  return NextResponse.json(
    { sent, failed, slackSent, companies: companiesSent, candidates: companyIds.length },
    { status: failed > 0 ? 500 : 200 },
  )
}
