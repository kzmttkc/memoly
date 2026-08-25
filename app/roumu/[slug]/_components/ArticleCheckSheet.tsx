'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ClipboardCheck, Loader2, Mail, Printer } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { track, trackOncePerVisit } from '@/lib/analytics'
import { CHECKSHEET_SOURCE, type CheckSheetItem } from '@/lib/article-checksheet'

// ============================================================================
// ArticleCheckSheet — /roumu/[slug] の段2枠（名前を取る）
//
//   なぜここに置くか（gtm-doctrine.md §2・2026-08-25）:
//     「流入 → **名前** → 関係 → 販売」のうち段2が存在しなかった。
//     実測: 記事は読まれている（Plausible 30日・banto-roumu.com で 417 visitors、
//     GSC 28日で imp 1,879 / clk 107）のに、メール獲得は **90日で0件**
//     （lead_captured events=0）。登録画面に着いたのは30日で6人だけ。
//
//     読み終わった人がいちばん渡してくれる相手なので、本文とFAQの直後
//     （＝読み終わりの位置）に置く。冒頭には置かない。
//
//   対価（正典 §2「その場で完結する実用物」）:
//     この記事の論点を点検項目にして、**画面上で完結**させる。項目も確認材料も
//     記事が自分で書いている文をそのまま使う（lib/article-checksheet.ts）。
//     メールアドレスと引き換えに渡すのは「まだ確認していない項目と、その確認材料を
//     まとめた印刷用の1枚」で、送信の成功と同時にその場に出る。**後で送る約束をしない**
//     （「お役立ち情報をお送りします」型は正典で禁止）。
//
//   取るのはメールアドレス1つだけ。会社名・電話・役職を同時に聞かない（正典 §2）。
//
//   計測（既存語彙を使い、新語彙は最小限）:
//     - checksheet_started { slug }  … 最初のチェックで1訪問1回だけ
//     - lead_captured { source: 'article_checksheet', slug } … 送信成功
//     PIIは送らない。メールアドレスは Plausible に一切載せない。
//
//   Phase1 厳守: 社労士監修/AI社労士/法的精度は使わない。断定的な個別助言をしない。
//   新しいキャッチコピーを作らない（見出し・説明はすべて事実文）。
// ============================================================================

/** 取得目的の明示。/business の LeadCapture と同一文（新しい文言を増やさない）。 */
const PURPOSE_NOTE =
  'メールアドレスは資料のご案内と、番頭に関するお知らせにのみ利用します。配信はいつでも停止できます。'

