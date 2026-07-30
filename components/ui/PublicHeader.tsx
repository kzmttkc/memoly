import Link from 'next/link'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'

// ============================================================================
// PublicHeader — SEO着地面（無料ツール6本 + 労務記事）の共通ヘッダ。
//
//   2026-07-30 UX監査 #6（重大）: 実測でヘッダ内リンクが
//   ["番頭(Banto)", "ログイン"] の2つしかなく、**検索から着地する42ページ側の
//   ヘッダが最も貧しい**状態だった。未登録の初見客に対して、ヘッダから
//   「料金」にも「登録」にも届かない。
//   → 最低限「料金」と「無料で始める」を常設する（モバイル含む・畳まない）。
//
//   幅の制約（375px / 320px 実測）: 4要素を1行に収めるため、
//     - ロゴの「(Banto)」は sm 未満で畳む（ブランド名「番頭」は残す）
//     - 「ログイン」は sm 未満で畳む（フッタに同じリンクがあり、かつ SEO 着地の
//       初見客は未登録＝ログインより料金/登録の優先度が高い）
//   タップ領域は min-h-11（44px）を確保する（UX監査 #8）。
// ============================================================================

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
        <Link href="/business" className="flex min-h-11 shrink-0 items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
            <BantoMark className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight text-neutral-900">
            番頭<span className="hidden sm:inline">(Banto)</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          {/* 行先は単独の料金ページ /pricing（別班が新設・実測200）。
              万一そのページが消えても next.config.ts の 308 で /business#pricing へ
              自動的に落ちるため、このリンクが 404 になることはない。 */}
          <Link
            href="/pricing"
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-sm text-neutral-600 hover:text-brand-700"
          >
            料金
          </Link>
          <Link
            href="/login?next=/company"
            className="hidden min-h-11 items-center px-1 text-sm text-neutral-500 hover:text-brand-700 sm:inline-flex"
          >
            ログイン
          </Link>
          <Link
            href="/signup?next=/company"
            className={buttonClass({ variant: 'primary', size: 'sm', className: 'whitespace-nowrap' })}
          >
            無料で始める
          </Link>
        </nav>
      </div>
    </header>
  )
}
