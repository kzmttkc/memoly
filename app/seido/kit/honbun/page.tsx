import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  SEIDO_KIT_NAME,
  KIT_LETTERS,
  KIT_LETTER_NOTICES,
  KIT_CHECKLIST,
  KIT_CHECKLIST_ITEM_COUNT,
  KIT_DISCLAIMER,
} from '@/lib/seido-kit'
import { getCurrentUser } from '@/lib/company'
import { hasSeidoKit } from '@/lib/seido-kit-server'
import { BuyButton } from '../_components/BuyButton'
import { RestoreButton } from '../_components/RestoreButton'
import { CopyButton } from '../_components/CopyButton'
import { Calculator } from '../_components/Calculator'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /seido/kit/honbun — キット本文（要ログイン＋購入権・動的・noindex）
//   構成: ①文面セット5通（コピー可・使用上の注意を固定描画）
//         ②影響額計算ツール ③チェックリスト完全版39項目 ④免責
//   未ログイン → login へ。未購入 → 購入CTA＋復元ボタンのビュー。
// ============================================================================

export const metadata: Metadata = {
  title: `${SEIDO_KIT_NAME} 本文｜番頭(Banto)`,
  robots: { index: false, follow: false },
}

export default async function SeidoKitHonbunPage() {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent('/seido/kit/honbun')}`)

  const owned = hasSeidoKit(user)

  if (!owned) {
    return (
      <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
        <PublicHeader />
        <section className="mx-auto max-w-3xl px-6 py-16">
          <Card className="bg-brand-600 text-center">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              このページはキット購入者専用です
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
              {SEIDO_KIT_NAME}（再交渉文面5通・影響額計算ツール・{KIT_CHECKLIST_ITEM_COUNT}項目チェックリスト）は、購入するとこのページですべて利用できます。
            </p>
            <div className="mt-6 flex justify-center">
              <BuyButton location="honbun_gate" label="購入ページを見る" />
            </div>
          </Card>
          <div className="mt-6 flex flex-col items-center gap-3">
            <RestoreButton />
            <Link href="/seido/kit" className="text-sm text-neutral-500 hover:underline">
              キットの内容を確認する（販売ページ）
            </Link>
          </div>
        </section>
        <PublicFooter />
      </div>
    )
  }

  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      <PublicHeader />

      {/* ===== パンくず ===== */}
      <nav aria-label="パンくず" className="mx-auto max-w-3xl px-6 pt-5 text-xs text-neutral-500">
        <Link href="/business" className="hover:text-brand-700">番頭</Link>
        <span className="mx-1.5">/</span>
        <Link href="/seido" className="hover:text-brand-700">制度対応</Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-600">完全キット本文</span>
      </nav>

      {/* ===== ヘッダ ===== */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-6">
        <Badge tone="brand" className="mb-5">購入者専用</Badge>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
          {SEIDO_KIT_NAME}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          ご購入ありがとうございます。このページに、文面セット5通・影響額計算ツール・
          チェックリスト完全版（全{KIT_CHECKLIST_ITEM_COUNT}項目）のすべてがあります。
          このページはいつでも開き直せます（ログインすれば再表示されます）。
        </p>
      </section>

      {/* ===== 1. 文面セット ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-4">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">1. 再交渉文面セット（5通）</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          【】の部分を自社の状況に書き換えてお使いください。制度の数字（70%・期間など）は書き換えないでください。
          各文面の下にある使用上の注意を必ずお読みください。
        </p>
        <div className="mt-4 space-y-6">
          {KIT_LETTERS.map((l) => (
            <Card key={l.id} padded className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-brand-700">{l.side}</p>
                  <p className="mt-0.5 text-sm font-semibold text-neutral-900">{l.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{l.usage}</p>
                </div>
                <CopyButton text={`件名: ${l.subject}\n\n${l.body}`} label={l.title} />
              </div>
              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs font-medium text-neutral-500">件名: {l.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-700">{l.body}</pre>
              </div>
            </Card>
          ))}
        </div>

        {/* 使用上の注意（削除不可の同梱物） */}
        <div className="mt-6 space-y-4">
          {KIT_LETTER_NOTICES.map((n) => (
            <div key={n.heading} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">{n.heading}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-amber-900">
                {n.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 2. 計算ツール ===== */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">2. 影響額計算ツール</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          免税事業者等からの年間仕入額（税込）を入力すると、経過措置の各段階での控除額と負担増を表示します。
          入力値はこの画面の中だけで使われ、どこにも送信・保存されません。
        </p>
        <div className="mt-4">
          <Calculator />
        </div>
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
          この計算は一般的な制度の割合を当てはめた概算です。実際の申告額の計算・判断は税理士または所轄の税務署にご確認ください。
        </p>
      </section>

      {/* ===== 3. チェックリスト完全版 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-8">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          3. 実務チェックリスト完全版（全{KIT_CHECKLIST_ITEM_COUNT}項目）
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          自社に当てはまる区分から確認してください。手順は一般的な段取りで、個別の判断が必要な箇所は専門家への相談先を書いています。
        </p>
        <div className="mt-4 space-y-8">
          {KIT_CHECKLIST.map((g) => (
            <Card key={g.heading} padded className="space-y-4">
              <div>
                <h3 className="text-base font-bold tracking-tight text-neutral-900">{g.heading}</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">対象: {g.who}</p>
              </div>
              <ul className="space-y-5">
                {g.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 h-4 w-4 flex-none rounded border border-neutral-300" />
                    <div>
                      <p className="text-sm leading-relaxed text-neutral-900">{item.text}</p>
                      {item.note && (
                        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.note}</p>
                      )}
                      {item.steps && (
                        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-600">
                          {item.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
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
          {KIT_DISCLAIMER}
        </p>
      </section>

      {/* ===== 戻り導線 ===== */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Link
          href="/seido"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          制度対応シリーズの記事一覧へ
        </Link>
      </section>

      <PublicFooter />
    </div>
  )
}
