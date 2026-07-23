'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track, trackThenNavigate } from '@/lib/analytics'
import { Input } from '@/components/ui/Input'
import { Button, buttonClass } from '@/components/ui/Button'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

// Supabase auth の英語エラー原文を日本語へ写す。
//   主要パターンはメッセージ実文（Supabase GoTrue の代表的な返り値）に対する部分一致で判定し、
//   どれにも当たらなければ汎用の日本語文へフォールバック（英語原文をそのまま出さない）。
function jpSignupError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'このメールアドレスはすでに登録されています。'
  }
  if (m.includes('password') && (m.includes('at least') || m.includes('too short') || m.includes('weak'))) {
    return 'パスワードは8文字以上で設定してください。'
  }
  if (m.includes('invalid') && (m.includes('email') || m.includes('format'))) {
    return 'メールアドレスの形式をご確認ください。'
  }
  if (m.includes('rate limit') || m.includes('for security purposes') || m.includes('too many requests')) {
    return '短時間に操作が続いたため、少し時間をおいてからもう一度お試しください。'
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return '現在、新規登録を一時的に受け付けられません。時間をおいてお試しください。'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return '通信に失敗しました。接続をご確認のうえ、もう一度お試しください。'
  }
  return '登録に失敗しました。時間をおいてもう一度お試しください。'
}

