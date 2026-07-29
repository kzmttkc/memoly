'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, MessageSquareText, ArrowRight, RefreshCw } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { trackV as track } from '../_lib/variant'
import {
  INDUSTRIES,
  getIndustry,
  type IndustryKey,
  type DemoQA,
} from '../_lib/industries'
import { useSharedIndustry, setSharedIndustry } from '../_lib/industry-selection'

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

// 2026-07-29 CTO修正（UX監査Round4#5・重大）: 文字ごとの累積表示タイミング(ms)を
//   再生開始前に一括計算する。従来は setTimeout を1文字ごとに直列で積み上げる方式
//   （前の1文字の完了→次のsetTimeoutを積む、を217回繰り返す）で、理論値こそ
//   20ms/字・句読点90msだったが、1回でもレンダーやタイマーの発火が想定より遅れると
//   その遅延がそのまま後続にすべて積算される構造だった。実機（複数ペルソナ・モバイル
//   中心）で45〜70秒/問という理論値の8〜10倍の遅さが報告されたのは、この「遅延が
//   積算していく」設計が主因と判定。経過時間(performance.now())基準の絶対時刻表に
//   差し替え、途中でフレームが遅れても後続で必ず追いつく（遅延が蓄積しない）。
//   あわせて基準速度も引き上げ（20ms→12ms、句読点90ms→60ms）、体感の速度自体も上げる。
function buildCumulativeDelays(text: string): number[] {
  const cumulative: number[] = []
  let acc = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    acc += ch === '。' || ch === '、' || ch === '）' ? 60 : 12
    cumulative.push(acc)
  }
  return cumulative
}

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
  //   2026-07-28 CTO修正（L1監査#11）: ヒーローの業種チップ選択（共有ストア・
  //   useSharedIndustryでリアクティブに購読）を既定値として引き継ぐ。ユーザーが
  //   この体験デモ自身のタブを一度でも選んだら、以後はその選択（localOverride）を
  //   優先し、ヒーロー側の後からの変更で上書きしない（体験デモでの明示的選択を尊重）。
  //   ヒーロー側は常にFV01が初期表示（Takeshi承認済みブランド・不変）のため、この
  //   購読は書き込み専用のヒーローの表示自体には影響しない。
  const sharedIndustry = useSharedIndustry()
  const [localOverride, setLocalOverride] = useState<IndustryKey | null>(null)
  const industryKey = localOverride ?? sharedIndustry
  const industry = getIndustry(industryKey)

  // 会話に積み上がった完了済みターン。
  const [turns, setTurns] = useState<Turn[]>([])
  // 現在タイプ中のターン（回答を1文字ずつ伸ばす）。null＝タイプ中でない。
  const [typing, setTyping] = useState<{ id: number; q: string; full: string } | null>(null)
  const [typedLen, setTypedLen] = useState(0)
  // 一度でも回答が出たか（CTAの文言を体験後トーンに切り替える）。
  const [started, setStarted] = useState(false)
  // 2026-07-28 CTO修正（L1監査#1・最重要）: タイプ中に次の質問がクリックされた場合、
  //   従来は isBusy を理由に完全に無視していた（クリックしたのに何も起きたように
  //   見えない＝「2問目・3問目をクリックしても表示が変わらない」というペルソナ2/3の
  //   報告と一致）。直近1件だけを保留（state＝チップに「次に表示」の見た目も出す）し、
  //   タイプ完了直後に続けて再生する（クリックは常に反映される・連打時は最後の1件が勝つ）。
  const [pending, setPending] = useState<{ qa: DemoQA; qIndex: number } | null>(null)

  const nextId = useRef(0)
  const rafRef = useRef<number | null>(null)
  // 現在再生中ターンの文字ごとの累積表示タイミング表と、再生開始時刻。
  const cumulativeRef = useRef<number[]>([])
  const startTimeRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  // デモに初めて触れた瞬間(アハ到達の代理)を1回だけ計測するためのフラグ。
  const engagedRef = useRef(false)
  // ビューポート進入での「受動再生」を1回だけ発火するためのフラグ。
  const autoplayedRef = useRef(false)
  // 2026-07-28 CTO修正（L2監査#7・実機再現で特定）: 下のIntersectionObserver
  //   effectは [play] のみに依存し、コールバック自体はマウント時に1度だけ作られる。
  //   そのクロージャが捕まえる `industry` はマウント時点のスナップショットのままで、
  //   以後ヒーロー側の業種タブ切替で sharedIndustry が変わっても更新されない。
  //   その結果「ヒーローで業種を変えてから体験デモが初めて視界に入る」順序のとき、
  //   自動再生が古い業種（既定=製造）の1問目を再生してしまい、タブ表示（新業種）と
  //   回答内容（旧業種）が食い違って見える＝ペルソナ報告の「数秒後に製造へ巻き戻る」
  //   の実体（実際は巻き戻りではなく、遅れて発火する自動再生が古い業種のまま、だった）。
  //   レンダーの度に最新値を書き込むrefを用意し、Observerのコールバックはこのrefを
  //   読むことで常に最新の業種を再生する（IntersectionObserver自体の「1回だけ」発火
  //   ロジックは変えない）。
  const industryRef = useRef(industry)
  useEffect(() => {
    industryRef.current = industry
  }, [industry])

  const isBusy = typing !== null

  // アンマウント時にrAFを片付ける。
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // 2026-07-29 CTO修正（UX監査Round4#4,#5・重大）: タイプ進行をrequestAnimationFrame
  //   ＋経過時間ベースへ全面差し替え。従来は typedLen が変わるたびにeffectが再実行され
  //   1文字ずつ setTimeout を再スケジュールする直列積み上げ方式だった。この方式は
  //   ・レンダーやタイマー発火が遅れるたびその遅延がそのまま後続へ積算される
  //     （実測45〜70秒/問の主因と判定・#5）
  //   ・タブがバックグラウンドに回るなど何らかの理由でタイマー連鎖が一度でも
  //     途切れると、それ以降 typedLen を進める再スケジュールが発生せず、
  //     見た目上「同じ箇所で完全に停止したまま」になりうる（#4のフリーズ疑い）
  //   という構造的リスクを持っていた。経過時間(performance.now())から
  //   「今何文字目まで見えているべきか」を毎フレーム再計算する方式に変えると、
  //   1回のフレームがどれだけ遅れても次のフレームで正しい位置に追いつくため、
  //   遅延の蓄積も完全停止も構造的に起こらない。
  //   依存配列は [typing?.id, reducedMotion] のみ（1文字ごとの再実行をやめ、
  //   新しいターンが始まった時だけ実行し直す）。
  useEffect(() => {
    if (!typing) return

    // reduced-motion は即時全文表示してターンを確定する。
    if (reducedMotion) {
      setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
      setTyping(null)
      setTypedLen(0)
      return
    }

    const cumulative = cumulativeRef.current
    const total = typing.full.length
    let shown = 0

    const step = () => {
      const elapsed = performance.now() - startTimeRef.current
      let target = total
      for (let i = shown; i < total; i++) {
        if (cumulative[i] > elapsed) {
          target = i
          break
        }
      }
      if (target !== shown) {
        shown = target
        setTypedLen(target)
      }
      if (target >= total) {
        setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
        setTyping(null)
        setTypedLen(0)
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [typing?.id, reducedMotion])

  // 2026-07-29 CTO修正（UX監査Round4#4,#5・重大）: タイプ中の回答をタップ（または
  //   キーボードでEnter/Space）すると即座に全文表示へ切り替える「スキップ」機能。
  //   #5（表示が遅い）への直接的な回避策であると同時に、#4（特定条件でのフリーズ
  //   疑い）に対する保険でもある＝rAFの進行が万一止まっても、ユーザーはいつでも
  //   タップ一つで詰まりを抜けられる（詰まりが致命的な行き止まりにならない）。
  const skipTyping = useCallback(() => {
    if (!typing) return
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    setTurns(prev => [...prev, { id: typing.id, q: typing.q, a: typing.full }])
    setTyping(null)
    setTypedLen(0)
  }, [typing])

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
    // 経過時間ベースのタイプ進行(#5)の起点：累積表を作り直し、開始時刻を記録する。
    cumulativeRef.current = buildCumulativeDelays(qa.a)
    startTimeRef.current = performance.now()
    setTypedLen(0)
    setTyping({ id, q: qa.q, full: qa.a })
  }, [])

  // 2026-07-28 CTO修正（L1監査#1・最重要）: タイプ中の保留クリックを、タイプ完了
  //   直後（isBusy===false に落ちた瞬間）に1回だけ続けて再生する。従来はタイプ中の
  //   クリックを isBusy ガードでサイレントに無視しており、これが「2問目・3問目を
  //   クリックしても表示が変わらない」というペルソナ2/3の報告の実体だった
  //   （クリック自体は正しいQAに紐づいていたが、忙しい間のクリックが消えていた）。
  // 2026-07-29 CTO修正（UX監査Round5#1・最重要・再発）: 上記の初回修正は
  //   setPending(null) と setTimeout(() => play(qa), 0) を分けて実行していた。
  //   setPending(null) 自体がこのeffectの依存（pending）を変える再レンダーを起こすため、
  //   その再レンダー後にReactがこのeffectのクリーンアップ（＝直前にセットした
  //   setTimeoutをclearTimeoutする処理）を、ブラウザが setTimeout(...,0) のコールバックを
  //   発火させるより先に実行してしまうと、play(qa) が一度も呼ばれないまま保留が
  //   消える。両者の実行順序はReact/ブラウザのスケジューラ内部実装に依存し保証されない
  //   （実機のみで低頻度に再現し、通常のQA・複数回のCI実行では再現しない典型的な
  //   競合状態）。これが「Up nextバッジ（pending state）は正しく切り替わるのに、
  //   実際に表示される問い・回答テキスト（play()が更新するturns/typing state）が
  //   質問1のまま止まる」というRound5報告の実体と判定。setTimeoutを完全に排し、
  //   pendingのクリアとplay()の呼び出しを同一の同期実行内で行う。Reactの自動バッチング
  //   により両方の状態更新が確実に1回のレンダーへまとまり、上記の競合が構造的に
  //   起こり得なくなる（"同一tickで競合"という従来の懸念は、そもそもこの effect の
  //   実行自体が直前コミットの後続パスであり同一tickではないため当たらない）。
  useEffect(() => {
    if (isBusy || !pending) return
    const { qa } = pending
    setPending(null)
    play(qa)
  }, [isBusy, pending, play])

  const ask = useCallback(
    (qa: DemoQA, qIndex: number) => {
      // 2026-07-29 CTO修正（UX監査Round4#2・最重要）: 最初の質問クリック＝
      //   会話の開始時点で、今表示中の業種を localOverride として固定する。
      //   従来は「体験デモ自身のタブを押した時だけ」ロックしており、ヒーロー側の
      //   業種チップ（IndustryHeroPreview）を押しただけでは固定されなかった。
      //   そのためヒーローで業種を押すたび sharedIndustry が変わり、会話の途中
      //   （回答を読んでいる最中）でも体験デモのプロファイル・質問セットが無断で
      //   別業種へ切り替わっていた（ペルソナ6が2回再現）。「質問した時点の業種」を
      //   会話が続く限り不変にする。
      if (localOverride === null) {
        setLocalOverride(industryKey)
      }
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
      if (isBusy) {
        // タイプ中でもクリックを破棄しない。直近1件だけを保留し、
        // 今の回答のタイプが終わり次第、続けて再生する（L1監査#1の恒久修正）。
        setPending({ qa, qIndex })
        return
      }
      play(qa)
    },
    [isBusy, play, industryKey, localOverride],
  )

  // 業種タブの切替（B13）。前提の違う回答が混ざらないよう会話をリセットする。
  //   計測は既存語彙 demo_question_clicked に source='demo_tab' を載せて分離。
  //   2026-07-28 CTO修正（L1監査#11）: 選択した業種をヒーロー⇄体験デモ間の
  //   共有ストアにも反映し、以後の相互引き継ぎに使う。
  const switchIndustry = useCallback(
    (next: IndustryKey) => {
      if (next === industryKey) return
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setPending(null)
      // 2026-07-28 CTO修正（L1監査#11）: 体験デモ自身での明示的な選択は
      // localOverride として固定し、以後ヒーロー側の変更で上書きされないようにする。
      setLocalOverride(next)
      setSharedIndustry(next)
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
  //   2026-07-28 CTO修正（L1監査#11）: 常に製造業(INDUSTRIES[0])固定だと、ヒーローで
  //   他業種を選んでから体験デモが視界に入った場合にタブ表示と回答内容が食い違う。
  //   その時点の industry（現在選択中の業種）の1問目を再生する。
  //   2026-07-28 CTO修正（L2監査#7）: 上記を「その時点」で読むために、依存配列に
  //   industry を含めるとObserverが再生成され「1回だけ」の保証が崩れるため、代わりに
  //   industryRef（常に最新値へ同期済み）をコールバック内で読む。これでObserver自体は
  //   マウント時に1回だけ張られたまま、実際に発火した瞬間の最新業種を再生する。
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
        play(industryRef.current.qa[0])
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
          <span className="mr-1 text-xs font-medium text-neutral-500">業種</span>
          {INDUSTRIES.map(i => (
            <button
              key={i.key}
              id={`trydemo-tab-${i.key}`}
              type="button"
              role="tab"
              aria-selected={i.key === industryKey}
              aria-controls="trydemo-tabpanel"
              tabIndex={i.key === industryKey ? 0 : -1}
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

        {/* 2026-07-28 CTO修正（L2監査#12）: role="tab"のボタンにaria-controlsは
            付いていたが、対応するrole="tabpanel"の要素が存在せず片側だけの実装
            だった（ペルソナ8指摘）。このCard自体を業種タブのパネルとして
            id・role・aria-labelledbyで結線する。 */}
        <Card
          id="trydemo-tabpanel"
          role="tabpanel"
          aria-labelledby={`trydemo-tab-${industryKey}`}
          tabIndex={0}
          className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60"
        >
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
              <p className="py-6 text-center text-sm text-neutral-500">
                下の質問をクリックすると、ここに番頭の答えが表示されます。
              </p>
            )}

            {/* 確定済みターン */}
            {turns.map(t => (
              <Conversation key={t.id} q={t.q} a={t.a} />
            ))}

            {/* タイプ中のターン（カーソル付き・タップでスキップ可） */}
            {typing && (
              <Conversation
                q={typing.q}
                a={typing.full.slice(0, typedLen)}
                typing
                onSkip={skipTyping}
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
          {/* 2026-07-29 CTO修正（UX監査Round4#3・重大）: タイプ中でも業種タブ・
              質問チップの操作自体はL1監査#1時点から受け付けていた（保留キュー）が、
              見た目には無効化のサインが一切なく「押しても反応がない壊れたボタン」に
              見えるとの報告（ペルソナ8が4回再現）。isBusy中はチップ列全体を
              aria-busy＋淡色化し「回答表示中…」の明示ラベルを出す。クリック自体は
              従来どおり無効化しない（disabled属性は使わない）。 */}
          <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              質問を選んで試す
              {isBusy && (
                <span className="ml-1 inline-flex items-center gap-1 normal-case text-brand-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
                  回答表示中…（押した質問は表示後すぐ再生されます）
                </span>
              )}
            </p>
            <div
              className={'flex flex-wrap gap-2 transition-opacity' + (isBusy ? ' opacity-60' : '')}
              aria-busy={isBusy}
            >
              {industry.qa.map((qa, i) => (
                <button
                  key={qa.q}
                  type="button"
                  onClick={() => ask(qa, i)}
                  aria-pressed={pending?.qIndex === i}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] shadow-sm ' +
                    'transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 ' +
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 ' +
                    (isBusy ? 'cursor-wait ' : '') +
                    (pending?.qIndex === i
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-neutral-200 bg-white text-neutral-700')
                  }
                >
                  <MessageSquareText className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {qa.q}
                  {/* 2026-07-28 CTO修正（L1監査#1）: タイプ中に受け付けたクリックは
                      サイレントに消さず「次に表示」で見せる（クリックが効いた実感を作る）。 */}
                  {pending?.qIndex === i && (
                    <span className="text-[10px] font-medium text-brand-500">次に表示</span>
                  )}
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
          {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: 長い日本語CTA文言が
              whitespace-nowrap（Buttonの既定）で折り返せず、極端に狭い実効幅で
              ページ全体の横スクロールに寄与していた。ここだけ折り返し可にする
              （通常倍率では1行に収まるため見た目は不変）。 */}
          <div className="mt-4 flex min-w-0 justify-center">
            <Link
              href="/signup?next=/company"
              className={buttonClass({ variant: 'primary', className: 'whitespace-normal text-center' })}
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
//   2026-07-29 CTO修正（UX監査Round4#4,#5）: typing中は onSkip をタップ/
//   Enter/Spaceで発火できるようにし（表示速度が遅い・フリーズしたと感じた時の
//   即時脱出路）、視覚的にも「タップで全文表示」ヒントとカーソル可視化で
//   操作可能であることを明示する。
// ---------------------------------------------------------------------------
function Conversation({
  q,
  a,
  typing = false,
  onSkip,
}: {
  q: string
  a: string
  typing?: boolean
  onSkip?: () => void
}) {
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
        <div
          className={
            'max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700' +
            (typing && onSkip ? ' cursor-pointer' : '')
          }
          {...(typing && onSkip
            ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-label': 'タップして回答を全文表示する',
                onClick: onSkip,
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSkip()
                  }
                },
              }
            : {})}
        >
          {a}
          {typing && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-brand-500 align-middle"
            />
          )}
        </div>
      </div>
      {typing && onSkip && (
        <p className="pl-8 text-[11px] text-neutral-500">タップで全文表示</p>
      )}
    </div>
  )
}
