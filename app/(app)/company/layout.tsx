import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppShell } from './_components/AppShell'

// ============================================================================
// /company レイアウト — 番頭(Banto) 会社版のアプリシェルでラップする。
//   ルート app/layout.tsx の body は消費者Memoly向けダーク強制
//   (bg-gray-950 text-gray-100)。会社版(BtoB労務)はライト基調が要件。
//   AppShell が bg-neutral-50 / text-neutral-900 の白サーフェスを敷き、
//   ヘッダ + 左ナビ + モバイル下部タブを共通化する（各ページのヘッダ重複を解消）。
//   消費者ページ(/chat /memory 等)はこのレイアウト外なのでダークのまま温存される。
//
//   .company-light クラスは P0 の暫定再マップ。新システムへ全面移行済みのため
//   依存はしていないが、回帰時の保険として AppShell ルート要素に残す
//   （globals.css 側の定義も保持）。
//
//   AppShell は useSearchParams を使うため Suspense 境界が必要（Next App Router）。
// ============================================================================

export const metadata: Metadata = {
  title: '番頭 — 会社を覚える労務AI',
}

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="company-light">
      <Suspense fallback={<div className="min-h-[100dvh] bg-neutral-50" />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </div>
  )
}