function SignupForm() {
  // searchParams 由来のプリフィルを state 初期値に使うため、フックの先頭で読む
  //   （effect での setState を避ける＝react-hooks/set-state-in-effect 非違反）。
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // C03: 会社名をsignupに統合し、/company（会社作成画面）の1段を削減する。
  //   任意入力（空なら従来フローのまま＝後方互換）。初期値は Kotri hire-bridge 等の
  //   ?company= プリフィルを引き継ぐ（従来は次画面でプリフィルしていた値を前倒し）。
  const [companyName, setCompanyName] = useState(
    () => (searchParams.get('company') ?? '').trim().slice(0, 100),
  )
  const [ageOk, setAgeOk] = useState(false)
  const [digestOptIn, setDigestOptIn] = useState(false)
  const [error, setError] = useState('')
  // 既登録の再訪（＝ログイン迷子）を、その場で回復できるインライン導線を出すためのフラグ。
  //   これまで「このメールアドレスはすでに登録されています。」の文言は出ていたが、
  //   復帰先のログインは画面末尾の汎用リンクのみで、着地(next)も引き継がれず、
  //   計測上は signup_failed[already_registered] のまま離脱＝行き止まりだった。
  //   意図した着地(nextDest)を保ったまま1クリックでログインへ回す（純追加・フォーム不変）。
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const router = useRouter()
  // 番頭(Banto) の動線では確認後に /company へ。?next を尊重しつつ既定は /company。
  const nextRaw = searchParams.get('next') || '/company'
  // 相対パスのみ許可（'//evil.com' はプロトコル相対URL＝open redirect になるため除外）。login側と同一ガード。
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/company'

  // Kotri→番頭 hire-bridge の「ここで入れたお店の名前は、引き継いで使えます」を実挙動にする。
  //   Kotri /hire は /signup?company=<店名>&utm_source=kotri&utm_campaign=hire_bridge を送るが、
  //   従来 signup は company を読まず router.push(next) で捨てていた（着地=/company の会社名欄が空＝再入力・約束と乖離）。
  //   /company（会社作成画面）は既に ?company= を初期値にプリフィルする（commit a9c3015）。
  //   よって遷移先(next)に company を載せて持ち回れば、着地で店名が入る＝約束が実挙動になる。
  //   持ち回りは next の実体が /company の時だけ（onboarding 等 company を読まない先には付けない）。
  //   emailRedirectTo（メール確認の全再読込）にも同じ nextDest を使う＝リンク着地でも店名が残る。
  const companyParam = (searchParams.get('company') ?? '').trim().slice(0, 100)
  // 無料ツールの「この結果を自社の記録として保存(無料)」も同じ流儀で持ち回る。
  //   ツール結果の要約(note)を /company に載せ、会社作成時に「会社の記憶」へ保存する
  //   （app/(app)/company/page.tsx が消費）。約束（保存）と実挙動を一致させる。
  const noteParam = (searchParams.get('note') ?? '').trim().slice(0, 400)
  // C03: フォームで入力された会社名（あれば）を優先して /company へ持ち回る。
  //   未入力なら従来どおり ?company= プリフィル値。どちらも無ければ素の next。
  const companyForNext = useMemo(() => {
    const typed = companyName.trim().slice(0, 100)
    return typed || companyParam
  }, [companyName, companyParam])
  const nextDest = useMemo(() => {
    if (!companyForNext && !noteParam) return next
    const [path, query = ''] = next.split('?')
    if (path !== '/company') return next
    const sp = new URLSearchParams(query)
    if (companyForNext) sp.set('company', companyForNext)
    if (noteParam) sp.set('note', noteParam)
    return `${path}?${sp.toString()}`
  }, [next, companyForNext, noteParam])

  // C03: 会社名が入力済みなら、signup成立直後にその場で会社を作成して onboarding へ直行する
  //   （/company の会社作成画面を1段削減）。発動条件は「着地が /company（ハブ）そのもの」かつ
  //   「無料ツール結果の持ち回り(note)が無い」とき。note がある場合は /company 側の
  //   「点検結果を保存します」の約束表示・保存実装に委ねる（既存の約束を壊さない）。
  //   作成失敗時は従来どおり nextDest へ（会社名はプリフィルされるので入力は無駄にならない）。
  //   既存ユーザーの複数会社フロー（/company の「別の会社を追加」）は不変＝新規signup時のみ。
  async function finishSignup() {
    const nm = companyName.trim()
    const isCompanyHub = next.split('?')[0] === '/company'
    if (nm && isCompanyHub && !noteParam) {
      try {
        const res = await fetch('/api/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nm }),
        })
        const data = await res.json().catch(() => ({}))
        const newId = data?.company?.companyId
        if (res.ok && newId) {
          // /company 画面と同じ活性化ファネルイベント（POST成功後のみ・PIIなし）。
          track('company_created')
          router.push(`/company/onboarding?companyId=${newId}`)
          return
        }
      } catch {
        /* 作成失敗は本流を壊さない（下の従来遷移へ） */
      }
    }
    router.push(nextDest)
  }

  // 帰属(attribution): Kotri→番頭 hire-bridge 等の流入元を計測に載せる。
  //   例: /signup?utm_source=kotri&utm_campaign=hire_bridge
  //   非個人情報・低カーディナリティの流入元のみ。値が無ければ prop 自体を付けない
  //   （既存イベントの母数を壊さない・undefined を送らない）。過度な長さは切り詰める。
  const attribution = useMemo<{ source?: string; campaign?: string }>(() => {
    const clean = (v: string | null) => {
      if (!v) return undefined
      const s = v.trim().slice(0, 64)
      return s.length > 0 ? s : undefined
    }
    const source = clean(searchParams.get('utm_source'))
    const campaign = clean(searchParams.get('utm_campaign'))
    const props: { source?: string; campaign?: string } = {}
    if (source) props.source = source
    if (campaign) props.campaign = campaign
    return props
  }, [searchParams])

  // 継続コンテキスト（踏み板）: デモ/無料ツールで温まった文脈を、登録画面に持ち越す。
  //   番頭起点の流入だけに1つの短い一文を出し、押した瞬間の温度落差での離脱を埋める。
  //   判定＝「番頭のツール/デモ/LPから来たか」を、既存クエリの意味そのままで導出する:
  //     - next が /company で始まる（デモ・LP・ツールの共通CTA着地）
  //     - もしくは utm_source が有る（帰属付き流入）
  //   直接 /signup（bare）に来た人には出さない＝現行のまま・登録母数を壊さない。
  //   出し分けは2パターンのみ（過剰分岐しない）:
  //     - utm_source=banto_tool（点検ツール由来）→「点検結果を…」
  //     - それ以外の番頭起点（デモ/LP）→「さきほどの答え方を…」
  //   ※判定は正規化後 next(既定/company)でなく生クエリで行う。bare /signup は
  //     next 未指定＝踏み板を出さない（直接流入の母数を壊さない・上記コメントの意図に一致）。
  const fromBanto = (searchParams.get('next') || '').startsWith('/company') || !!attribution.source
  const fromTool = attribution.source === 'banto_tool'
  const contextSource = fromTool ? 'banto_tool' : 'banto_demo'

  // 計測: 登録フォーム到達（/signup の pageview とは別に「signUp 試行の母数」を明示）。
  //   これで 登録フォーム到達→完了/失敗 の各段が Plausible で読める。PIIは送らない。
  //   attribution(source/campaign)が有れば付与＝流入元別コンバージョンが読める。
  useEffect(() => {
    track('signup_started', Object.keys(attribution).length ? attribution : undefined)
  }, [attribution])

  // 計測: 踏み板が実際に表示された回数（表示→登録の効きを流入元別に読む）。
  //   fromBanto の時だけ1回発火。PIIは載せない（低カーディナリティの source のみ）。
  useEffect(() => {
    if (fromBanto) track('signup_context_shown', { source: contextSource })
  }, [fromBanto, contextSource])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAlreadyRegistered(false)

    // 計測: フォームがネイティブ検証(email/passwordのrequired)を通過し送信に到達した母数。
    //   signup_started(フォーム到達) と signup_completed/failed(API結果) の間の暗箱を割る。
    //   これが signup_started より著しく少なければ、崖はAPIでなく「送信前の入力未完/離脱」。
    //   fire-and-forget の追加イベント（レイアウト・フィールド順・踏み板位置は一切不変＝A/B非汚染）。
    track('signup_submit_attempted', Object.keys(attribution).length ? attribution : undefined)

    // 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け）
    // 2026-07-19 growth修正: このチェックボックスは HTML の required 属性も併用していたため、
    //   ブラウザのネイティブバリデーション（実測=Chromiumではブラウザの表示言語依存の英語文言
    //   "Please check this box if you want to proceed." になりうる。ページ本体は日本語UIで
    //   統一しているため、この一箇所だけ言語・見た目が浮いて離脱を招く恐れがあった）が
    //   onSubmit より先に発火し、下のjpSignupError相当の丁寧な日本語エラー文が実際には
    //   一度も表示されない死んだコードになっていた（required により早期リターンで止まる）。
    //   required属性を外し、この分岐が実際に実行されるようにした（文言・チェック要件自体は不変）。
    if (!ageOk) {
      setError('事業者としてのご利用（18歳以上）に同意のうえチェックをお願いします。')
      track('signup_blocked_age', Object.keys(attribution).length ? attribution : undefined)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}${nextDest}`,
        data: { digest_unsubscribed: !digestOptIn },
      },
    })

    if (error) {
      // jpSignupError と同じ判定（メッセージ実文の揺れに部分一致で追従）で既登録を検出。
      const lower = error.message.toLowerCase()
      const already =
        error.message === 'User already registered' ||
        lower.includes('already registered') ||
        lower.includes('already been registered')
      // 計測: 登録失敗を可視化（今まで完全に不可視だった）。既登録の再訪＝ログイン迷子は別問題として切り分け。
      track('signup_failed', { reason: already ? 'already_registered' : 'other', ...attribution })
      // Supabase の英語エラー原文をそのまま出さない（主要パターンは日本語化・他は汎用日本語文）。
      setError(jpSignupError(error.message))
      // 既登録なら、意図した着地(nextDest)を保ったままログインへ回すインライン回復導線を出す。
      setAlreadyRegistered(already)
      setLoading(false)
    } else {
      // 活性化ファネル: 登録完了（email+password の signUp 成功地点＝北極星イベント）。
      // PII は送らない。遷移する経路では trackThenNavigate で「送出確定を待ってから」
      // 遷移する（fire-and-forget + 直後 router.push だとビーコンが破棄され北極星が計測漏れ）。
      //
      // 実挙動で分岐する（表示vs実挙動）。Supabase のメール確認が無効(autoconfirm)なら
      // signUp 応答に session が同梱される＝この場で認証済み。その場合は確認メール待ちの
      // デッドエンドを出さず、活性化の次の一歩(/company もしくは ?next)へ直行させる。
      // 確認必須(session 無し)なら、次の一歩を明示したガイド付き done 画面を出す。
      if (data.session) {
        trackThenNavigate('signup_completed', () => void finishSignup(), Object.keys(attribution).length ? attribution : undefined)
        return
      }
      // メール確認必須だが既定SMTPは届かない（無料モニター期の暫定）。
      // サーバ側で確認済みにして即ログインし、確認メール待ちのデッドエンドを回避する。
      // 失敗時は従来の確認メール待ち画面にフォールバック（挙動を悪化させない）。
      try {
        const res = await fetch('/api/auth/confirm-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (res.ok) {
          const signin = await supabase.auth.signInWithPassword({ email, password })
          if (!signin.error) {
            trackThenNavigate('signup_completed', () => void finishSignup(), Object.keys(attribution).length ? attribution : undefined)
            return
          }
        }
      } catch {
        // フォールバックへ
      }
      // 確認メール待ち画面（遷移しない＝ビーコンは通常どおり送出される）。
      track('signup_completed', Object.keys(attribution).length ? attribution : undefined)
      setDone(true)
      setLoading(false)
    }
  }

  // メール確認必須フロー用の確認メール再送（迷子＝メール未着の復帰導線）。
  async function handleResend() {
    if (resending) return
    setResending(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${location.origin}${nextDest}` },
    })
    if (error) {
      setError('確認メールの再送に失敗しました。時間をおいて試してください。')
    } else {
      setResent(true)
    }
    setResending(false)
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">確認メールを送りました</h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          {email} に確認メールをお送りしました。メール内のリンクを開くと登録が完了し、そのまま会社の登録画面に進めます。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          数分待ってもメールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>

        {/* C01: 確認待ちを空白時間にしない。登録が終わった先で番頭が何を覚えるかを先出しし、
            デモ/ツール由来の文脈（fromBanto/fromTool）はここでも引き継ぎを約束する。
            記載は実挙動の範囲のみ（覚える対象は既存機能: 自社ルール・相談履歴・期限）。 */}
        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-left">
          <p className="text-xs font-medium text-neutral-500">確認を待つあいだに ─ 番頭が覚えること</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-neutral-700">
            <li>・就業規則や36協定など、自社ルールの前提</li>
            <li>・有給や残業の運用と、過去に相談した内容</li>
            <li>・年間の労務手続きと、自社で確定した期限</li>
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
            {fromBanto
              ? fromTool
                ? 'さきほどの点検結果も、登録後にそのまま引き継げます。二度目の相談は、昨日の続きから始まります。'
                : 'さきほどの答え方も、登録後は自社の前提で続けられます。二度目の相談は、昨日の続きから始まります。'
              : '一度覚えた前提は説明し直す必要がありません。二度目の相談は、昨日の続きから始まります。'}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {resent ? (
            <p className="text-sm text-success-700">確認メールを再送しました。</p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending ? '再送中...' : '確認メールを再送する'}
            </Button>
          )}

          <Link href={`/login?next=${encodeURIComponent(nextDest)}`} className={buttonClass({ variant: 'ghost', size: 'lg', className: 'w-full' })}>
            ログイン画面へ
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {/* 継続コンテキスト（踏み板）: 番頭起点の流入だけに表示。デモ/ツールで温まった
          文脈を「御社の前提で受け取るための登録」として言い直し、温度を持ち越す。
          景表法＝果たせる約束のみ（会社登録は次画面・まず1社ぶんから無料で）。
          フォーム自体は一切変えない＝純粋な追加表示。 */}
      {fromBanto && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
          <p>
            {fromTool
              ? 'さきほどの点検結果を、自社の前提でそのまま受け取るための登録です。'
              : 'さきほどの答え方を、自社の前提でそのまま受け取るための登録です。'}
          </p>
          <p className="mt-1 text-neutral-600">
            会社の登録は次の画面で、まず1社ぶんから無料で始められます。
          </p>
        </div>
      )}

      <p className="mb-2 text-center text-sm text-neutral-600">無料で始める</p>

      {/* 直接流入（bare /signup）にも安心材料を1行出す。事実（BILLING_ENABLED=false・
          カード情報は収集しない・アカウント削除と同時に全データ削除）の範囲のみ。 */}
      <p className="mb-4 text-center text-xs leading-relaxed text-neutral-500">
        現在は無料モニター期間です。クレジットカードの登録は不要で、
        データはアカウント削除と同時にすべて削除できます。
      </p>

      {/* C02: OAuth（Google/GitHub）を主導線として先頭へ（メール登録より摩擦が少ない）。
          Supabase側のプロバイダ設定は有効を実測確認済み（/auth/v1/authorize が302）。 */}
      <OAuthButtons next={nextDest} />
      <p className="mt-2 text-center text-xs text-neutral-500">
        GitHub・Googleでの登録も、事業者としてのご利用（18歳以上）とみなします。
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        またはメールアドレスで登録
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          autoComplete="email"
        />
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード（8文字以上）"
          required
          minLength={8}
          autoComplete="new-password"
        />

        {/* C03: 会社名の統合入力（任意）。入力があれば登録直後に会社を作成して
            5問オンボーディングへ直行し、会社作成画面の1段を削減する。
            空のままでも従来フロー（/company で入力）で進める＝後方互換。 */}
        <div>
          <Input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="会社名（任意・あとでも入力できます）"
            maxLength={100}
            autoComplete="organization"
            aria-label="会社名（任意）"
          />
          <p className="mt-1 text-xs text-neutral-500">
            入力しておくと、登録後すぐに自社の診断に進めます。
          </p>
        </div>

        {/* 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け） */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={e => setAgeOk(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500/30"
          />
          <span className="text-xs text-neutral-600">
            事業者として利用します（18歳以上）
          </span>
        </label>

        {/* 更新情報オプトイン */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={digestOptIn}
            onChange={e => setDigestOptIn(e.target.checked)}
            className="mt-0.5 accent-brand-600"
          />
          <span className="text-xs text-neutral-600">
            番頭の新機能・労務の最新情報をメールで受け取る（任意・いつでも停止可能）
          </span>
        </label>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        {/* 既登録の再訪（ログイン迷子）を行き止まりにしない: 意図した着地(nextDest)を
            保ったまま1クリックでログインへ回す。純追加でフォーム構造・A/Bは不変。
            計測: signup_failed[already_registered] からの回復クリックを可視化。 */}
        {alreadyRegistered && (
          <>
            <Link
              href={`/login?next=${encodeURIComponent(nextDest)}`}
              onClick={() => track('login_from_already_registered')}
              className={buttonClass({ variant: 'secondary', size: 'lg', className: 'w-full' })}
            >
              このメールアドレスでログインする
            </Link>
            {/* C11延長: パスワード忘れも行き止まりにしない（既登録→ログイン導線の補完）。 */}
            <p className="text-center text-xs text-neutral-500">
              パスワードを忘れた場合は{' '}
              <Link href="/forgot-password" className="underline hover:text-neutral-700">
                こちらから再設定
              </Link>
              できます。
            </p>
          </>
        )}

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? '登録中...' : '無料で始める'}
        </Button>
      </form>

      {/* 登録前の摩擦（何を入力させられるか・どれくらいかかるか、が見えない不確実性）を消す。
          着手前にゴールまでの短さを具体で見せると完了率が上がる（goal-gradient / 不確実性除去）。
          各ステップは実挙動と一致させる（景表法・果たせる約束のみ）:
            ①メール＋パスワードで登録（この画面）
            ②会社名を1つ登録（次の /company 画面）
            ③任意の5問に答えると自社のリスク診断がその場で出る（/company/onboarding→/company/risk）。
          所要目安は email＋password＋会社名＋5択の実操作量から「1〜2分ほど」。
          2026-07-15 導線A/B判定用の順序変更（1変数）: モバイル幅で最初の入力欄がファーストビュー外に
          押し出されていたため、この枠をフォーム送信ボタンの下へ移動（内容・文言は不変・位置のみ）。
          measure=既存 signup_started→signup_completed 通過率（judge 2026-07-22）。 */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <p className="mb-2.5 text-xs font-medium text-neutral-500">はじめるまでの流れ（1〜2分ほど）</p>
        <ol className="space-y-2">
          {[
            'メールアドレスとパスワードを入力する',
            '会社名を1つ登録する（この画面でまとめて入力できます）',
            '任意の5つの質問に答えると、自社のリスク診断と年間手続きカレンダーがその場で出る',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-center text-xs text-neutral-500">
        登録することで
        <Link href="/terms" className="underline hover:text-neutral-700">利用規約</Link>と
        <Link href="/privacy" className="underline hover:text-neutral-700">プライバシーポリシー</Link>
        に同意したものとみなします
      </p>

      <p className="mt-4 text-center text-sm text-neutral-500">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">ログイン</Link>
      </p>
    </div>
  )
}
