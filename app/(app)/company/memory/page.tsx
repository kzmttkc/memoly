'use client'

import { Suspense } from 'react'
import { CompanyGuard } from '../_components/CompanyGuard'
import { MemoryTimeline } from './_components/MemoryTimeline'

// ============================================================================
// /company/memory — 「会社の記憶」タイムライン + 承認UI
//   番頭(Banto)の最大差別化＝会社の文脈を継続記憶する縦深を、ユーザーに見せる画面。
//   ・タイムライン: いつ・誰(subject)・何を相談し・どう決まったか(decision) を時系列表示。
//     担当者が代わっても会社の記憶が残る価値を可視化する（リテンション/moatの体験）。
//   ・承認UI(adminのみ): AIが拾った自社事実の候補(rule)を、ワンタップで正式な自社ルールへ昇格。
//   読み出しは /api/company/memory GET、承認は /api/company/memory?action=approve。
// ============================================================================

export default function CompanyMemoryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <MemoryTimeline />
      </CompanyGuard>
    </Suspense>
  )
}
