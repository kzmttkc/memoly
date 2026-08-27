import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { getCurrentUser } from '@/lib/company'
import { grantSeidoKit, hasSeidoKit, isValidKitSession } from '@/lib/seido-kit-server'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido/kit/uketori — 決済完了リダイレクトの受け取り（動的・noindex）
//   Stripe Checkout の success_url。session_id を検証して購入権を付与し、
//   honbun へ送る。検証3条件（paid／本商品タグ／本人）は lib/seido-kit-server。
//   ログインが切れていた場合は、session_id を保ったまま login へ回す
//   （login/signup は ?next のクエリ込みパスを尊重する実装を確認済み）。
//   踏み損ねても /api/seido/kit/restore で復元できる（honbun の未購入ビュー）。
// ============================================================================

export const metadata: Metadata = {
  title: 'ご購入の確認｜就業規則AI',
  robots: { index: false, follow: false },
}

export default async function SeidoKitUketoriPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  const user = await getCurrentUser()

  if (!user) {
    const next = encodeURIComponent(`/seido/kit/uketori?session_id=${session_id ?? ''}`)
    redirect(`/login?next=${next}`)
  }

  if (hasSeidoKit(user)) redirect('/seido/kit/honbun')

  let failure: string | null = null
  if (!session_id) {
    failure = '決済セッションが見つかりませんでした。'
  } else if (!process.env.STRIPE_SECRET_KEY) {
    failure = '決済の確認を行えませんでした。時間をおいてもう一度お試しください。'
  } else {
    try {
      const { stripe } = await import('@/lib/stripe')
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (isValidKitSession(session, user.id)) {
        await grantSeidoKit(user.id)
        redirect('/seido/kit/honbun?welcome=1')
      }
      failure =
        'お支払いの確認ができませんでした。決済が完了している場合は、purchases（購入の復元）をお試しください。'
    } catch (e) {
      // redirect() は例外で実装されているため、そのまま投げ直す
      if (e && typeof e === 'object' && 'digest' in e) throw e
      console.error('[seido-kit uketori] verify failed:', e)
      failure = '決済の確認中にエラーが発生しました。時間をおいてもう一度お試しください。'
    }
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <Card padded className="space-y-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">ご購入の確認</h1>
          <p className="text-sm leading-relaxed text-neutral-600">{failure}</p>
          <div className="flex flex-col items-center gap-2 text-sm">
            <Link href="/seido/kit/honbun" className="font-medium text-brand-700 hover:underline">
              キット本文ページへ（購入の復元はこちらから）
            </Link>
            <Link href="/seido/kit" className="text-neutral-500 hover:underline">
              販売ページへ戻る
            </Link>
          </div>
        </Card>
      </section>
      <PublicFooter />
    </div>
  )
}
