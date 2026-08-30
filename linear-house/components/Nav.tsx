import Link from 'next/link'
import { BRAND_NAME_JA } from '@/lib/brand'

/** Linear House nav — 64px white, hairline bottom */
export function LinearNav({
  showPricing = true,
}: {
  showPricing?: boolean
} = {}) {
  return (
    <header className="lh-nav sticky top-0 z-30 border-b border-[var(--lh-line)] bg-[var(--lh-canvas)]">
      <div className="lh-shell flex h-[var(--lh-nav-h)] items-center justify-between">
        <Link
          id="page-top"
          href="/zure"
          className="text-[15px] font-semibold tracking-tight text-[var(--lh-ink)]"
        >
          {BRAND_NAME_JA}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--lh-muted)]">
          {showPricing && (
            <Link href="/pricing" className="hover:text-[var(--lh-ink)]">
              料金
            </Link>
          )}
          <Link href="/login?next=/company" className="hover:text-[var(--lh-ink)]">
            ログイン
          </Link>
        </nav>
      </div>
    </header>
  )
}
