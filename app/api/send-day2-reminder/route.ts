import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://memoly-chat.vercel.app'

// 送信元アドレス（digest と共通）。独自ドメイン認証後に DIGEST_FROM_EMAIL を設定する。
// 未設定時はメール送信をスキップ（resend.devサンドボックスへフォールバックしない）。
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL

// Vercel Cronから1日1回呼ばれる Day 2 リマインドメール送信API
// （Hobbyプランは日次cronのみ。対象ウィンドウが24時間幅＋day2_sent_atフラグのため
//   日次実行でも全ユーザーをちょうど1回ずつ捕捉でき重複もしない）
// 初回チャット（記憶保存）から 24〜48 時間後に1回だけ送信
// Authorization: Bearer CRON_SECRET で保護

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 送信元が未設定なら配信しない（サンドボックス送信元で本番に出さない安全動作）
  if (!DIGEST_FROM_EMAIL) {
    console.warn(
      '[memoly:day2] DIGEST_FROM_EMAIL 未設定のため Day2 リマインド配信をスキップしました。'
    )
    return NextResponse.json({ sent: 0, skipped: true, reason: 'DIGEST_FROM_EMAIL not set' })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 対象ユーザーを抽出:
  //   - day2_sent_at が NULL（未送信）
  //   - 最初の記憶作成から 24〜48 時間以内のユーザー
  // subqueryで memoly_memories の最古レコードを user_id ごとに集約して結合
  const now = new Date()
  const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()   // 24時間前
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() // 48時間前

  // 各ユーザーの最初の記憶作成日時を取得（ユーザー側でRLS回避のためservice roleを使用）
  const { data: firstMemories, error: memErr } = await admin
    .from('memoly_memories')
    .select('user_id, created_at')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .order('created_at', { ascending: true })

  if (memErr) {
    console.error('Day2 reminder: failed to fetch memories', memErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!firstMemories?.length) {
    return NextResponse.json({ sent: 0, reason: 'no target users in window' })
  }

  // user_id ごとの最古記憶のみを残す（同一ユーザーの重複を排除）
  const firstMemoryByUser = new Map<string, string>()
  for (const row of firstMemories) {
    if (!firstMemoryByUser.has(row.user_id)) {
      firstMemoryByUser.set(row.user_id, row.created_at)
    }
  }

  // 未送信フラグチェック（day2_sent_at IS NULL）
  const candidateUserIds = [...firstMemoryByUser.keys()]
  const { data: targetUsers, error: userErr } = await admin
    .from('memoly_users')
    .select('id, email')
    .in('id', candidateUserIds)
    .is('day2_sent_at', null)

  if (userErr) {
    console.error('Day2 reminder: failed to fetch users', userErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!targetUsers?.length) {
    return NextResponse.json({ sent: 0, reason: 'all candidates already sent' })
  }

  let sent = 0
  const errors: string[] = []

  for (const user of targetUsers) {
    try {
      // ユーザーのメールアドレスを取得（memoly_usersのemailカラム or Auth側）
      let email = user.email
      if (!email) {
        const { data: authUser } = await admin.auth.admin.getUserById(user.id)
        email = authUser?.user?.email ?? null
      }
      if (!email) {
        errors.push(`${user.id}: no email`)
        continue
      }

      // 配信停止チェック
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)
      if (authUser?.user?.user_metadata?.day2_unsubscribed) {
        errors.push(`${user.id}: unsubscribed`)
        continue
      }

      // 最初の記憶を1件取得（パーソナライズ用）
      const { data: memories } = await admin
        .from('memoly_memories')
        .select('content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)

      const firstMemory = memories?.[0]?.content ?? null

      // メール本文の組み立て
      let bodyText: string
      let bodyHtml: string

      if (firstMemory) {
        bodyText = `昨日の会話を覚えています。\n\n「${firstMemory}」\n\nまた話しかけてください。あなたのことを覚えています。`
        bodyHtml = `<p style="color:#374151;line-height:1.8">昨日の会話を覚えています。</p>
            <blockquote style="border-left:3px solid #7c3aed;margin:16px 0;padding:8px 16px;color:#4b5563">
              ${escapeHtml(firstMemory)}
            </blockquote>
            <p style="color:#374151;line-height:1.8">また話しかけてください。あなたのことを覚えています。</p>`
      } else {
        bodyText = `昨日の会話を覚えています。\nまた話しかけてください。`
        bodyHtml = `<p style="color:#374151;line-height:1.8">昨日の会話を覚えています。<br>また話しかけてください。</p>`
      }

      // Resendでメール送信
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DIGEST_FROM_EMAIL,
          to: email,
          subject: '昨日の会話、覚えています',
          headers: {
            'List-Unsubscribe': `<${APP_URL}/unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          text: `${bodyText}\n\n→ チャットを続ける: ${APP_URL}/chat\n\n配信停止: ${APP_URL}/unsubscribe\n\n送信者: kazumototakeshi@gmail.com`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#7c3aed">昨日の会話、覚えています 🧠</h2>
            ${bodyHtml}
            <hr style="border-color:#e5e7eb;margin:24px 0">
            <a href="${APP_URL}/chat" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block">チャットを続ける</a>
            <hr style="border-color:#e5e7eb;margin:24px 0">
            <p style="color:#9ca3af;font-size:11px;line-height:1.8">
              【送信者情報】<br>
              サービス名：Memoly<br>
              運営者：Kazumoto Takeshi<br>
              所在地：日本<br>
              お問い合わせ：kazumototakeshi@gmail.com<br><br>
              このメールはMemolyのDay2リマインドとして1回のみ送信されます。<br>
              <a href="${APP_URL}/unsubscribe" style="color:#7c3aed">配信停止はこちら</a>
            </p>
          </div>`,
        }),
      })

      if (!resendRes.ok) {
        const errBody = await resendRes.text()
        errors.push(`${user.id}: Resend ${resendRes.status} ${errBody}`)
        continue
      }

      // 送信成功後に day2_sent_at を記録（重複防止フラグ）
      const { error: updateErr } = await admin
        .from('memoly_users')
        .update({ day2_sent_at: new Date().toISOString() })
        .eq('id', user.id)
        .is('day2_sent_at', null) // 競合防止: 二重更新を防ぐ

      if (updateErr) {
        console.error(`Day2 reminder: failed to update flag for ${user.id}`, updateErr)
        // フラグ更新失敗でもメール送信済みなので errors に含めない（次回Cron実行で再送されるリスクあり）
        errors.push(`${user.id}: flag update failed (email sent) - ${updateErr.message}`)
      } else {
        sent++
      }
    } catch (e) {
      console.error(`Day2 reminder failed for ${user.id}:`, e)
      errors.push(`${user.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    sent,
    total: targetUsers.length,
    errors: errors.length ? errors : undefined,
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
}
