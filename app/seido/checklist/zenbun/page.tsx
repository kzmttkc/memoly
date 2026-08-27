import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SEIDO_CHECKLIST, SEIDO_CHECKLIST_ITEM_COUNT, SEIDO_DISCLAIMER } from '@/lib/seido'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido/checklist/zenbun — チェックリスト全文（要ログイン・登録特典の実体）。
//   2026-08-13 新設。未ログインは /signup へ（utm_source=seido&campaign=checklist
//   を保ったまま。登録完了後に next でここへ戻る）。
//   middleware の PROTECTED_PREFIXES には足さず、このページ自身が判定する
//   （/company 系のアプリ画面ではなく公開面の延長のため、保護境界を広げない）。
//   noindex: 特典本体を検索に載せない（ゲートの意味を保つ）。
// ============================================================================

export const metadata: Metadata = {
  title: 'インボイス2026年10月対応チェックリスト 全文｜就業規則AI',
  robots: { index: false, follow: false },
}

export default async function SeidoChecklistZenbunPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signup?next=/seido/checklist/zenbun&utm_source=seido&utm_campaign=checklist')
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/zure" className="hover:text-brand-700">就業規則AI</Link>
        <span className="mx-1.5">/</span>
        <Link href="/seido" className="hover:text-brand-700">制度対応</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">チェックリスト全文</span>
      </nav>

      {/* ===== ヘッダ ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-6">
        <Badge tone="brand" className="mb-5">登録特典</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          インボイス2026年10月対応チェックリスト（全{SEIDO_CHECKLIST_ITEM_COUNT}項目）
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          2026年10月1日の経過措置縮小（80%から70%へ）と2割特例の終了に向けた確認事項の全文です。
          自社に当てはまる区分から確認してください。根拠となる一次資料は
          <Link href="/seido" className="text-brand-700 hover:underline">制度対応シリーズの各記事</Link>
          に参照日つきで載せています。
        </p>
      </section>

      {/* ===== 全文 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <div className="space-y-8">
          {SEIDO_CHECKLIST.map((g) => (
            <Card key={g.heading} padded className="space-y-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-neutral-900">{g.heading}</h2>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">対象: {g.who}</p>
              </div>
              <ul className="space-y-4">
                {g.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 h-4 w-4 flex-none rounded border border-neutral-300"
                    />
                    <div>
                      <p className="text-sm leading-relaxed text-neutral-900">{item.text}</p>
                      {item.note && (
                        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 免責 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <p className="rounded-xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-500">
          {SEIDO_DISCLAIMER}
        </p>
      </section>

      {/* ===== 戻り導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Link
          href="/seido"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          制度対応シリーズの記事一覧へ戻る
        </Link>
      </section>

      <PublicFooter />
    </div>
  )
}
