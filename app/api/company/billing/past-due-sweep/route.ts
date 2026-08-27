import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSlackMessage } from '@/lib/slack'
import { PAST_DUE_GRACE_DAYS, pastDueExpired } from '../webhook/transition'
import { verifyCronBearer } from '@/lib/cron-auth'

// ============================================================================
// /api/company/billing/past-due-sweep — 滞納(past_due)の時間上限を機械的に打ち切る
// ----------------------------------------------------------------------------
// 【なぜ要るか（2026-07-30 監査・重大 #2）】
//   webhook は支払い失敗を past_due(grace) として扱い、**plan を維持**する。
//   これは「カード期限切れの優良顧客を1回の失敗で機能停止にしない」ための正しい設計だが、
//   旧実装には **時間の上限が無かった**。降格は customer.subscription.deleted の到着に
//   完全依存しており、Stripe 側のリトライ設定が「最終的に何もしない」だと deleted は
//   永遠に来ない。＝1円も払わずに有料機能を無期限に使い続けられる。
//   grep -rn "past_due" app lib supabase の結果、期限を切る処理は1つも無かった。
//
// 【何をするか】
//   companies.past_due_since（webhook が past_due 初回に刻む）から
//   PAST_DUE_GRACE_DAYS(=21日) を超えた会社を plan='free' に落とす。
//   席数(seats_purchased)・stripe_* は触らない（再開時の付け直しを避ける）。
//
// 【降格は不可逆で顧客に影響する。だから落とす前に必ず】
//   1. console.error に対象を1社ずつ残す（Vercel ログに必ず出る）
//   2. OPS_SLACK_WEBHOOK_URL があれば ops へ通知する（best-effort）
//   3. company_billing_events に監査行を残す（event_id で冪等＝同日2回叩いても二重降格しない）
//   Slack 未設定でも降格は進める（通知チャネルの欠如を収益リークの理由にしない）。
//   ★ ?dryRun=1 を付けると **降格せず対象一覧だけ**返す（本番で安全に確認できる）。
//
// 【migration 未適用でも壊れない】
//   past_due_since 列が無ければ select がエラーになる。その場合は 200 + skipped で返し、
//   cron を赤くしない（適用は Takeshi 手番: supabase/billing_past_due_grace.sql）。
//
// 【実行】Vercel Cron（vercel.json: 毎日 02:00 UTC = 11:00 JST）。CRON_SECRET Bearer 必須。
// ============================================================================

/** 1回の実行で降格する上限（暴走時の被害を有限にする安全弁）。 */
const MAX_DEMOTIONS_PER_RUN = 50

