import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buildToolJsonLd, type ToolJsonLdDef } from './meta'
import { TOOL_LIST } from '@/lib/tools'

// ============================================================================
// 無料セルフ点検ツール 共通シャーシ（ページ骨格部・Server Component）
//   実在2ツールの page.tsx で文字どおり同一だった骨格を抽出:
//     JSON-LD 3点 → ヘッダ → パンくず → ヒーロー → 計算ツール（children）
//     → 制度の説明（静的・クローラブル） → FAQ → 関連記事への相互リンク枠
//     → 免責つきフッタ
//   新ツールはコンテンツ差分（h1/リード/説明段落/FAQ/関連記事）だけ渡す。
//
//   /roumu/[slug] と同じライト基調（.company-light + 白背景）。
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言をしない。
// ============================================================================

export type ToolRelatedArticle = {
  /** /roumu/{slug} への内部リンク（記事⇄ツール相互リンクのツール→記事側） */
  href: string
  title: string
  description: string
}

export type ToolPageShellProps = {
  /** JSON-LD（FAQPage/BreadcrumbList/SoftwareApplication）の素材 */
  jsonLd: ToolJsonLdDef
  /** ヒーローのH1（SoftwareApplication.name と一致させる） */
  h1: string
  /** H1直下のリード文 */
  lead: string
  /** 制度の説明セクション（見出し＋段落。静的・クローラブル） */
  explain: { title: string; paragraphs: string[] }
  /** FAQ（JSON-LDと共用＝可視一致） */
  faqs: ToolFaqList
  /** 関連記事への内部リンク（内容が対応する記事にだけ張る） */
  related: ToolRelatedArticle
  /** 一次情報の出典と確認日（計算を伴うツールでは明記必須・任意） */
  sources?: { checkedOn: string; items: { label: string; href: string }[] }
  /** 計算ツール（クライアントコンポーネント）を差し込む */
  children: React.ReactNode
}

type ToolFaqList = { q: string; a: string }[]

export function ToolPageShell({ jsonLd, h1, lead, explain, faqs, related, sources, children }: ToolPageShellProps) {
  const jsonLdBlocks = buildToolJsonLd(jsonLd)

  // ほかの無料ツールへの相互リンク（クロール経路の確立）。
  //   現在のツール(jsonLd.slug)を除いた兄弟ツールを SSOT(lib/tools.ts)から引く。
  //   各ツールが一覧＋兄弟へ双方向にリンクし、クロールの行き止まりをなくす。
  const siblings = TOOL_LIST.filter((t) => t.slug !== jsonLd.slug)

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight text-neutral-900">番頭(Banto)</span>
          </Link>
          <Link href="/login?next=/company" className="text-sm text-neutral-500 hover:text-brand-700">
            ログイン
          </Link>
        </div>
      </header>

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-400">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">無料ツール</span>
      </nav>

      {/* ===== ヒーロー ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-8">
        <Badge tone="brand" className="mb-5">無料セルフ点検ツール</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          {h1}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          {lead}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 登録不要ですぐ使える
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> 会社のデータは保存しない
          </span>
        </div>
      </section>

      {/* ===== 計算ツール（クライアント） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        {children}
      </section>

      {/* ===== 制度の説明（静的・クローラブル） ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{explain.title}</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600">
          {explain.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        {/* ===== 一次情報の出典（確認日つき・計算系ツールで明記） ===== */}
        {sources && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-3.5">
            <p className="text-xs font-medium text-neutral-700">
              このツールの計算・判定方法の根拠（{sources.checkedOn} 確認）
            </p>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-neutral-500">
              {sources.items.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-neutral-300 underline-offset-2 hover:text-brand-700"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ===== FAQ ===== */}
      <section className="mx-auto max-w-3xl px-6 py-12 border-t border-neutral-200">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">よくある質問</h2>
        <div className="mt-5 space-y-4">
          {faqs.map((f) => (
            <Card key={f.q} padded>
              <h3 className="text-sm font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 関連記事への内部リンク ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-12">
        <Card interactive padded={false}>
          <Link href={related.href} className="block p-5 sm:p-6">
            <p className="text-xs font-medium text-brand-700">関連記事</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {related.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              {related.description}
            </p>
          </Link>
        </Card>
      </section>

      {/* ===== ほかの無料ツール（ツール相互リンク＋一覧ハブへの戻り） ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-400">ほかの無料ツール</p>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            ツール一覧を見る
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== フッタ ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/business" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <BantoMark className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/business" className="hover:text-brand-700">サービス概要</Link>
              <Link href="/login?next=/company" className="hover:text-brand-700">ログイン</Link>
              <Link href="/terms" className="hover:text-brand-700">利用規約</Link>
              <Link href="/privacy" className="hover:text-brand-700">プライバシー</Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">運営：Kizuna Creation</p>
        </div>
      </footer>
    </div>
  )
}
