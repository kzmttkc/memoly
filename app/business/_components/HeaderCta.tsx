'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trackV as track } from '../_lib/variant'
import { hrefWithForwardedAttribution } from './TrackedCTA'

// ============================================================================
// HeaderCta — スティッキーヘッダの主CTA。入口はファイルを置く（/zure）。
// ============================================================================

const HREF = '/zure'

export function HeaderCta({ className }: { className: string }) {
  const router = useRouter()

  return (
    <Link
      href={HREF}
      className={className}
      onClick={e => {
        track('signup_cta_clicked', {
          location: 'header',
          label: 'start',
        })
        const target = hrefWithForwardedAttribution(HREF)
        if (target !== HREF) {
          e.preventDefault()
          router.push(target)
        }
      }}
    >
      ファイルを置く
    </Link>
  )
}