export async function GET(req: Request) {
  // --- fail-safe: CRON_SECRET 未設定なら認可より先に「安全に何もしない」 ---
  // 2026-08-13: 照合は lib/cron-auth.ts の定数時間比較に統一。
  const cronAuth = verifyCronBearer(req.headers.get('authorization'))
  if (cronAuth === 'not-configured') {
    console.warn('[billing:past-due-sweep] CRON_SECRET 未設定のためスキップしました。')
    return NextResponse.json({ demoted: 0, skipped: true, reason: 'CRON_SECRET not set' })
  }
  if (cronAuth !== 'ok') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[billing:past-due-sweep] Supabase env 未設定のためスキップしました。')
    return NextResponse.json({ demoted: 0, skipped: true, reason: 'supabase env not set' })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- 対象抽出: 有料 plan のまま past_due が続いている会社 ---
  const { data: rows, error } = await admin
    .from('companies')
    .select('id, name, plan, status, past_due_since, stripe_subscription_id')
    .eq('status', 'past_due')
    .neq('plan', 'free')
    .not('past_due_since', 'is', null)
    .order('past_due_since', { ascending: true })

  if (error) {
    // 列未適用（migration 前）でも cron を落とさない。適用は Takeshi 手番。
    console.error(
      '[billing:past-due-sweep] 抽出に失敗（supabase/billing_past_due_grace.sql 未適用の可能性）',
      { code: (error as { code?: string }).code, msg: error.message },
    )
    return NextResponse.json({ demoted: 0, skipped: true, reason: 'past_due_since not ready' })
  }

  const now = new Date()
  const expired = (rows ?? [])
    .filter(r => pastDueExpired(r.past_due_since as string | null, now))
    .slice(0, MAX_DEMOTIONS_PER_RUN)

  if (expired.length === 0) {
    return NextResponse.json({ demoted: 0, candidates: rows?.length ?? 0, graceDays: PAST_DUE_GRACE_DAYS })
  }

  const today = now.toISOString().slice(0, 10)
  const summary = expired
    .map(r => `・${r.name ?? r.id}（plan=${r.plan} / 滞納開始 ${String(r.past_due_since).slice(0, 10)}）`)
    .join('\n')

  // --- (1) ログ: 降格の「前」に必ず出す。Slack が死んでいてもここは残る。 ---
  console.error(
    `[billing:past-due-sweep] ${PAST_DUE_GRACE_DAYS}日超の滞納 ${expired.length}社を free へ降格します` +
      `${dryRun ? '（dryRun: 実際には降格しません）' : ''}`,
    { companies: expired.map(r => ({ id: r.id, plan: r.plan, past_due_since: r.past_due_since })) },
  )

  // --- (2) ops 通知（best-effort。未設定・失敗でも降格は止めない） ---
  const opsWebhook = process.env.OPS_SLACK_WEBHOOK_URL
  let opsNotified = false
  if (opsWebhook) {
    opsNotified = await sendSlackMessage(
      opsWebhook,
      `:warning: *就業規則AI / 滞納${PAST_DUE_GRACE_DAYS}日超のプラン降格*${dryRun ? '（dryRun）' : ''}\n` +
        `${expired.length}社を plan=free に落とします。復帰は Stripe での支払い成功で自動。\n\n${summary}`,
    )
  } else {
    console.warn('[billing:past-due-sweep] OPS_SLACK_WEBHOOK_URL 未設定のため Slack 通知は省略しました。')
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      demoted: 0,
      candidates: expired.map(r => ({ id: r.id, plan: r.plan, past_due_since: r.past_due_since })),
      graceDays: PAST_DUE_GRACE_DAYS,
      opsNotified,
    })
  }

  // --- (3) 監査行 + 降格 ---
  let demoted = 0
  for (const row of expired) {
    try {
      // 冪等キー: 同じ会社・同じ日に2回叩いても2行目は 23505 で弾かれる。
      const { error: recErr } = await admin.from('company_billing_events').insert({
        event_id: `past_due_sweep:${row.id}:${today}`,
        company_id: row.id,
        event_type: 'banto.past_due_sweep',
        plan: 'free',
        stripe_subscription_id: row.stripe_subscription_id ?? null,
      })
      if (recErr && (recErr as { code?: string }).code === '23505') {
        continue // 本日分は処理済み
      }
      if (recErr) {
        console.error('[billing:past-due-sweep] 監査行の記録に失敗（降格は行いません）', {
          company_id: row.id,
          msg: recErr.message,
        })
        continue
      }

      const { error: updErr } = await admin
        .from('companies')
        .update({ plan: 'free', past_due_since: null })
        .eq('id', row.id)
        .eq('status', 'past_due') // 直前に復帰していたら落とさない（競合ガード）
      if (updErr) {
        console.error('[billing:past-due-sweep] 降格に失敗', { company_id: row.id, msg: updErr.message })
        continue
      }
      demoted++
    } catch (e) {
      console.error('[billing:past-due-sweep] 例外', { company_id: row.id, msg: (e as Error).message })
    }
  }

  return NextResponse.json({
    demoted,
    candidates: expired.length,
    graceDays: PAST_DUE_GRACE_DAYS,
    opsNotified,
  })
}
