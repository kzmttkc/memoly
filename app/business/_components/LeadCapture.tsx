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

// 面ごとの DB 集計キー。/api/company/leads の ALLOWED_SOURCES と一致させること
// （一致しないと 'unknown' に丸められ、経路が分からなくなる）。
const SOURCE_BY_PLACEMENT: Record<LeadCapturePlacement, string> = {
  lp: 'checklist_dl',
  article: 'article_dl',
  tool: 'tool_dl',
}
const PDF_URL = '/downloads/banto-hikitsugi-checklist.pdf'

// ----------------------------------------------------------------------------
// placement — この獲得枠がどの面に置かれているか（2026-07-30 PMF修理#2）。
//   実測: sitemap の51URLのうち索引される42ページ（/roumu 33・/tools 6・/blog 3）に
//   input[type=email] が1個も無く、メール獲得は /business の1か所のみだった
//   （モバイルで y=8,690 / 全長21,278px = 41%地点）。配線は健全（PDFは200・
//   713,648 bytes、anon INSERT ポリシーもある）で、company_leads 0行は
//   壊れているのではなく「置き場所が悪い」状態。読み終わった直後という、
//   いちばん受け取ってもらえる位置に同じ枠を置く。
//
//   面ごとに違うのは見出し・説明・ボタンの文言と余白だけで、送信先・honeypot・
//   PDF・DB source は完全に同一（新しい経路を増やさない＝壊れる箇所を増やさない）。
//
//   DB source は面ごとに分ける（2026-07-30 統括が API 側の許可リストを解禁）。
//   実測: supabase/company_leads.sql:47-48 の CHECK は char_length 1..64 のみで
//   値の許可リストは持たない。制約は app/api/company/leads/route.ts の
//   ALLOWED_SOURCES 側だけにあり、そこへ 'article_dl' / 'tool_dl' を足した。
//   許可リストに無い値は 'unknown' に丸められる仕様なので、足さないまま送ると
//   「どこから来たリードか永久に分からない」になっていた。
//   meta.placement と Plausible の lead_captured{placement} は引き続き併用する
//   （DBが落ちても計測が残る／計測が落ちてもDBが残る、の二重化）。
// ----------------------------------------------------------------------------
export type LeadCapturePlacement = 'lp' | 'article' | 'tool'

const COPY: Record<
  LeadCapturePlacement,
  { heading: string; body: string; submit: string }
> = {
  lp: {
    heading: '労務引き継ぎチェックシート（無料PDF）',
    body:
      '総務・労務の担当が替わるとき、引き継ぎで漏れやすい項目をA4の2ページにまとめた点検用チェックシートです。メールアドレスのご登録だけで、その場でダウンロードできます。',
    submit: '登録してダウンロード',
  },
  article: {
    heading: '読んで終わりにしない。担当が替わる日のためのチェックシート（無料PDF・A4 2ページ）',
    body:
      '引き継ぎで漏れやすい項目を、A4の2ページにまとめた点検用のチェックシートです。いま読んだ内容を自社で確かめるところまで持っていけます。メールアドレスのご登録だけで、その場でダウンロードできます。',
    submit: 'メールアドレスだけで受け取る',
  },
  tool: {
    heading: '点検した内容を、担当が替わっても引き継げる形に（無料PDF・A4 2ページ）',
    body:
      'いまの点検結果を含め、総務・労務の引き継ぎで漏れやすい項目をA4の2ページにまとめた点検用チェックシートです。メールアドレスのご登録だけで、その場でダウンロードできます。',
    submit: 'メールアドレスだけで受け取る',
  },
}

const WRAPPER: Record<LeadCapturePlacement, string> = {
  lp: 'mx-auto max-w-5xl px-6 py-20',
  article: 'mx-auto max-w-3xl px-6 py-12',
  tool: 'mx-auto max-w-3xl pt-8',
}

export default function LeadCapture({
  placement = 'lp',
  /** 記事/ツールのslug等（低カーディナリティの非個人メタ。どの面が効いたかの集計用）。 */
  context,
}: {
  placement?: LeadCapturePlacement
  context?: string
} = {}) {
  const copy = COPY[placement]
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
        body: JSON.stringify({
          email: trimmed,
          source: SOURCE_BY_PLACEMENT[placement],
          website,
          // 獲得経路の内訳（PIIなし・低カーディナリティ）。DB側 source は
          // 許可リストの 'checklist_dl' のままで、面の違いはここで残す。
          meta: context ? { placement, context } : { placement },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setState('error')
        setErrorMsg(data?.error ?? '送信に失敗しました。時間をおいて再度お試しください。')
        return
      }
      track('lead_captured', { source: 'lead_magnet', placement })
      setState('done')
    } catch {
      setState('error')
      setErrorMsg('通信に失敗しました。時間をおいて再度お試しください。')
    }
  }

  return (
    <section className={WRAPPER[placement]}>
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
                onClick={() => track('lead_captured', { source: 'lead_magnet_download', placement })}
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
              <h2
                className={
                  'font-bold tracking-tight text-neutral-900 ' +
                  (placement === 'lp' ? 'text-2xl' : 'text-xl leading-snug')
                }
              >
                {copy.heading}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
                {copy.body}
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
                      onChange={e => {
                        setEmail(e.target.value)
                        if (state === 'error') setState('idle')
                      }}
                      className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
                        {copy.submit}
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
