'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Brain, Building2, MessageSquareText, ArrowRight } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// ============================================================================
// TryDemo — /business 公開LPの「体験デモ」セクション（'use client'）
//
//   目的: 訪問者に「会社の状況を踏まえて答える」アハを安全に体験させる。
//   方式: スクリプト型デモ。本物のAPIは叩かない（コスト/悪用/品質/Phase1リスク
//         回避）。サンプル会社を題材に、用意済みの質問をクリックすると、用意済みの
//         回答がタイプアニメーションで表示される＝体感はインタラクティブ、実体は
//         完全制御。最後に「自社で使うには無料登録」へ誘導（制限を転換フックに）。
//
//   制約: バックエンド/API呼び出しなし（回答は下記定数 QA）。画像・写真・AI生成
//         画像なし（CSS/SVG/lucideのみ）。既存デザインシステム（Card/buttonClass/
//         @themeトークン）で。emoji機能アイコン禁止・markdown強調記号禁止。
//         Phase1: 「社労士監修/AI社労士/法的精度」不使用。回答末尾の一般情報注記は
//         指定文言のまま改変しない。
//
//   a11y: 質問チップは <button>。会話のタイプ領域は aria-live="polite"。装飾は
//         aria-hidden。prefers-reduced-motion 時は即時表示（タイプを行わない）。
// ============================================================================

type QA = { q: string; a: string }

// 用意する質問と回答（このまま使う＝品質/Phase1担保済み・改変しない）。
const QA_LIST: QA[] = [
  {
    q: '来週、残業させても大丈夫？',
    a:
      '自社は36協定が未締結のため、現状のままだと時間外労働をさせること自体が労働基準法に違反するおそれがあります。まずは労働者の過半数代表を選び、36協定を締結して労働基準監督署へ届け出るのが先決です。製造業は上限規制の対象で、原則は月45時間・年360時間。繁忙期の残業が見込まれるなら特別条項付きで設計します。（一般的な情報です。実際の運用は専門家にご確認ください）',
  },
  {
    q: '有給の付与日数を確認したい',
    a:
      '通常の労働者（週5日・フルタイム）は、入社6か月＋出勤率8割以上で10日付与。その後は勤続年数に応じて増え、6年6か月で上限20日です。自社は従業員8名なので、年5日の取得義務（10日以上付与される人が対象）の管理も忘れずに。週の所定日数が少ないパートは比例付与になります。（一般的な情報です）',
  },
  {
    q: '36協定が未締結だと何が問題？',
    a:
      '36協定なしで法定労働時間（1日8時間・週40時間）を超える残業や休日労働をさせると、労働基準法32条・36条に違反するおそれがあり、罰則の対象になりえます。自社は製造業・8名で繁忙期の残業が見込まれるなら、過半数代表の選出→協定締結→労基署への届出を急ぐのが安全です。届出が完了するまでは法定内に収める意識を。（一般的な情報です。最終的な判断は専門家にご確認ください）',
  },
]

// 上部に表示するサンプル会社プロファイル（ProductPreview と同一様式）。
const COMPANY_TAGS = ['製造業', '従業員 8名', '所定 8h / 週40h', '36協定 未締結']

type Turn = { id: number; q: string; a: string }

