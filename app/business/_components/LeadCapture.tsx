'use client'

import { useState } from 'react'
import { Mail, ArrowRight, Check, ClipboardCheck, Download, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// LeadCapture — /business 公開LPの micro-CV（'use client'）
//
//   目的: 会社作成という重い本登録の手前に「メアドだけ」の軽い一歩を置き、
//         ファネルの漏れを塞ぐ。フックは無料配布（労務引き継ぎチェックシート
//         PDF・2026-07-23 B06で配布物が完成し再掲載。/downloads/ で本番配信中）。
//         ＝テイカー型の「登録して」ではなく、先に役立つものを渡すギバー型。
//         登録成功のその場でダウンロードできる（「準備中」の不確実要素なし）。
//
//   方式: 薄い client コンポーネント。/api/company/leads に POST し、成功で
//         サンクス表示に切り替える。LP本体は server component のまま無傷
//         （TrackedCTA と同じ分離手法）＝SSR/SEO/metadata を壊さない。
//
//   計測: 既存語彙のみ使用（新イベント名は増やさない）。
//     - 送信成功: lead_captured { source: 'lead_magnet' }
//     - DLクリック: lead_captured { source: 'lead_magnet_download' }
//     PIIは送らない。DB側 source は許可リスト内の 'checklist_dl' を維持。
//
//   制約: 画像/AI生成画像なし（lucide + CSS のみ）。emoji機能アイコン禁止・
//         markdown強調記号禁止。Phase1: 社労士監修/AI社労士/法的精度は使わない。
//         honeypot(website)でボットを弾く（人間には不可視・サーバ側でドロップ）。
// ============================================================================

const SOURCE = 'checklist_dl' // /api/company/leads の許可リスト内の値（DB集計キー）
const PDF_URL = '/downloads/banto-hikitsugi-checklist.pdf'

export default function LeadCapture() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot（人間は触らない）
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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
        body: JSON.stringify({ email: trimmed, source: SOURCE, website }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setState('error')
        setErrorMsg(data?.error ?? '送信に失敗しました。時間をおいて再度お試しください。')
        return
      }
      track('lead_captured', { source: 'lead_magnet' })
      setState('done')
    } catch {
      setState('error')
      setErrorMsg('通信に失敗しました。時間をおいて再度お試しください。')
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <Card className="mx-auto max-w-2xl border-brand-200 ring-1 ring-brand-100">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>

          {state === 'done' ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                ありがとうございます
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                下のボタンから、労務引き継ぎチェックシート（PDF・A4で2ページ）をすぐにダウンロードできます。
              </p>
              <a
                href={PDF_URL}
                target="_blank"
                rel="noopener"
                onClick={() => track('lead_captured', { source: 'lead_magnet_download' })}
                className={buttonClass({ variant: 'primary', className: 'mt-6' })}
              >
                <Download className="h-4 w-4" aria-hidden />
                チェックシートをダウンロード
              </a>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
                <Check className="h-4 w-4" aria-hidden />
                ご登録を受け付けました
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                労務引き継ぎチェックシート（無料PDF）
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                総務・労務の担当が替わるとき、引き継ぎで漏れやすい項目をA4の2ページにまとめた点検用チェックシートです。メールアドレスのご登録だけで、その場でダウンロードできます。
              </p>

              <form onSubmit={onSubmit} className="mt-7 w-full max-w-md">
                {/* honeypot: 視覚・支援技術の双方から隠す。ボットだけが埋める。 */}
                <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
                  <label htmlFor="lc-website">Website</label>
                  <input
                    id="lc-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
                      onChange={e => {
                        setEmail(e.target.value)
                        if (state === 'error') setState('idle')
                      }}
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className={buttonClass({ variant: 'primary', className: 'shrink-0 disabled:opacity-60' })}
                  >
                    {state === 'sending' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        送信中
                      </>
                    ) : (
                      <>
                        登録してダウンロード
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
                  メールアドレスは資料のご案内と、番頭に関するお知らせにのみ利用します。配信はいつでも停止できます。
                </p>
              </form>
            </>
          )}
        </div>
      </Card>
    </section>
  )
}
