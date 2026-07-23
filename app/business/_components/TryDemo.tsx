'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, MessageSquareText, ArrowRight, RefreshCw } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'
import {
  INDUSTRIES,
  DEFAULT_INDUSTRY,
  getIndustry,
  type IndustryKey,
  type DemoQA,
} from '../_lib/industries'

// ============================================================================
// TryDemo — /business 公開LPの「体験デモ」セクション（'use client'）
//
//   目的: 訪問者に「会社の状況を踏まえて答える」アハを安全に体験させる。
//   方式: スクリプト型デモ。本物のAPIは叩かない（コスト/悪用/品質/Phase1リスク
//         回避）。サンプル会社を題材に、用意済みの質問をクリックすると、用意済みの
//         回答がタイプアニメーションで表示される＝体感はインタラクティブ、実体は
//         完全制御。最後に「自社で使うには無料登録」へ誘導（制限を転換フックに）。
//
//   2026-07-23 B13+A14: 業種タブ（製造/飲食/IT/介護）を追加。サンプル会社の
//         プロファイルと質問セットが業種で切り替わる（データSSOT=_lib/industries.ts。
//         製造の3問は従来のQA_LISTを一字一句そのまま移設）。業種を切り替えると
//         会話はリセット（前提の違う回答が混ざらないように）。
//   2026-07-23 B14: 回答が1件でも確定したら、会話直下に「この回答を自社条件で
//         再計算」CTAを出す（signup転換の第2フック。イベントは既存語彙
//         signup_cta_clicked / location='trydemo' に cta prop で分離）。
//
//   制約: バックエンド/API呼び出しなし。画像・写真・AI生成画像なし（CSS/SVG/
//         lucideのみ）。既存デザインシステムで。emoji機能アイコン禁止・markdown
//         強調記号禁止。Phase1: 「社労士監修/AI社労士/法的精度」不使用。
//         回答末尾の一般情報注記は industries.ts の指定文言のまま改変しない。
//
//   計測: 既存イベント語彙（demo_engaged / demo_question_clicked / demo_autoplayed /
//         signup_cta_clicked）は名前を変えない。業種は industry prop（4値）で分離。
//
//   a11y: 質問チップ・業種タブは <button>。会話のタイプ領域は aria-live="polite"。
//         装飾は aria-hidden。prefers-reduced-motion 時は即時表示。
// ============================================================================

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

// 着地URL(/business?utm_source=…)の utm 帰属を signup href へ引き継ぐ。
// TrackedCTA と同思想: 静的生成を壊さないため click 時に window.location から読む。
function signupHrefWithAttribution(): string {
  const base = '/signup?next=/company'
  if (typeof window === 'undefined') return base
  const landing = new URLSearchParams(window.location.search)
  const qs = new URLSearchParams('next=/company')
  for (const key of ['utm_source', 'utm_campaign', 'utm_medium']) {
    const v = landing.get(key)
    if (v) qs.set(key, v.slice(0, 60))
  }
  return `/signup?${qs.toString()}`
}

