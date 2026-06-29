'use client'

import { useEffect } from 'react'
import { trackCompanyHeartbeat } from '@/lib/analytics'

// ============================================================================
// CompanyHeartbeat — 番頭(会社版)レイアウトに常駐する計測専用クライアント。
//   /company 配下を開くたびにマウントされ、1日1回だけ company_heartbeat を
//   発火する（実体は trackCompanyHeartbeat 内でデデュープ）。UIは描画しない。
//   記憶moatの cohort 継続率（日齢が進んでも戻るか）の一次データを貯める。
// ============================================================================

export function CompanyHeartbeat() {
  useEffect(() => {
    trackCompanyHeartbeat()
  }, [])
  return null
}
