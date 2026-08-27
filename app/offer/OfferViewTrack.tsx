'use client'

import { useEffect } from 'react'
import { trackOncePerVisit } from '@/lib/analytics'

/** /offer 到達を1訪問1回だけ計測する。 */
export function OfferViewTrack() {
  useEffect(() => {
    trackOncePerVisit('offer_view')
  }, [])
  return null
}
