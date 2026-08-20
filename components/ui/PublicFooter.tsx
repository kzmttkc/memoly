import Link from 'next/link'
import { BantoMark } from '@/components/ui/BantoMark'
import { TrackedCTA } from '@/app/business/_components/TrackedCTA'
import { UitruthCrossCta } from '@/components/ui/UitruthCrossCta'

// ============================================================================
// PublicFooter — 公開面（未ログインで到達しうる全ページ）の唯一のフッタ実装。
//
//   2026-08-12 UXペルソナ監査 R-1（離脱級）: 同じフッタが8ファイルにコピペで
//   複製され、リンクセットが6面すべて異なっていた。実測の症状は3つ:
//     1. どの面にも /security（RLS・委託先・プロンプトインジェクション方針まで
//        書かれた最も説得力のあるページ）へのリンクが 0 本だった。
//        日本語の検討導線から到達不能で、英語版LPにだけリンクがあった。
//     2. /tokushoho は /pricing と /business にしか無く、他4面から辿れなかった。
//     3. 44px 化（2026-08-11 修正4）が ToolPageShell.tsx だけに入り、
//        /faq・/tools・/roumu・/blog・/pricing のフッタは 20px のまま残った。
//   いずれも「1箇所直して同じ種類が残る」という同一の原因で、規律ではなく
//   実装をひとつにすることでしか止まらない。以後、フッタの変更はこのファイルだけ。
//
//   計測（重要）: /business のフッタだけが TrackedCTA(location="footer") を
//   持っている。ここを一律に付けると signup_cta_clicked の総数が跳ねて過去との
//   比較ができなくなるため、**CTAは ctaLocation を渡した面にだけ出す**。
//   現在渡しているのは /business の "footer" のみ＝計測値は完全に連続する。
// ============================================================================

/** サービス側の導線（読者が「次に何を見るか」） */
const SERVICE_LINKS: { href: string; label: string }[] = [
  { href: '/business', label: 'サービス概要' },
  { href: '/pricing', label: '料金' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/roumu', label: '使い方一覧' },
  { href: '/tools', label: '無料ツール' },
  { href: '/seido', label: '制度対応' },
  { href: '/blog', label: 'ブログ' },
  { href: '/contact', label: 'お問い合わせ' },
  { href: '/login?next=/company', label: 'ログイン' },
]

/** 事業者・規約側の導線（読者が「預けて大丈夫か」を確かめる） */
const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: '/security', label: 'セキュリティとデータ保護' },
  { href: '/tokushoho', label: '特定商取引法に基づく表記' },
  { href: '/terms', label: '利用規約' },
  { href: '/privacy', label: 'プライバシー' },
]

// 2026-08-11 修正4 / 2026-08-12 R-8: モバイルのタップ目標は 44px（min-h-11）。
// sm 以上は従来の見た目のまま（sm:min-h-0）。ToolPageShell の既存実装を移植元にした。
const LINK_CLASS =
  'inline-flex min-h-11 items-center hover:text-brand-700 sm:min-h-0'

export function PublicFooter({ ctaLocation }: { ctaLocation?: string }) {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* 2026-08-20 常設クロス送客枠（同じ運営のUITruthへ）。utm_source=banto で効果測定。
            表示計測(uitruth_cta_view)に useEffect が要るため、この枠だけを
            クライアント境界へ切り出している（フッタ本体はサーバーコンポーネントのまま）。
            クリックは Plausible の Outbound Link 自動計測に乗る＝明示イベントは持たない。 */}
        <UitruthCrossCta />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/business" className="flex min-h-11 shrink-0 items-center gap-2 sm:min-h-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-semibold text-neutral-900">番頭(Banto)</span>
          </Link>

          <nav aria-label="フッタ" className="flex flex-col gap-2 text-sm text-neutral-600 sm:items-end">
            <div className="flex flex-wrap items-center gap-x-5 sm:justify-end">
              {SERVICE_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={LINK_CLASS}>
                  {l.label}
                </Link>
              ))}
              {ctaLocation && (
                <TrackedCTA location={ctaLocation} className={LINK_CLASS}>
                  無料で始める
                </TrackedCTA>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 text-neutral-500 sm:justify-end">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={LINK_CLASS}>
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-neutral-600">
          番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
          最終的な判断は、必要に応じて専門家にご確認ください。
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          © {new Date().getFullYear()} 番頭(Banto)（KIZUNA Creation）
        </p>
      </div>
    </footer>
  )
}
