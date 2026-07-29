import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://banto-roumu.com'
// 番頭の対外ドメイン（メール内リンク・配信停止・送信者情報で使用）。
const BANTO_URL = 'https://banto-roumu.com'

// 送信元アドレス（digest と共通）。独自ドメイン認証後に DIGEST_FROM_EMAIL を設定する。
// 未設定時はメール送信をスキップ（resend.devサンドボックスへフォールバックしない）。
const DIGEST_FROM_EMAIL = process.env.DIGEST_FROM_EMAIL

// Vercel Cronから1日1回呼ばれる Day 2 リマインドメール送信API
// （Hobbyプランは日次cronのみ。対象ウィンドウが24時間幅＋day2_sent_atフラグのため
//   日次実行でも全ユーザーをちょうど1回ずつ捕捉でき重複もしない）
// 初回チャット（記憶保存）から 24〜48 時間後に1回だけ送信
// Authorization: Bearer CRON_SECRET で保護

export async function GET(req: Request) {
  // fail-safe: CRON_SECRET 未設定時は「Bearer undefined」一致で認可が通るため、認可より先に安全に停止
  if (!process.env.CRON_SECRET) {
    console.warn('[send-day2-reminder] CRON_SECRET 未設定のため配信をスキップしました。')
    return NextResponse.json({ sent: 0, skipped: true, reason: 'CRON_SECRET not set' })
  }

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

  // 対象の抽出（2026-07-30 修正）:
  //   従来ここは旧Memoly個人版のテーブル（memoly_memories / memoly_users）を走査していた。
  //   番頭は company_* に書くため、このcronは毎日空振りして0通で終わっていた
  //   ＝「登録2日目という最も離脱しやすい瞬間の唯一の打ち手」が死んでいた（UX監査 B-4）。
  //   番頭のスキーマ（companies / company_members）で対象を取り直す。
  //
  //   対象 = 会社作成から24〜48時間 かつ **まだ規程も記憶も入れていない** 会社の admin。
  //   価値の解錠条件は「就業規則を貼る」ことなので、そこに到達していない人にだけ送る。
  //   既に入れている人には送らない（用済みのリマインドで信頼を削らない）。
  const now = new Date()
  const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()   // 24時間前
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() // 48時間前

  const { data: freshCompanies, error: memErr } = await admin
    .from('companies')
    .select('id, name, created_at')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)

  if (memErr) {
    console.error('Day2 reminder: failed to fetch companies', memErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!freshCompanies?.length) {
    return NextResponse.json({ sent: 0, reason: 'no target companies in window' })
  }

  // まだ規程（company_documents）も記憶（company_memories）も無い会社に絞る。
  const targetCompanies: { id: string; name: string | null }[] = []
  for (const c of freshCompanies) {
    const [{ count: docCount }, { count: memCount }] = await Promise.all([
      admin
        .from('company_documents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.id),
      admin
        .from('company_memories')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', c.id),
    ])
    if ((docCount ?? 0) === 0 && (memCount ?? 0) === 0) {
      targetCompanies.push({ id: c.id, name: c.name })
    }
  }

  if (!targetCompanies.length) {
    return NextResponse.json({ sent: 0, reason: 'all fresh companies already activated' })
  }

  // 各会社の admin を宛先にする（1会社1通）。
  const targetUsers: { id: string; email: string | null; companyName: string | null }[] = []
  for (const c of targetCompanies) {
    const { data: admins } = await admin
      .from('company_members')
      .select('user_id')
      .eq('company_id', c.id)
      .eq('role', 'admin')
      .limit(1)
    const uid = admins?.[0]?.user_id
    if (uid) targetUsers.push({ id: uid, email: null, companyName: c.name })
  }

  if (!targetUsers.length) {
    return NextResponse.json({ sent: 0, reason: 'no admin members found' })
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

      // 配信停止チェック＋重複防止（day2_sent_at は user_metadata で持つ。
      // 旧 memoly_users テーブルは番頭では使わないため）。
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)
      if (authUser?.user?.user_metadata?.day2_unsubscribed) {
        errors.push(`${user.id}: unsubscribed`)
        continue
      }
      if (authUser?.user?.user_metadata?.day2_sent_at) {
        errors.push(`${user.id}: already sent`)
        continue
      }

      // 本文は「就業規則を貼り付ける」の一点に絞る（UX監査 B-4/B-6）。
      //   番頭の価値が解錠されるのはここだけで、登録2日目に伝えるべきことも1つでよい。
      //   プライバシー配慮のため、保存された記録の内容はメールに引用しない
      //   （労務データを平文メールに載せない安全側の設計）。
      const bodyText =
        `番頭にご登録いただき、ありがとうございます。\n\n` +
        `就業規則の本文をコピーして貼り付けると、番頭が全文を覚えます。\n` +
        `以降は「自社の規程では第◯条にこう定めています」と、一般論ではなく御社の条文を引いて答えます。\n\n` +
        `貼り付けは3分ほどで終わります。ファイルの添付には未対応のため、本文をテキストでお願いします。`

      // Resendでメール送信（差出人・リンク・送信者情報はすべて番頭に統一）
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DIGEST_FROM_EMAIL,
          to: email,
          subject: '就業規則を貼り付けると、明日から自社の条文で答えます｜番頭',
          headers: {
            'List-Unsubscribe': `<${BANTO_URL}/unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          text: `${bodyText}\n\n→ 就業規則を貼り付ける: ${BANTO_URL}/company/documents\n\n配信停止: ${BANTO_URL}/unsubscribe`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#324a8a;font-size:18px;margin:0 0 12px">就業規則を貼り付けると、自社の条文で答えます</h2>
            <p style="color:#374151;line-height:1.8;font-size:14px">番頭にご登録いただき、ありがとうございます。</p>
            <p style="color:#374151;line-height:1.8;font-size:14px">就業規則の本文をコピーして貼り付けると、番頭が<strong>全文を覚えます</strong>。以降は「自社の規程では第◯条にこう定めています」と、一般論ではなく御社の条文を引いて答えます。</p>
            <p style="color:#6b7280;line-height:1.8;font-size:13px">貼り付けは3分ほどで終わります。ファイルの添付には未対応のため、本文をテキストでお願いします。</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <a href="${BANTO_URL}/company/documents" style="background:#324a8a;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block;font-size:14px">就業規則を貼り付ける</a>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="color:#9ca3af;font-size:11px;line-height:1.8">
              【送信者情報】<br>
              サービス名：番頭（banto-roumu.com）<br>
              運営者：Kazumoto Takeshi<br>
              所在地：日本<br>
              お問い合わせ：support@banto-roumu.com<br><br>
              このメールは番頭の初回フォローとして1回のみ送信されます。<br>
              <a href="${BANTO_URL}/unsubscribe" style="color:#324a8a">配信停止はこちら</a>
            </p>
          </div>`,
        }),
      })

      if (!resendRes.ok) {
        const errBody = await resendRes.text()
        errors.push(`${user.id}: Resend ${resendRes.status} ${errBody}`)
        continue
      }

      // 送信成功後に day2_sent_at を記録（重複防止フラグ）。
      // 番頭には memoly_users テーブルが無いため auth.users の user_metadata に持つ
      // （digest_unsubscribed と同じ流儀）。上の送信前チェックと対で二重送信を防ぐ。
      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(authUser?.user?.user_metadata ?? {}),
          day2_sent_at: new Date().toISOString(),
        },
      })

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
