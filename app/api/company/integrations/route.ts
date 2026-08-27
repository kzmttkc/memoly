import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'
import { isValidSlackWebhookUrl, maskSlackWebhookUrl, sendSlackMessage } from '@/lib/slack'

// ============================================================================
// /api/company/integrations — Slack連携の設定（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   会社ごとの Slack Incoming Webhook URL を登録/確認/解除する（admin のみ）。
//   登録すると、期限リマインド（deadline-reminder cron）と週次ダイジェスト
//   （weekly-email cron）がメールに加えて Slack にも届く。
//
//   秘匿の原則:
//     - GET は生URLを返さない（設定有無 + 末尾4文字のマスク表示のみ）。
//     - 監査ログの metadata にも URL を入れない。
//     - console.* にも URL を出さない（lib/slack.ts と同じ）。
//
//   fail-safe: テーブル未適用（supabase/company_integrations.sql 適用前）でも
//   GET は「未設定」を返し、POST は 503 で原因を明示する（deadlines と同じ流儀）。
// ============================================================================

// GET ?companyId= — 設定状態（admin のみ。RLS も admin 限定）。
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_integrations')
    .select('slack_webhook_url, updated_at')
    .eq('company_id', companyId as string)
    .maybeSingle()

  // テーブル未適用でも UI を壊さない: 未設定として返す。
  if (error) {
    console.error('[company:integrations] select failed (non-fatal)', error.code)
    return NextResponse.json({ slack: { configured: false } })
  }
  const url = data?.slack_webhook_url
  return NextResponse.json({
    slack: url
      ? { configured: true, masked: maskSlackWebhookUrl(url), updatedAt: data?.updated_at ?? null }
      : { configured: false },
  })
}

// POST { companyId, webhookUrl, test? } — Webhook の登録/変更（admin のみ）。
//   test=true のときは保存後にテスト通知を1通送る（失敗しても保存は成立）。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, webhookUrl, test } = body as {
    companyId?: unknown
    webhookUrl?: unknown
    test?: unknown
  }

  const guard = await requireAdmin(companyId)
  if (guard) return guard

  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return NextResponse.json(
      {
        error:
          'Slack の Incoming Webhook URL の形式ではありません。https://hooks.slack.com/services/ で始まるURLを入力してください。',
      },
      { status: 400 },
    )
  }

  const user = await getCurrentUser()
  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from('company_integrations').upsert(
    {
      company_id: companyId as string,
      slack_webhook_url: webhookUrl,
      updated_by: user?.id ?? null,
      updated_at: now,
    },
    { onConflict: 'company_id' },
  )

  if (error) {
    console.error('[company:integrations] upsert failed', error.code)
    const notApplied = (error.code ?? '') === '42P01'
    return NextResponse.json(
      {
        error: notApplied
          ? '連携設定の保存先がまだ準備されていません。時間をおいてお試しください。'
          : '保存に失敗しました。時間をおいてお試しください。',
      },
      { status: notApplied ? 503 : 500 },
    )
  }

  // 監査ログ（URLは記録しない・末尾4文字のみ）。
  if (user) {
    await logCompanyAudit({
      companyId: companyId as string,
      actorUserId: user.id,
      action: 'integration.slack.update',
      targetType: 'slack_webhook',
      metadata: { tail: (webhookUrl as string).slice(-4) },
    })
  }

  // 任意のテスト送信（保存の成否とは独立・失敗しても 200 のまま testSent で伝える）。
  let testSent: boolean | undefined
  if (test === true) {
    testSent = await sendSlackMessage(
      webhookUrl as string,
      ':white_check_mark: 就業規則AIとSlackの連携が設定されました。期限リマインドと週次ダイジェストがこのチャンネルに届きます。',
      companyId as string,
    )
  }

  return NextResponse.json({
    ok: true,
    slack: { configured: true, masked: maskSlackWebhookUrl(webhookUrl as string) },
    ...(testSent !== undefined ? { testSent } : {}),
  })
}

// DELETE ?companyId= — Webhook の解除（admin のみ）。
export async function DELETE(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('company_integrations')
    .update({ slack_webhook_url: null, updated_at: new Date().toISOString() })
    .eq('company_id', companyId as string)

  if (error) {
    console.error('[company:integrations] delete failed', error.code)
    return NextResponse.json({ error: '解除に失敗しました' }, { status: 500 })
  }

  const user = await getCurrentUser()
  if (user) {
    await logCompanyAudit({
      companyId: companyId as string,
      actorUserId: user.id,
      action: 'integration.slack.delete',
      targetType: 'slack_webhook',
    })
  }
  return NextResponse.json({ ok: true, slack: { configured: false } })
}

// 共通: ログイン + admin 所属を要求（deadlines/route.ts の requireAdmin と同型）。
async function requireAdmin(companyId: unknown): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ設定できます' }, { status: 403 })
  }
  return null
}
