import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSlackMessage } from '@/lib/slack'
import { buildUnsubscribeUrls, unsubscribeHeaders } from '@/app/api/unsubscribe/token'

// ============================================================================
// /api/company/deadline-reminder — F4 期限リマインド（Vercel Cron）
//   登録済みの期限（company_deadlines）のうち、期日が近づいたものについて
//   会社メンバーへ「備忘メール」を届ける。weekly-email/route.ts を丸ごと土台にする。
//
//   フロー（weekly-email と同一の骨格）:
//     1. CRON_SECRET 未設定 → 認可より先に skipped（`Bearer undefined` 事故を構造的に防ぐ）
//     2. CRON_SECRET Bearer 照合 → 不一致は 401
//     3. RESEND_API_KEY / DIGEST_FROM_EMAIL 未設定 → skipped（同じ差出人env を再利用）
//     4. service role で due_on が今日〜今日+30日の active 行を全社横断（上限200社ぶん）
//     5. 行ごとに daysUntil を出し、NOTIFY_OFFSETS のうち「daysUntil 以上で最小」の閾値を
//        matchedOffset とする。last_notified_offset が未通知 or それより大きい閾値なら送信対象
//        （＝より近いリードでまだ送っていない）。同一 due_on への同閾値の二重送信を防ぐ。
//     6. 会社メンバーのメールを解決（company_members→auth.admin.getUserById・配信停止尊重）
//     7. 送信「成功後」に last_notified_offset=matchedOffset, last_notified_due_on=due_on を
//        当該行だけ更新（.eq('id',row.id)）。送信失敗時は更新しない（次回再試行）。
//     8. yearly の期日繰り上げは cron ではやらない（UI の「済みにする」PATCH のみ）。
//
//   Phase1コンプラ: 断定/命令しない・社労士監修/AI社労士/法的精度は書かない・禁止語0・
//     「あなた」を多用しない・免責文はコード固定（LLM生成しない）・敬体で統一。
// ============================================================================

const BANTO_URL = 'https://banto-roumu.com'

// 送信元アドレス。未設定時はメール送信をスキップ（weekly-email と同一の安全動作・同env再利用）。
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL

// 通知するリード日数（残り日数の閾値）。大きい順に定義し、近づくたびに1回ずつ通知する。
//   0 = 当日通知（W3.5b 2026-07-23 追加・第2表#6）。前日(1)通知済みでも last_notified_offset=1 > 0
//   のため当日にもう1回届く（matchOffset と二重送信ガードの単調減少ロジックはそのまま成立）。
const NOTIFY_OFFSETS = [30, 14, 7, 1, 0]

// 走査対象の窓（最大リード＝先頭の閾値）。BETWEEN today AND today+MAX_LEAD の行だけ引く。
const MAX_LEAD_DAYS = NOTIFY_OFFSETS[0]

// 1回の cron 実行で処理する会社数の上限（暴走・タイムアウト防止の安全弁）。
const MAX_COMPANIES_PER_RUN = 200

// 1通あたりに載せる期限件数の上限（メールは要点だけ）。
const MAX_ITEMS_PER_EMAIL = 8

// Resend への1リクエストの締切（2026-07-30 可用性監査#8・weekly-email と同値）。
const RESEND_TIMEOUT_MS = 10_000

// 特定電子メール法が求める「送信者の住所」（2026-07-30 法務監査#4）。
//   実住所を捏造しない。env 未設定のあいだは特商法の開示請求窓口を案内する。
//   ★Takeshi 手番: SENDER_POSTAL_ADDRESS に実住所を設定すること。
const SENDER_ADDRESS =
  process.env.SENDER_POSTAL_ADDRESS?.trim() ||
  'ご請求により遅滞なく開示します（support@banto-roumu.com 宛に「運営者情報の開示請求」と明記のうえご連絡ください）'

// 固定の免責文（★LLM生成しない・全経路でこの文字列を使う）。断定/命令をしない中立文。
const DISCLAIMER =
  '登録済みの予定を早めにお伝えする備忘です。実際の要否・手続き・提出先は所轄の窓口や専門家でご確認ください。'

/** LLM由来でないユーザー入力(title/note)もHTMLへ埋める前に必ずエスケープする。 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** company_deadlines の1行（cron が service role で読む列）。 */
interface DeadlineRow {
  id: string
  company_id: string
  title: string
  note: string | null
  due_on: string
  last_notified_offset: number | null
  last_notified_due_on: string | null
}