// prefers-reduced-motion を購読するフック。SSRでは false。
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function TryDemo() {
  const reducedMotion = usePrefersReducedMotion()

  // 会話に積み上がった完了済みターン。
  const [turns, setTurns] = useState<Turn[]>([])
  // 現在タイプ中のターン（回答を1文字ずつ伸ばす）。null＝タイプ中でない。
  const [typing, setTyping] = useState<{ id: number; q: string; full: string } | null>(null)
  const [typedLen, setTypedLen] = useState(0)
  // 一度でも回答が出たか（CTAの文言を体験後トーンに切り替える）。
  const [started, setStarted] = useState(false)

  const nextId = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const isBusy = typing !== null

  // アンマウント時にタイマを片付ける。
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // タイプ進行: typing がセットされている間、1文字ずつ進める。
  useEffect(() => {
    if (!typing) return

    // reduced-motion は即時全文表示してターンを確定する。
    if (reducedMotion) {
      setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
      setTyping(null)
      setTypedLen(0)
      return
    }

    if (typedLen >= typing.full.length) {
      // タイプ完了 → 確定ターンへ移す。
      setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
      setTyping(null)
      setTypedLen(0)
      return
    }

    // 読みやすい速度（句読点でわずかに溜める）。概ね15-25ms/字。
    const ch = typing.full[typedLen]
    const delay = ch === '。' || ch === '、' || ch === '）' ? 90 : 20
    timerRef.current = setTimeout(() => setTypedLen(n => n + 1), delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [typing, typedLen, reducedMotion])

  // 会話末尾へスクロール追従（モーション配慮）。
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [turns, typedLen, typing, reducedMotion])

  const ask = useCallback(
    (qa: QA) => {
      if (isBusy) return // タイプ中は次の質問を受け付けない（順に積み上げる）。
      setStarted(true)
      const id = nextId.current++
      setTypedLen(0)
      setTyping({ id, q: qa.q, full: qa.a })
    },
    [isBusy],
  )

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">
          体験デモ
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          サンプル会社で、答え方の違いを試す
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          下のサンプル会社の前提を踏まえて、番頭がどう答えるかをそのまま体験できます。質問をクリックしてください。
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60">
          {/* ウィンドウバー（ProductPreview と同様式・「記憶あり」インジケータ） */}
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
              <Brain className="h-3 w-3" aria-hidden />
            </span>
            <span className="text-xs font-semibold text-neutral-700">番頭</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              サンプル会社
            </span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
              記憶あり
            </span>
          </div>

          {/* 覚えているサンプル会社プロファイル */}
          <div className="border-b border-neutral-200 px-4 py-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                覚えているサンプル会社プロファイル
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COMPANY_TAGS.map(tag => (
                  <span
                    key={tag}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 tabular-nums"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 会話領域（aria-live で読み上げ更新を通知） */}
          <div
            ref={scrollRef}
            aria-live="polite"
            className="max-h-[26rem] space-y-3 overflow-y-auto px-4 py-4"
          >
            {turns.length === 0 && !typing && (
              <p className="py-6 text-center text-sm text-neutral-400">
                下の質問をクリックすると、ここに番頭の答えが表示されます。
              </p>
            )}

            {/* 確定済みターン */}
            {turns.map(t => (
              <Conversation key={t.id} q={t.q} a={t.a} />
            ))}

            {/* タイプ中のターン（カーソル付き） */}
            {typing && (
              <Conversation
                q={typing.q}
                a={typing.full.slice(0, typedLen)}
                typing
              />
            )}
          </div>

          {/* 質問チップ */}
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              質問を選んで試す
            </p>
            <div className="flex flex-wrap gap-2">
              {QA_LIST.map(qa => (
                <button
                  key={qa.q}
                  type="button"
                  onClick={() => ask(qa)}
                  disabled={isBusy}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 ' +
                    'bg-white px-3 py-1.5 text-[13px] text-neutral-700 shadow-sm ' +
                    'transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 ' +
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  }
                >
                  <MessageSquareText className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {qa.q}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* CTA：制限（サンプル会社）を「自社で試す」への転換フックにする */}
        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-5 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            {started
              ? 'この答え方を、自社の前提でそのまま受け取れます。'
              : 'これはサンプル会社の前提での答え方です。'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            自社の規程を覚えさせれば、自社専用の答えが返ります。
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/signup" className={buttonClass({ variant: 'primary' })}>
              自社の規程を覚えさせて、自社専用で試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          これはサンプル会社での体験デモです。一般的な情報であり、個別の法的助言ではありません。
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Conversation — 1往復（ユーザー質問＝右吹き出し / 番頭回答＝左吹き出し）。
//   typing=true のときは回答末尾に点滅カーソルを添える（装飾＝aria-hidden）。
// ---------------------------------------------------------------------------
function Conversation({ q, a, typing = false }: { q: string; a: string; typing?: boolean }) {
  return (
    <div className="space-y-3">
      {/* ユーザーの質問（右寄せ） */}
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
          {q}
        </p>
      </div>

      {/* 番頭の回答（左寄せ） */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Brain className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
          {a}
          {typing && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-brand-500 align-middle"
            />
          )}
        </div>
      </div>
    </div>
  )
}
