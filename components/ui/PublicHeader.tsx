import Link from 'next/link'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'

// ============================================================================
// PublicHeader — 公開面（/business を除く全ページ）の共通ヘッダ。
//
//   2026-08-12 UXペルソナ監査 R-1/R-6（離脱級）: 公開面のヘッダが4実装に分裂し、
//   ロゴ表記（「番頭」/「番頭(Banto)」）・高さ（53/61/65px）・導線がページごとに
//   違っていた。とくに /blog は「番頭(Banto)｜ログイン」だけで、検索から
//   記事に着地した未登録の読者に次の一手（料金・登録）がヘッダに存在しなかった。
//   /pricing も独自ヘッダで、同じものが3つ目の形で書かれていた。
//   → /blog・/blog/[slug]・/pricing をこのコンポーネントへ寄せ、実装を1つにする。
//
//   計測（重要・壊さないこと）: /pricing のヘッダCTAだけが
//   TrackedCTA(location="pricing_page_header") で計測されている。共通化にあたり
//   location を prop 化し、/pricing は従来と同じ値を渡す＝計測値は連続する。
//   ctaLocation を渡さない面（/faq /tools /roumu /blog）は従来どおり素の Link で、
//   signup_cta_clicked を新たに発火させない（総数を跳ねさせて過去比較を壊さない）。
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

export function PublicHeader({
  /** 渡すとヘッダCTAを TrackedCTA にして location を計測する（/pricing のみ）。 */
  ctaLocation,
  /** 料金ページ自身では「料金」リンクを出さない（自分自身への導線を置かない）。 */
  showPricingLink = true,
}: {
  ctaLocation?: string
  showPricingLink?: boolean
} = {}) {
  const ctaClass = buttonClass({
    variant: 'primary',
    size: 'sm',
    className: 'whitespace-nowrap',
  })
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
        {/* id="page-top" は BackToTop がクリック後にフォーカスを戻す先（キーボード
            利用者のタブ順をページ先頭へ連れ戻す）。/business は自前ヘッダに同じ id を
            持っており、PublicHeader と同時に描画される面は無い（重複しない）。 */}
        <Link
          id="page-top"
          href="/business"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
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
          {showPricingLink && (
            <Link
              href="/pricing"
              className="inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-sm text-neutral-600 hover:text-brand-700"
            >
              料金
            </Link>
          )}
          <Link
            href="/login?next=/company"
            className="hidden min-h-11 items-center px-1 text-sm text-neutral-600 hover:text-brand-700 sm:inline-flex"
          >
            ログイン
          </Link>
          {ctaLocation ? (
            <TrackedCTA location={ctaLocation} className={ctaClass}>
              無料で始める
            </TrackedCTA>
          ) : (
            <Link href="/signup?next=/company" className={ctaClass}>
              無料で始める
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