export default function TryDemo() {
  const router = useRouter()
  const reducedMotion = usePrefersReducedMotion()

  // 業種プリセット（B13+A14）。切替で会話をリセットする。
  const [industryKey, setIndustryKey] = useState<IndustryKey>(DEFAULT_INDUSTRY)
  const industry = getIndustry(industryKey)

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
  const sectionRef = useRef<HTMLElement | null>(null)
  // デモに初めて触れた瞬間(アハ到達の代理)を1回だけ計測するためのフラグ。
  const engagedRef = useRef(false)
  // ビューポート進入での「受動再生」を1回だけ発火するためのフラグ。
  const autoplayedRef = useRef(false)

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

  // 回答の再生（タイプ開始）だけを行う共通ロジック。計測は呼び出し側で分ける。
  const play = useCallback((qa: DemoQA) => {
    setStarted(true)
    const id = nextId.current++
    setTypedLen(0)
    setTyping({ id, q: qa.q, full: qa.a })
  }, [])

  const ask = useCallback(
    (qa: DemoQA, qIndex: number) => {
      if (isBusy) return // タイプ中は次の質問を受け付けない（順に積み上げる）。
      // 手動クリック=能動的アハ。初回タッチを demo_engaged で1回だけ計測。
      // （自動再生はここを通らない＝engagedRef/demo_engaged を汚さない）
      if (!engagedRef.current) {
        engagedRef.current = true
        track('demo_engaged')
      }
      track('demo_question_clicked', {
        q_index: qIndex,
        source: 'demo',
        industry: industryKey,
      })
      play(qa)
    },
    [isBusy, play, industryKey],
  )

  // 業種タブの切替（B13）。前提の違う回答が混ざらないよう会話をリセットする。
  //   計測は既存語彙 demo_question_clicked に source='demo_tab' を載せて分離。
  const switchIndustry = useCallback(
    (next: IndustryKey) => {
      if (next === industryKey) return
      if (timerRef.current) clearTimeout(timerRef.current)
      setIndustryKey(next)
      setTurns([])
      setTyping(null)
      setTypedLen(0)
      track('demo_question_clicked', { source: 'demo_tab', industry: next })
    },
    [industryKey],
  )

  // ビューポート進入で1問目を「受動再生」する（アハ体験の分母を作る）。
  //   計測は autoplay 専用の demo_autoplayed のみ（engagedRef/demo_engaged/
  //   demo_question_clicked は発火しない）。ユーザーが後から質問をクリックすれば
  //   通常どおり demo_engaged が立ち、受動→能動の転換が測れる。
  //   reduced-motion 時も自動再生は行う（既存のタイプ即確定パスに乗り即時全文表示）。
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry || !entry.isIntersecting) return
        if (autoplayedRef.current) return
        autoplayedRef.current = true
        observer.disconnect()
        track('demo_autoplayed')
        play(INDUSTRIES[0].qa[0])
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [play])

  // 回答が1件でも確定していれば再計算CTA（B14）を出す。
  const showRecalc = turns.length > 0

  return (
    <section ref={sectionRef} className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">
          体験デモ
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
          サンプル会社で、答え方の違いを試す
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          業種を選ぶと、その業種のサンプル会社の前提を踏まえて番頭がどう答えるかを体験できます。質問をクリックしてください。
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* 業種タブ（B13+A14） */}
        <div
          role="tablist"
          aria-label="サンプル会社の業種を選ぶ"
          className="mb-3 flex flex-wrap items-center gap-1.5"
        >
          <span className="mr-1 text-xs font-medium text-neutral-400">業種</span>
          {INDUSTRIES.map(i => (
            <button
              key={i.key}
              type="button"
              role="tab"
              aria-selected={i.key === industryKey}
              onClick={() => switchIndustry(i.key)}
              className={
                i.key === industryKey
                  ? 'rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-700'
              }
            >
              {i.label}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60">
          {/* ウィンドウバー（「記憶あり」インジケータ） */}
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3 w-3" aria-hidden />
            </span>
            <span className="text-xs font-semibold text-neutral-700">番頭</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              サンプル会社（{industry.label}）
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
                {industry.tags.map(tag => (
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

            {/* B14: 回答確定後に出す「自社条件で再計算」CTA（会話の流れの中に置く） */}
            {showRecalc && !typing && (
              <div className="flex justify-center pt-1">
                <Link
                  href="/signup?next=/company"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[13px] font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100"
                  onClick={e => {
                    track('signup_cta_clicked', {
                      location: 'trydemo',
                      cta: 'recalc',
                      industry: industryKey,
                    })
                    const target = signupHrefWithAttribution()
                    if (target !== '/signup?next=/company') {
                      e.preventDefault()
                      router.push(target)
                    }
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  この回答を自社条件で再計算する（無料）
                </Link>
              </div>
            )}
          </div>

          {/* 誠実性ラベル: このデモの回答が「用意されたサンプル応答」であることと、
              登録後は自社の記憶に基づく個別回答になることを常時明示する（過大表現の回避）。 */}
          <p className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-2 text-[11px] leading-relaxed text-neutral-500">
            ※これはサンプル応答です。登録後は、自社の記憶（規程・過去の判断など）に基づいた自社専用の回答になります。
          </p>

          {/* 質問チップ */}
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              質問を選んで試す
            </p>
            <div className="flex flex-wrap gap-2">
              {industry.qa.map((qa, i) => (
                <button
                  key={qa.q}
                  type="button"
                  onClick={() => ask(qa, i)}
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
            <Link
              href="/signup?next=/company"
              className={buttonClass({ variant: 'primary' })}
              onClick={(e) => {
                track('signup_cta_clicked', {
                  location: 'trydemo',
                  engaged: started,
                })
                const target = signupHrefWithAttribution()
                if (target !== '/signup?next=/company') {
                  e.preventDefault()
                  router.push(target)
                }
              }}
            >
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
          <BantoMark className="h-3.5 w-3.5" aria-hidden />
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
