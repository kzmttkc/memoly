import Link from 'next/link'
import { Compass, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'

// ============================================================================
// NotFoundState — セグメント not-found.tsx 共通の面（番頭デザインシステム準拠）。
//   サーバーコンポーネントでよい（インタラクション無し）。各 not-found.tsx から
//   backHref/backLabel だけ差し替えて使う。
// ============================================================================

/** よくある行き先（公開側404で出す実リンク）。primary は1本だけにする。 */
export type NotFoundLink = { href: string; label: string; primary?: boolean }

export function NotFoundState({
  title = 'ページが見つかりません',
  description = 'お探しのページは移動または削除された可能性があります。URL をご確認ください。',
  backHref = '/company',
  backLabel = 'ホームへ戻る',
  links,
}: {
  title?: string
  description?: string
  backHref?: string
  backLabel?: string
  /**
   * 2026-07-30 UX監査 #2（重大）: 404 の出口が「トップへ戻る」1本しかなく行き止まり
   *   だった（/pricing /plans /price /ryokin はいずれも404）。渡された場合は
   *   「よくある行き先」を実リンクで並べ、戻るボタンの代わりに出す。
   *   未指定なら従来どおり（アプリ内404の見た目は一切変えない）。
   */
  links?: NotFoundLink[]
}) {
  const hasLinks = !!links?.length
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <Card className="w-full text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
        >
          <Compass className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold tabular-nums text-neutral-400">404</p>
        <h1 className="mt-1 text-lg font-bold text-neutral-900">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">
          {description}
        </p>
        {hasLinks ? (
          <div className="mt-6 flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={buttonClass({
                  variant: l.primary ? 'primary' : 'secondary',
                  className: 'w-full whitespace-normal text-center',
                })}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex justify-center">
            <Link href={backHref} className={buttonClass({ variant: 'secondary' })}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {backLabel}
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