/** 日付文字列(YYYY-MM-DD)の残り日数（UTC基準・当日=0）。 */
function daysUntil(dueOn: string, todayStr: string): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`)
  const today = Date.parse(`${todayStr}T00:00:00Z`)
  return Math.round((due - today) / (24 * 60 * 60 * 1000))
}

/**
 * 「daysUntil 以上で最小」の閾値を返す（例: NOTIFY_OFFSETS=[30,14,7,1,0]）。
 *   daysUntil=20 → 30（20以上で最小の閾値＝30） / 6 → 7 / 1 → 1 / 0 → 0（当日通知）。
 *   窓（0..30日）で引いているので必ず1つは該当する。該当なしは null。
 */
function matchOffset(du: number): number | null {
  const eligible = NOTIFY_OFFSETS.filter(o => o >= du)
  if (eligible.length === 0) return null
  return Math.min(...eligible)
}

/** 残り日数の表示（当日は「残り0日」でなく「本日」と書く・敬体の自然な文言）。 */
function remainingLabel(du: number): string {
  return du === 0 ? '本日' : `残り${du}日`
}

/** 1件をテキスト版へ（HTMLを読めない環境向け）。 */
function itemToText(row: DeadlineRow, du: number): string {
  const lines = [`■ ${row.title}`, `期日の目安: ${row.due_on}（${remainingLabel(du)}）`]
  if (row.note) lines.push(row.note)
  return lines.join('\n')
}

/** 1件をメール用HTMLへ（weekly-email の brand=濃紺/インディゴ系に合わせる）。 */
function itemToHtml(row: DeadlineRow, du: number): string {
  const note = row.note
    ? `<p style="color:#4b5563;font-size:12px;line-height:1.7;margin:6px 0 0">${escapeHtml(row.note)}</p>`
    : ''
  return `<div style="border:1px solid #d9e0f4;border-radius:12px;padding:14px 16px;margin:0 0 12px">
    <p style="color:#21305a;font-weight:bold;font-size:14px;margin:0 0 6px">${escapeHtml(row.title)}</p>
    <p style="color:#b45309;font-size:12px;margin:0">期日の目安: ${escapeHtml(row.due_on)}（${remainingLabel(du)}）</p>
    ${note}
  </div>`
}

// Vercel Cron から呼ばれる（vercel.json: 毎日 23:00 UTC = 8:00 JST）。
export async function GET(req: Request) {
  // --- fail-safe: 必須 env が欠けていれば認可より先に「安全に何もしない」を返す ---
  // 2026-07-30 可用性監査#8: 設定漏れは正常ではないので HTTP 500 にする
  //   （200 のままだと Vercel Cron の履歴が緑で、1通も送っていないことに気づけない）。
  if (!process.env.CRON_SECRET) {
    console.error('[banto:deadline-reminder] CRON_SECRET 未設定のため配信をスキップしました。')
    return NextResponse.json({ sent: 0, skipped: true, reason: 'CRON_SECRET not set' }, { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[banto:deadline-reminder] RESEND_API_KEY 未設定のため配信をスキップしました。')
    return NextResponse.json({ sent: 0, skipped: true, reason: 'RESEND_API_KEY not set' }, { status: 500 })
  }
  if (!DIGEST_FROM_EMAIL) {
    console.error(
      '[banto:deadline-reminder] DIGEST_FROM_EMAIL 未設定のため配信をスキップしました。' +
        '独自ドメイン認証後に環境変数 DIGEST_FROM_EMAIL を設定してください。'
    )
    return NextResponse.json({ sent: 0, skipped: true, reason: 'DIGEST_FROM_EMAIL not set' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 今日（UTC・YYYY-MM-DD）。due_on は date 型なので UTC 日付でそろえる。
  const todayStr = new Date().toISOString().slice(0, 10)
  const maxStr = new Date(Date.now() + MAX_LEAD_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // --- 期日が今日〜今日+30日の active 行を全社横断で引く ---
  const { data: rows, error: rowErr } = await admin
    .from('company_deadlines')
    .select('id, company_id, title, note, due_on, last_notified_offset, last_notified_due_on')
    .eq('active', true)
    .gte('due_on', todayStr)
    .lte('due_on', maxStr)
    .order('due_on', { ascending: true })
  if (rowErr) {
    // 2026-07-30 可用性監査#8: ここも 200 ではなく 500。テーブルが引けない＝期限通知が
    //   1件も出せない状態であり、「正常終了」ではない。緑のままだと恒久的に無音になる。
    console.error('[banto:deadline-reminder] deadline query failed', rowErr.message)
    return NextResponse.json(
      { sent: 0, skipped: true, reason: 'deadlines table not ready' },
      { status: 500 },
    )
  }

  // 送信失敗の件数（可用性監査#8）。1件でもあれば最後に HTTP 500 で返す。
  let failed = 0

  // --- 送信対象の絞り込み: 二重送信防止（matchedOffset と last_notified の突き合わせ） ---
  const due: { row: DeadlineRow; du: number; offset: number }[] = []
  for (const raw of (rows ?? []) as DeadlineRow[]) {
    const du = daysUntil(raw.due_on, todayStr)
    const offset = matchOffset(du)
    if (offset === null) continue
    // 同一 due_on に対して同じ（以下の＝より近い）閾値を既に送っていれば送らない。
    //   last_notified_due_on が今の due_on と一致し、かつ last_notified_offset<=offset の
    //   ときは「この閾値以下でもう通知済み」＝スキップ（単調減少方向にのみ発火）。
    if (
      raw.last_notified_due_on === raw.due_on &&
      raw.last_notified_offset !== null &&
      raw.last_notified_offset <= offset
    ) {
      continue
    }
    due.push({ row: raw, du, offset })
  }

  if (due.length === 0) return NextResponse.json({ sent: 0, companies: 0 })

  // --- 会社ごとにまとめる（1社1通に近い集約・上限200社） ---
  const byCompany = new Map<string, typeof due>()
  for (const d of due) {
    const arr = byCompany.get(d.row.company_id) ?? []
    arr.push(d)
    byCompany.set(d.row.company_id, arr)
  }
  const companyIds = [...byCompany.keys()].slice(0, MAX_COMPANIES_PER_RUN)

  let sent = 0
  let companiesSent = 0
  let slackSent = 0

  for (const companyId of companyIds) {
    try {
      const items = (byCompany.get(companyId) ?? []).slice(0, MAX_ITEMS_PER_EMAIL)
      if (items.length === 0) continue

      // --- 会社名（宛名・文面用） ---
      const { data: company } = await admin
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .maybeSingle()
      const companyName = company?.name ?? '自社'

      // --- メンバー解決 ---
      const { data: members } = await admin
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId)
      if (!members?.length) continue

      const homeUrl = `${BANTO_URL}/company/deadlines?companyId=${companyId}`
      const itemsHtml = items.map(({ row, du }) => itemToHtml(row, du)).join('')
      const itemsText = items.map(({ row, du }) => itemToText(row, du)).join('\n\n')

      let companyDelivered = false

      // --- Slack 連携（E08・2026-07-23）: Webhook 登録済みの会社にはメールと同時に届ける ---
      //   未設定/テーブル未適用なら従来どおりメールのみ（変数は null のまま＝完全に無風）。
      //   URL はログに出さない（lib/slack.ts が担保）。Slack 到達も「通知済み」に数え、
      //   下の last_notified_offset 更新で同一閾値の二重送信を防ぐ。
      const { data: integ } = await admin
        .from('company_integrations')
        .select('slack_webhook_url')
        .eq('company_id', companyId)
        .maybeSingle()
      if (integ?.slack_webhook_url) {
        const ok = await sendSlackMessage(
          integ.slack_webhook_url,
          `:alarm_clock: *労務の期限が近づいています*（${companyName}）\n\n${itemsText}\n\n※${DISCLAIMER}\n<${homeUrl}|番頭で確認する>`,
          companyId,
        )
        if (ok) {
          slackSent++
          companyDelivered = true
        }
      }
      for (const member of members) {
        const { data: authUser } = await admin.auth.admin.getUserById(member.user_id)
        const email = authUser?.user?.email
        if (!email) continue
        // digest_unsubscribed ではガードしない（2026-07-30 UX監査 B-2）。
        //   このフラグは登録時の「番頭の新機能・労務の最新情報をメールで受け取る（任意）」
        //   ＝プロダクトニュースの任意購読に対応するもので、既定は配信停止（true）になる。
        //   一方この通知は「利用者が自分で登録した自社の期限」が近づいたことを知らせる
        //   トランザクショナル通知であり、サービス提供に必要な連絡にあたる。マーケ通知の
        //   opt-in と同一フラグで殺すと、メール登録ユーザーには期限通知が1通も届かない
        //   （再訪の最強トリガーを既定で失っていた）。
        //   なお解除手段はメール内の配信停止リンクで別途提供する（下の unsubscribe 導線）。
        //   2026-07-30 法務監査#4: その「別途の解除手段」が実際には機能していなかった
        //   （URL が要ログインの画面で、ワンクリックのAPIは401）。scope='deadline' の
        //   署名付きトークンで、この通知だけを認証なしで止められるようにする。
        //   止めた人には deadline_unsubscribed が立つので、次回以降ここで除外される。
        if (authUser?.user?.user_metadata?.deadline_unsubscribed) continue

        const unsub = buildUnsubscribeUrls(BANTO_URL, member.user_id, 'deadline')

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
            subject: '労務の期限が近づいています｜番頭',
            // ワンクリック配信停止（RFC 8058）。署名付きURLへ POST するだけで止まる。
            headers: unsubscribeHeaders(unsub.oneClick),
            text: `${companyName}で登録済みの期限が近づいています。\n\n${itemsText}\n\n※${DISCLAIMER}\n\n→ 番頭で確認する: ${homeUrl}\n\n配信停止: ${unsub.page}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#324a8a;font-size:18px;margin:0 0 4px">労務の期限が近づいています</h2>
              <p style="color:#6b7280;font-size:12px;margin:0 0 16px">${escapeHtml(companyName)}で登録済みの期限をお知らせします。</p>
              ${itemsHtml}
              <p style="color:#9ca3af;font-size:11px;line-height:1.7;margin:12px 0 20px">※${escapeHtml(DISCLAIMER)}</p>
              <a href="${homeUrl}" style="background:#324a8a;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block;font-size:14px">番頭で確認する</a>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
              <p style="color:#9ca3af;font-size:11px;line-height:1.8">
                【送信者情報】<br>
                サービス名：番頭（banto-roumu.com）<br>
                運営者：Kazumoto Takeshi<br>
                所在地：${escapeHtml(SENDER_ADDRESS)}<br>
                お問い合わせ：support@banto-roumu.com<br><br>
                このメールは番頭に登録された期限の備忘として送信されています。<br>
                <a href="${unsub.page}" style="color:#324a8a">配信停止はこちら</a>
              </p>
            </div>`,
          }),
        })

        if (resendRes.ok) {
          sent++
          companyDelivered = true
        } else {
          // 失敗を数える（可用性監査#8）。従来はログのみで最後は常に 200 だった。
          failed++
          console.error(
            `[banto:deadline-reminder] send failed company=${companyId} status=${resendRes.status}`
          )
        }
      }

      // --- 送信「成功後」にのみ、通知済みマーカーを当該行だけ更新（二重送信防止の要） ---
      //   1人でも届いたら「この会社にはこの閾値で通知した」とみなし各行を更新する。
      //   誰にも届かなかった（メール無し/全員配信停止/全員失敗）場合は更新しない＝次回再試行。
      if (companyDelivered) {
        companiesSent++
        for (const { row, offset } of items) {
          const { error: updErr } = await admin
            .from('company_deadlines')
            .update({
              last_notified_offset: offset,
              last_notified_due_on: row.due_on,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          if (updErr) {
            console.error(
              `[banto:deadline-reminder] mark failed id=${row.id}`,
              updErr.message
            )
          }
        }
      }
    } catch (e) {
      // 1社の失敗で全体を止めない（ベストエフォート・weekly-email と同じ）。
      // ただし件数には必ず数える（握り潰さない）。
      failed++
      console.error(`[banto:deadline-reminder] failed for company ${companyId}:`, e)
    }
  }

  // 失敗が1件でもあれば HTTP 500（Vercel Cron の履歴を赤くして不達に気づけるように）。
  return NextResponse.json(
    { sent, failed, slackSent, companies: companiesSent, candidates: companyIds.length },
    { status: failed > 0 ? 500 : 200 },
  )
}
