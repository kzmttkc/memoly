import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

// ============================================================================
// /api/company/billing/portal — Stripe カスタマーポータルのセッションを作る
// ----------------------------------------------------------------------------
//   POST { companyId } → { url }（Stripe ポータルへリダイレクトするURL）
//
//   なぜ要るか（2026-07-30 法務監査#2 の是正）:
//     /tokushoho は「管理画面上でお客様ご自身が解約手続きを完了する機能は提供して
//     おらず…原則3営業日以内に処理し」「次回以降の請求は発生しません」を併記していた。
//     この2文は請求日の直前に申し出た場合に両立しない（3営業日の処理待ちのあいだに
//     更新日を跨ぐと次期課金が走り、「次回以降の請求は発生しません」が虚偽になる）。
//     自己解約の導線を1本通すことが根治で、暫定策として /tokushoho の解約欄に
//     「請求日の7日前まで」の但し書きを入れてある（ポータル運用開始後は不要になる）。
//
//   ガード（checkout ルートと同型に揃える。片方だけ緩いと抜け道になるため）:
//     1. ログイン必須（401）
//     2. その会社の **admin** のみ（member は 403）
//     3. companies.stripe_customer_id が無い（＝一度も課金していない）なら 400
//
//   ★Takeshi 手番（実装だけでは完結しない）:
//     Stripe ダッシュボード → Settings → Billing → Customer portal で
//     「サブスクリプションのキャンセル」を **請求期間の末日で解約（at end of billing
//     period）** に設定すること。既定の「即時キャンセル」のままだと、/tokushoho の
//     「請求期間の末日までご利用いただけます」という表記と実挙動が食い違い、
//     そのまま虚偽表示になる（lib/stripe.ts の cancelSubscription() が即時解約なのと
//     同じ罠）。プロレーション返金も「返金しない」に倒すこと（返金方針と一致させる）。
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId } = (await req.json().catch(() => ({}))) as { companyId?: string }

  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId が必要です' }, { status: 400 })
  }

  // admin 検証（課金操作は管理者のみ。checkout ルートと同一の流儀）。
  const membership = await getMembership(companyId)
  if (!membership) {
    return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
  }
  if (membership.role !== 'admin') {
    return NextResponse.json({ error: '課金操作は管理者のみ可能です' }, { status: 403 })
  }

  // 顧客IDが無い＝Stripe 上に契約が存在しない。ポータルは開けない。
  const supabase = await createServerSupabaseClient()
  const { data: companyRow } = await supabase
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', companyId)
    .maybeSingle()

  const customerId = companyRow?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json(
      {
        error: 'NO_CUSTOMER',
        message: 'この会社にはお支払い情報が登録されていません。',
      },
      { status: 400 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/company/billing?companyId=${companyId}`,
      locale: 'ja',
    })
    return NextResponse.json({ url: portal.url })
  } catch (e) {
    // ポータルのフロー設定が未保存だと Stripe 側で失敗する（上の Takeshi 手番参照）。
    console.error('[billing:portal] create session failed', (e as Error).message)
    return NextResponse.json(
      { error: 'お支払い情報の管理画面を開けませんでした。' },
      { status: 500 },
    )
  }
}