export default function ArticleCheckSheet({
  slug,
  heading,
  items,
}: {
  slug: string
  /** 記事の見出し。1枚の表題に使う（記事名をこちらで作り直さない）。 */
  heading: string
  items: CheckSheetItem[]
}) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot（人間は触らない）
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const unchecked = useMemo(
    () => items.filter((_, i) => !checked[i]),
    [items, checked],
  )
  const touched = checked.some(Boolean)

  // 1枚を出したあいだは、ブラウザの印刷でこの1枚だけが刷られるようにする
  // （記事全文が一緒に出てくると「1枚」ではなくなる）。CSS は app/globals.css。
  useEffect(() => {
    if (state !== 'done') return
    document.body.classList.add('banto-sheet-only')
    return () => document.body.classList.remove('banto-sheet-only')
  }, [state])

  function toggle(i: number) {
    // 最初の1回だけ「点検を始めた」を計測する。押すたびには数えない。
    trackOncePerVisit('checksheet_started', { slug }, `checksheet_started:${slug}`)
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState('error')
      setErrorMsg('メールアドレスの形式をご確認ください。')
      return
    }
    setState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/company/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source: CHECKSHEET_SOURCE,
          website,
          // どの記事・どの対価で取れたリードかを必ず残す（PIIなし・低カーディナリティ）。
          meta: { placement: 'article', slug, unchecked: String(unchecked.length) },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setState('error')
        setErrorMsg(data?.error ?? '送信に失敗しました。時間をおいて再度お試しください。')
        return
      }
      track('lead_captured', { source: CHECKSHEET_SOURCE, slug })
      setState('done')
    } catch {
      setState('error')
      setErrorMsg('通信に失敗しました。時間をおいて再度お試しください。')
    }
  }

  // --- 送信後: 印刷用の1枚（その場で完結する実用物） ---
  if (state === 'done') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card padded className="banto-checksheet border-brand-200 ring-1 ring-brand-100">
          <h2 className="text-xl font-bold tracking-tight text-neutral-900">
            {heading}｜確認シート
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            まだ確認していない項目 {unchecked.length} 件 / 全 {items.length} 件
          </p>

          {unchecked.length === 0 ? (
            <p className="mt-6 text-base leading-relaxed text-neutral-700">
              この記事の論点は、すべて確認済みとしてチェックされています。
            </p>
          ) : (
            <ol className="mt-6 space-y-5">
              {unchecked.map((item) => (
                <li key={item.topic} className="border-t border-neutral-200 pt-4">
                  <p className="text-base font-semibold leading-snug text-neutral-900">
                    {item.topic}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">{item.detail}</p>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
            この1枚は、記事「{heading}」に書かれている内容をまとめたものです。一般的な情報であり、
            自社の対応が十分かどうかの判断は専門家にご確認ください。出典: banto-roumu.com/roumu/{slug}
          </p>

          <div className="banto-sheet-controls mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className={buttonClass({ variant: 'primary' })}
            >
              <Printer className="h-4 w-4" aria-hidden />
              印刷・PDFで保存
            </button>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-700">
              <Check className="h-4 w-4" aria-hidden />
              ご登録を受け付けました
            </span>
          </div>
        </Card>
      </section>
    )
  }

  // --- 点検（登録不要・ここまでは全部無料で完結する） ---
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <Card padded className="border-brand-200 ring-1 ring-brand-100">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <ClipboardCheck className="h-5 w-5" aria-hidden />
        </span>

        <h2 className="text-xl font-bold leading-snug tracking-tight text-neutral-900">
          この記事の論点で、自社の状況を確認する
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          この記事が扱っている論点を、そのまま点検項目にしました。すでに確認できているものに
          チェックを入れてください。登録もダウンロードも不要です。
        </p>

        <ul className="mt-6 space-y-3">
          {items.map((item, i) => (
            <li key={item.topic}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 transition-colors hover:border-neutral-400">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-5 w-5 flex-none rounded border-neutral-500 text-brand-600 focus:ring-2 focus:ring-brand-200"
                />
                <span className="text-sm leading-relaxed text-neutral-800">{item.topic}</span>
              </label>
            </li>
          ))}
        </ul>

        <p
          aria-live="polite"
          className="mt-5 border-t border-neutral-200 pt-4 text-sm font-semibold text-neutral-900"
        >
          まだ確認していない項目: {unchecked.length} 件 / 全 {items.length} 件
        </p>

        {/* --- 段2: ここで初めてメールアドレスを聞く（点検の結果を見たあと） --- */}
        <div className="mt-6 rounded-lg bg-neutral-50 p-5">
          <h3 className="text-base font-semibold leading-snug text-neutral-900">
            まだ確認していない{unchecked.length}件を、印刷用の1枚にする
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            まだ確認していない項目と、それぞれについてこの記事が書いている内容を、
            この画面にそのまま1枚で表示します。印刷とPDF保存ができます。
            {touched ? '' : '（先にチェックを入れると、確認済みの項目は1枚から外れます）'}
          </p>

          <form onSubmit={onSubmit} className="mt-5">
            {/* honeypot: 視覚・支援技術の双方から隠す。ボットだけが埋める。 */}
            <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
              <label htmlFor={`cs-website-${slug}`}>Website</label>
              <input
                id={`cs-website-${slug}`}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                  aria-hidden
                />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  aria-label="メールアドレス"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (state === 'error') setState('idle')
                  }}
                  className="w-full rounded-lg border border-neutral-500 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <button
                type="submit"
                disabled={state === 'sending'}
                className={buttonClass({
                  variant: 'primary',
                  className: 'shrink-0 disabled:opacity-60',
                })}
              >
                {state === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    送信中
                  </>
                ) : (
                  <>
                    1枚を表示する
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            </div>

            {state === 'error' && (
              <p role="alert" className="mt-3 text-sm text-danger-600">
                {errorMsg}
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              {PURPOSE_NOTE}{' '}
              <Link href="/privacy" className="underline hover:text-neutral-700">
                プライバシーポリシー
              </Link>
            </p>
          </form>
        </div>
      </Card>
    </section>
  )
}
