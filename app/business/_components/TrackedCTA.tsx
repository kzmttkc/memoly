'use client'

import Link from 'next/link'
import { track } from '@/lib/analytics'

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
// ============================================================================

export function TrackedCTA({
  location,
  className,
  href = '/signup',
  children,
}: {
  location: string
  className: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track('signup_cta_clicked', { location })}
    >
      {children}
    </Link>
  )
}
