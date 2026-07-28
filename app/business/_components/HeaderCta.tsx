'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trackV as track } from '../_lib/variant'
import { hrefWithForwardedAttribution } from './TrackedCTA'

// ============================================================================
// HeaderCta — スティッキーヘッダのCTAをスクロール深度で動的に変える（A12・2026-07-23）。
//   FV滞在中は従来どおり「無料で始める」。ページを一定深度（700px）読み進めた
//   来訪者は検討が進んでいるとみなし、次の一歩が具体的な「診断を始める」へ切替。
//   リンク先は従来と同じ /signup?next=/company（登録後の着地で診断へ進める）。
//
//   実装: useSyncExternalStore でスクロール位置の「閾値超え(boolean)」だけを購読。
//   effect内setStateを使わず、値が変わったときだけ再レンダリングされる
//   （SSRスナップショットは false = 「無料で始める」でハイドレーション安全）。
//
//   計測: 既存語彙 signup_cta_clicked / location='header' は不変。どちらの文言で
//   押されたかは低カーディナリティな label prop（'start'|'shindan'）で分離する。
//   utm 引き継ぎは TrackedCTA と同じ hrefWithForwardedAttribution を共用。
// ============================================================================

const HREF = '/signup?next=/company'
const DEPTH_PX = 700

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}

export function HeaderCta({ className }: { className: string }) {
  const router = useRouter()
  const deep = useSyncExternalStore(
    subscribe,
    () => window.scrollY > DEPTH_PX,
    () => false,
  )

  return (
    <Link
      href={HREF}
      className={className}
      onClick={e => {
        track('signup_cta_clicked', {
          location: 'header',
          label: deep ? 'shindan' : 'start',
        })
        const target = hrefWithForwardedAttribution(HREF)
        if (target !== HREF) {
          e.preventDefault()
          router.push(target)
        }
      }}
    >
      {deep ? '無料登録して診断へ' : '無料で始める'}
    </Link>
  )
}
