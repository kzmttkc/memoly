import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { buildToolJsonLd, type ToolJsonLdDef } from './meta'
import { TOOL_LIST } from '@/lib/tools'
import { PublicFooter } from '@/components/ui/PublicFooter'

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
  // 2026-08-12 UXペルソナ監査 R-14（イライラ級）: 検索から着地した現場担当が
  //   本当に知りたいこと（例:「バイトも対象なのか」）の答えが、入力フォームと
  //   メール獲得フォームを越えた「制度の説明」節の中にしか無かった。数字を
  //   持っていない来訪者はフォームで詰まり、答えに辿り着く前に離脱する。
  //   フォームより上に結論だけを先出しする枠。**文言は explain の段落から採り、
  //   新しい主張を書き足さない**（同じ事実を2箇所に別の言い方で置かない）。
  /** フォームより上に出す「まず結論」。設問と答えは explain の記述と一致させる。 */
  quickAnswer?: { question: string; answer: string }
  /** 計算ツール（クライアントコンポーネント）を差し込む */
  children: React.ReactNode
}

type ToolFaqList = { q: string; a: string }[]

export function ToolPageShell({ jsonLd, h1, lead, explain, faqs, related, sources, quickAnswer, children }: ToolPageShellProps) {
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

      {/* ===== ヘッダ（2026-07-30 UX監査 #6: 料金・無料登録を常設した共通ヘッダへ） ===== */}
      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        {/* 2026-08-12 UXペルソナ監査 R-17: 「無料ツール」がただの span で、ツールページ
            から一覧へ戻るには最下部まで下るしかなかった（他のツールを試したい人が
            4,102px を下る）。パンくずの慣習どおりリンクにする。 */}
        <Link href="/tools" className="text-neutral-600 hover:text-brand-700">無料ツール</Link>
      </nav>

      {/* ===== ヒーロー ＋ 計算ツール =====
          2026-07-30 UX監査 #7（中）: 320x568・375x667 のフォールドに入力欄が1つも
          入っていなかった（実測: /tools/zangyodai-check の最初の入力欄が y=810〜971
          ＝1.2〜1.7画面ぶんの解説が先）。「登録不要ですぐ使える」と言いながら、
          小さい画面では最初の1画面が全部読み物になっていた。
          モバイルだけ order で「H1 → 入力 → リード/バッジ」に入れ替える。
          解説は消さず入力欄の下にそのまま残す（DOM順は従来どおり＝SEOの本文順は不変）。
          sm(640px)以上は従来の見た目のまま。 */}
      <div className="mx-auto flex max-w-3xl flex-col px-6 pt-8 pb-4">
        <div className="order-1">
          <Badge tone="brand" className="mb-5">無料セルフ点検ツール</Badge>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
            {h1}
          </h1>
          {/* 2026-08-12 UXペルソナ監査 R-14: 数字を持たずに来た人が、入力を求められる
              前に自分の疑問の答えを受け取れるようにする（詳細は下の解説節に据え置き）。 */}
          {quickAnswer && (
            <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3.5">
              <p className="text-sm font-semibold text-neutral-900">{quickAnswer.question}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">{quickAnswer.answer}</p>
            </div>
          )}
        </div>

        <div className="order-3 mt-8 sm:order-2 sm:mt-4">
          <p className="text-base leading-relaxed text-neutral-600">
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
        </div>

        {/* 計算ツール（クライアント） */}
        <div className="order-2 mt-5 sm:order-3 sm:mt-8">
          {children}
        </div>
      </div>

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
                    // 2026-07-30 UX監査 #8: 高さ36pxで推奨44px未満だった（モバイルのみ是正）。
                    className="inline-flex min-h-11 items-center underline decoration-neutral-300 underline-offset-2 hover:text-brand-700 sm:min-h-0"
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
              {/* 2026-08-11 UI監査: 質問見出しは /pricing /roumu のFAQと同じ text-base に統一。 */}
              <h3 className="text-base font-semibold text-neutral-900">{f.q}</h3>
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
          <p className="text-xs font-medium text-neutral-500">ほかの無料ツール</p>
          <Link
            href="/tools"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 sm:min-h-0"
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
              // 2026-07-30 UX監査 #8: 高さ30〜34pxで推奨44px未満だった。
              //   モバイルだけ 44px に上げる（sm以上は従来の見た目のまま）。
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-500 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-600 hover:text-neutral-900 sm:min-h-0 sm:py-2"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
