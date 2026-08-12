import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/company'
import {
  SEIDO_KIT_NAME,
  SEIDO_KIT_PRICE_JPY,
  SEIDO_KIT_PRODUCT_TAG,
} from '@/lib/seido-kit'

// ============================================================================
// /api/seido/kit/checkout — インボイス2026キット（買い切り¥2,980）の Checkout 開始
// ----------------------------------------------------------------------------
//   POST {} → { url }（Stripe Checkout へのリダイレクトURL）
//
//   設計（2026-08-13・AQ-023承認済み）:
//   - ログイン必須。client_reference_id=user.id を載せ、受け取りページ（uketori）で
//     「本人の支払いか」を検証できるようにする（session_id URL の第三者共有対策）。
//   - Price は事前登録せず price_data でインライン生成 → Stripeダッシュボード作業ゼロ。
//   - payment_intent_data.metadata にも product/user_id を複製 → 復元API が
//     paymentIntents.search で購入を引き当てられる（session を失っても復元可能）。
//   - 既存サブスクの BILLING_ENABLED ガードは適用しない（あれは無料モニター中の
//     プラン課金を塞ぐフラグ。本商品は AQ-023 で開通が承認された別商品）。
//     STRIPE_SECRET_KEY 未設定環境では Stripe API が落ち 503 を返すだけで安全。
//   - 金額 2980 は既存 webhook の PAID_AMOUNTS に無く、metadata.product も 'banto' で
//     ないため、サブスク webhook はこの決済を無視する（クロス配信ガードと整合）。
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })
  }

  // ビルド時に鍵が無くても落ちないよう動的 import（既存 webhook と同じ作法）
  const { stripe } = await import('@/lib/stripe')
  const origin = req.nextUrl.origin

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: SEIDO_KIT_PRICE_JPY,
            product_data: {
              name: SEIDO_KIT_NAME,
              metadata: { product: SEIDO_KIT_PRODUCT_TAG },
            },
          },
        },
      ],
      metadata: { product: SEIDO_KIT_PRODUCT_TAG, user_id: user.id },
      payment_intent_data: {
        metadata: { product: SEIDO_KIT_PRODUCT_TAG, user_id: user.id },
      },
      // 特商法（2022年改正）の最終確認画面表示: 決済画面にも返金不可を明示（Legalレビュー推奨#4）
      custom_text: {
        submit: {
          message:
            'デジタルコンテンツの性質上、決済完了後の返金には応じられません。詳細は banto-roumu.com/tokushoho をご確認ください。',
        },
      },
      success_url: `${origin}/seido/kit/uketori?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/seido/kit?billing=canceled`,
    })
    if (!session.url) {
      return NextResponse.json({ error: 'NO_CHECKOUT_URL' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[seido-kit checkout] failed:', e)
    return NextResponse.json({ error: 'CHECKOUT_FAILED' }, { status: 503 })
  }
}
