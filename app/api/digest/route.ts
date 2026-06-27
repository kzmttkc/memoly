import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { anthropic, MEMORY_MODEL } from '@/lib/claude'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://memoly-chat.vercel.app'

// 送信元アドレス。独自ドメイン認証後に DIGEST_FROM_EMAIL を設定する。
// 例: "Memoly <digest@memoly.app>"。表示名なしのアドレスのみでも可。
// 未設定時はメール送信をスキップ（resend.devサンドボックスへフォールバックしない）。
// → 到達率/迷惑メールリスクのある送信元で本番配信されるのを構造的に防ぐ。
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL

// Vercel Cronから呼ばれる週次ダイジェストメール送信API
// Authorization: Bearer CRON_SECRET で保護
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 送信元が未設定なら配信しない（サンドボックス送信元で本番に出さない安全動作）
  if (!DIGEST_FROM_EMAIL) {
    console.warn(
      '[memoly:digest] DIGEST_FROM_EMAIL 未設定のためダイジェスト配信をスキップしました。' +
        '独自ドメイン認証後に環境変数 DIGEST_FROM_EMAIL を設定してください。'
    )
    return NextResponse.json({ sent: 0, skipped: true, reason: 'DIGEST_FROM_EMAIL not set' })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 過去7日以内に記憶が更新されたユーザーを取得
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeUsers } = await admin
    .from('memoly_memories')
    .select('user_id')
    .gte('created_at', since)

  if (!activeUsers?.length) return NextResponse.json({ sent: 0 })

  const uniqueUserIds = [...new Set(activeUsers.map(r => r.user_id))]
  let sent = 0

  for (const userId of uniqueUserIds) {
    try {
      // ユーザーのメールアドレスを取得
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      const email = authUser?.user?.email
      if (!email) continue

      // 配信停止チェック
      if (authUser?.user?.user_metadata?.digest_unsubscribed) continue

      // 直近7日の記憶を取得
      const { data: memories } = await admin
        .from('memoly_memories')
        .select('content')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: profiles } = await admin
        .from('memoly_profiles')
        .select('key, value')
        .eq('user_id', userId)

      if (!memories?.length) continue

      const memorySummary = memories.map(m => `・${m.content}`).join('\n')
      const profileSummary = profiles?.map(p => `${p.key}：${p.value}`).join('、') || ''

      // Claudeでダイジェストメール本文を生成
      const res = await anthropic.messages.create({
        model: MEMORY_MODEL,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `以下はMemolyが今週ユーザーについて覚えた内容です。
週次ダイジェストメールの本文を日本語で書いてください。
温かみがあり、「覚えていてくれる」実感を与える文章にしてください。200字以内。

【プロファイル】${profileSummary}
【今週の記憶】\n${memorySummary}`
        }]
      })

      const body = res.content[0].type === 'text' ? res.content[0].text : ''

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
          subject: '今週Memolyが覚えたこと 🧠',
          headers: {
            'List-Unsubscribe': `<${APP_URL}/unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          text: `${body}\n\n→ チャットを続ける: ${APP_URL}/chat\n\n配信停止: ${APP_URL}/unsubscribe\n\n送信者: kazumototakeshi@gmail.com`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#7c3aed">今週Memolyが覚えたこと 🧠</h2>
            <p style="color:#374151;line-height:1.8">${body.replace(/\n/g, '<br>')}</p>
            <hr style="border-color:#e5e7eb;margin:24px 0">
            <a href="${APP_URL}/chat" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block">チャットを続ける</a>
            <hr style="border-color:#e5e7eb;margin:24px 0">
            <p style="color:#9ca3af;font-size:11px;line-height:1.8">
              【送信者情報】<br>
              サービス名：Memoly<br>
              運営者：Kazumoto Takeshi<br>
              所在地：日本<br>
              お問い合わせ：kazumototakeshi@gmail.com<br><br>
              このメールはMemolyの週次ダイジェストとして送信されています。<br>
              <a href="${APP_URL}/unsubscribe" style="color:#7c3aed">配信停止はこちら</a>
            </p>
          </div>`
        }),
      })

      if (resendRes.ok) sent++
    } catch (e) {
      console.error(`Digest failed for ${userId}:`, e)
    }
  }

  return NextResponse.json({ sent, total: uniqueUserIds.length })
}
