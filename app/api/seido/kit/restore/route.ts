import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/company'
import { SEIDO_KIT_PRODUCT_TAG } from '@/lib/seido-kit'
import { grantSeidoKit, hasSeidoKit } from '@/lib/seido-kit-server'

// ============================================================================
// /api/seido/kit/restore — 購入の復元
// ----------------------------------------------------------------------------
//   POST {} → { restored: boolean }
//
//   決済完了リダイレクト（uketori）を踏み損ねた・別端末で開いた等で
//   app_metadata に購入権が付いていない購入者の救済経路。
//   checkout 時に payment_intent_data.metadata へ user_id/product を刻んであるため、
//   Stripe の PaymentIntent 検索で本人の succeeded 決済を引き当てられる。
//   本人のセッション必須・検索条件は user.id 固定なので他人の決済は引けない。
// ============================================================================

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (hasSeidoKit(user)) return NextResponse.json({ restored: true })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 })
  }

  const { stripe } = await import('@/lib/stripe')
  try {
    const found = await stripe.paymentIntents.search({
      query: `metadata['product']:'${SEIDO_KIT_PRODUCT_TAG}' AND metadata['user_id']:'${user.id}'`,
      limit: 10,
    })
    const paid = found.data.find((pi) => pi.status === 'succeeded')
    if (!paid) return NextResponse.json({ restored: false }, { status: 404 })

    await grantSeidoKit(user.id)
    return NextResponse.json({ restored: true })
  } catch (e) {
    console.error('[seido-kit restore] failed:', e)
    return NextResponse.json({ error: 'RESTORE_FAILED' }, { status: 503 })
  }
}
