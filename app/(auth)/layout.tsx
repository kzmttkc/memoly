import Link from 'next/link'

// ============================================================================
// 認証ルートグループ共通レイアウト — 番頭(Banto) ライト世界観。
//   ルート app/layout.tsx の <body> は消費者Memoly向けにダーク強制
//   (bg-gray-950 text-gray-100)。認証画面は番頭LP(/business)からの動線上にあり、
//   BtoB労務向けライト基調が要件のため .company-light（globals.css 定義の
//   白背景 + brand 再マップ）を最外要素に当ててダーク body を上書きする。
//   /business・/company と同じ手法でブランドを統一する。
//
//   Phase1 コンプラ厳守: 絵文字アイコンは使わない。AI生成画像は使わない。
//
// 2026-07-26 CTO緊急修正(F-2): 2026-07-25の404バグ修正コミット(9b970a0)は
//   login/signup/forgot-password/reset-password の各 page.tsx（すべて 'use client'）に
//   `export const dynamic = 'force-dynamic'` を足していたが、Next.js のルートセグメント
//   設定はサーバーコンポーネントからのエクスポートでなければ効かず、クライアント
//   コンポーネントファイルからのエクスポートはビルドエラーにもならず黙って無視される。
//   実際 `npm run build` の出力は修正後も /signup /login /forgot-password /reset-password が
//   ○(Static) のまま＝プリレンダされ続けていた（本番実測 x-nextjs-prerender:1 / x-vercel-cache:HIT
//   と一致）。このグループ共通の *サーバーコンポーネント* layout.tsx に dynamic 宣言を移し、
//   ルートセグメント単位で確実に動的レンダリングへ切り替える。
// ============================================================================
export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="company-light min-h-screen bg-neutral-50">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link
              href="/business"
              className="inline-flex items-baseline gap-1.5 text-2xl font-bold tracking-tight text-neutral-900"
              aria-label="番頭 Banto トップへ"
            >
              <span className="text-brand-600">番頭</span>
              <span className="text-sm font-semibold tracking-wide text-neutral-500">
                Banto
              </span>
            </Link>
            <p className="mt-2 text-xs text-neutral-500">会社を覚える労務AI</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
