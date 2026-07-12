'use client'

import { useState } from 'react'
import { Mail, ArrowRight, Check, ClipboardCheck, Loader2 } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'

// ============================================================================
// LeadCapture — /business 公開LPの micro-CV（'use client'）
//
//   目的: 会社作成という重い本登録の手前に「メアドだけ」の軽い一歩を置き、
//         ファネルの漏れを塞ぐ。フックは無料配布（就業規則チェックリスト）。
//         ＝テイカー型の「登録して」ではなく、先に役立つものを渡すギバー型。
//
//   方式: 薄い client コンポーネント。/api/company/leads に POST し、成功で
//         サンクス表示に切り替える。LP本体は server component のまま無傷
//         （TrackedCTA と同じ分離手法）＝SSR/SEO/metadata を壊さない。
//
//   計測: 送信成功で lead_captured(source) を1回発火（Plausible）。PIIは送らない。
//
//   制約: 画像/AI生成画像なし（lucide + CSS のみ）。emoji機能アイコン禁止・
//         markdown強調記号禁止。Phase1: 社労士監修/AI社労士/法的精度は使わない。
//         honeypot(website)でボットを弾く（人間には不可視・サーバ側でドロップ）。
// ============================================================================

const SOURCE = 'checklist_dl'

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
      track('lead_captured', { source: SOURCE })
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
                ご登録を受け付けました
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                ご登録ありがとうございます。就業規則の点検ポイント資料は、完成し次第ご登録のメールアドレスへお届けします。
                お待ちいただく間に、自社の規程を覚える番頭を登録なしでそのままお試しいただけます。
              </p>
              <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700">
                <Check className="h-4 w-4" aria-hidden />
                受け付けました
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                就業規則の見落としやすいポイントをまとめた点検資料（無料）
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                自社の就業規則を見直すとき、どこから確認すればよいかが分かる資料です。メールアドレスのご登録だけで受け取れます。お待ちいただく間も、このページの上のデモで番頭の使い心地を登録なしで試せます。
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
                        完成したら受け取る
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
                  資料は現在準備中です。完成し次第、ご登録のアドレスへお届けします。
                  メールアドレスは資料の送付と、番頭に関するお知らせにのみ利用します。配信はいつでも停止できます。
                </p>
              </form>
            </>
          )}
        </div>
      </Card>
    </section>
  )
}
