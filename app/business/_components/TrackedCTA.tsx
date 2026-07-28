'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// TrackedCTA — LP(/business)の signup CTA を計測する薄いクライアントラッパ。
//
//   なぜ必要か: /business はサーバーコンポーネント(metadata export)で、複数の
//   <Link href="/signup"> CTA があるがクリック計測が無い。signup_started は
//   signupページ到達後に発火するため「LPでどのCTAが押されたか／押されず離脱
//   したか」が不可視だった。獲得フェーズで最大の暗箱=LP→signup遷移率を測る。
//
//   設計: href/見た目(className)は不変=回帰リスク最小。CTAだけをこの client
//   境界に切り出すので LP本体の SSR/SEO/metadata は無傷。クリックで
//   signup_cta_clicked(props.location)を1発撃つだけ。計測失敗は track 側で
//   握りつぶされ遷移は必ず起きる。
//
//   帰属の引き継ぎ(2026-07-10): sharoushiツール等の外部流入は /business に
//   utm_source を載せて着地するが、CTAが /signup?next=/company 固定だと utm が
//   このホップで脱落し signup_completed が (direct/none) 化 → 8/5ゲートの
//   「sharoushi起因の登録」判定が構造的に過小計上される。ここで useSearchParams を
//   使うと静的な /business が Suspense 要求で動的化しSEOを損なうため、代わりに
//   onClick時に window.location.search から utm を読み、あれば付与して router.push
//   する。Link href は静的のまま(クローラ/no-JSは素の /signup?next=/company に着地)。
// ============================================================================

const FORWARD_KEYS = ['utm_source', 'utm_campaign', 'utm_medium'] as const

// HeaderCta（A12）等の兄弟クライアントコンポーネントでも同じ utm 引き継ぎ規則を
// 使うため export する（挙動は従来と不変）。
export function hrefWithForwardedAttribution(href: string): string {
  if (typeof window === 'undefined') return href
  const landing = new URLSearchParams(window.location.search)
  const [path, existingQs = ''] = href.split('?')
  const merged = new URLSearchParams(existingQs)
  for (const key of FORWARD_KEYS) {
    // href が明示的に持つ値を優先（無い場合のみ着地URLから引き継ぐ）
    if (!merged.has(key)) {
      const v = landing.get(key)
      if (v) merged.set(key, v.slice(0, 60))
    }
  }
  const qs = merged.toString()
  return qs ? `${path}?${qs}` : path
}

export function TrackedCTA({
  location,
  className,
  // 既定で確認後/登録後の着地を /company に固定（活性化の次の一歩を保証）。
  // signup ページは ?next を読んで尊重する実装になっている。
  href = '/signup?next=/company',
  // 2026-07-28 CTO修正（L2監査#13）: 同一ページ内に同じ href(既定値)を持つ
  //   TrackedCTAが複数（hero/pricing x2/final/footer）マウントされ、かつヘッダの
  //   HeaderCta（常時マウント・prefetch既定=true）も同じhrefを持つため、ページ
  //   読み込み・スクロールのたびに同一ルートへの重複したprefetch通信が発生していた
  //   （軽微・実害小・ペルソナ9指摘）。/signupの初回prefetchはHeaderCta1本に
  //   任せれば十分なため、TrackedCTA側は既定でprefetchを無効化する（クリック時の
  //   遷移自体・計測・utm引き継ぎは無変更）。
  prefetch = false,
  children,
}: {
  location: string
  className: string
  href?: string
  prefetch?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onClick={(e) => {
        track('signup_cta_clicked', { location })
        const target = hrefWithForwardedAttribution(href)
        // 着地に utm があった時だけ client 遷移で引き継ぐ。無ければ素の Link 遷移。
        if (target !== href) {
          e.preventDefault()
          router.push(target)
        }
      }}
    >
      {children}
    </Link>
  )
}
