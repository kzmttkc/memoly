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
// ============================================================================

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
