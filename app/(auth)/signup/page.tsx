'use client'

// 2026-07-25 CTO緊急修正 → 2026-07-26 是正: Turbopack(Next 16.2.9)の静的プリレンダが(auth)
//   グループ全ルートをサイレントに直近の not-found 境界へ落としていた既知の症状の回避
//   （詳細は app/(auth)/login/page.tsx コメント参照）。
//   `export const dynamic = 'force-dynamic'` をここ('use client'ファイル)に置いていたが
//   無効だった（サーバーコンポーネントからのエクスポートでないと効かない）。宣言は
//   app/(auth)/layout.tsx（サーバーコンポーネント）へ移設済み。
import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track, trackOncePerVisit, trackThenNavigate, markSignupCompletedAt } from '@/lib/analytics'
import { afterCompanyCreateHref } from '@/lib/offer'
import { Input } from '@/components/ui/Input'
import { Button, buttonClass } from '@/components/ui/Button'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { PAID_PLAN_IDS, PLANS, type PlanId } from '@/lib/plans'

export default function SignupPage() {
  return (
    <Suspense fallback={<div aria-hidden className="min-h-[1px]" />}>
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

// 2026-07-28 CTO修正（L1監査#3）: ?lang=en の英語化用エラー文言。ロジック（判定条件）は
//   jpSignupError と完全に同一。表示文言のみ英語にする（新しい失敗パターンは追加しない）。
function enSignupError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'This email address is already registered.'
  }
  if (m.includes('password') && (m.includes('at least') || m.includes('too short') || m.includes('weak'))) {
    return 'Password must be at least 8 characters.'
  }
  if (m.includes('invalid') && (m.includes('email') || m.includes('format'))) {
    return 'Please check the format of your email address.'
  }
  if (m.includes('rate limit') || m.includes('for security purposes') || m.includes('too many requests')) {
    return 'Too many attempts in a short time. Please wait a moment and try again.'
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'New sign-ups are temporarily unavailable. Please try again later.'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'A network error occurred. Please check your connection and try again.'
  }
  return 'Sign-up failed. Please wait a moment and try again.'
}

function SignupForm() {
  // searchParams 由来のプリフィルを state 初期値に使うため、フックの先頭で読む
  //   （effect での setState を避ける＝react-hooks/set-state-in-effect 非違反）。
  const searchParams = useSearchParams()
  // 2026-07-28 CTO修正（L1監査#3）: ?lang=en は表示文言だけを英語化する（ロジック・
  //   バリデーション・Supabase呼び出しは完全に不変）。EN LP(/business/en)からの
  //   signupHref に &lang=en を付けて渡す想定。
  const isEn = searchParams.get('lang') === 'en'
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
  // 2026-07-28 CTO修正（L1監査#8）: 個人情報を預ける契約という性質上、利用規約・
  //   プライバシーポリシーへの同意を注記文言だけでなく明示チェックボックスにする。
  const [consentOk, setConsentOk] = useState(false)
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
  // 就業規則AI の動線では確認後に /company へ。?next を尊重しつつ既定は /company。
  const nextRaw = searchParams.get('next') || '/company'
  // 相対パスのみ許可（'//evil.com' はプロトコル相対URL＝open redirect になるため除外）。login側と同一ガード。
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/company'

  // Kotri→就業規則AI hire-bridge の「ここで入れたお店の名前は、引き継いで使えます」を実挙動にする。
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
  // 2026-07-26 CTO修正(I3導線バグ): LP士業CTA(app/business/page.tsx)は
  //   /signup?next=/company&plan=shigyo を送るが、signup 側に受け皿が無く
  //   plan= は握りつぶされていた（帰属も事前選択も効かない＝CTAが機能していなかった）。
  //   company/note と同じ流儀で /company・/company/onboarding まで持ち回る。
  //   未知の値・改ざんは無視（有料プランIDのみ許可）。
  const planParam = useMemo(() => {
    const raw = (searchParams.get('plan') ?? '').trim()
    return PAID_PLAN_IDS.includes(raw as PlanId) ? (raw as PlanId) : ''
  }, [searchParams])
  // C03: フォームで入力された会社名（あれば）を優先して /company へ持ち回る。
  //   未入力なら従来どおり ?company= プリフィル値。どちらも無ければ素の next。
  const companyForNext = useMemo(() => {
    const typed = companyName.trim().slice(0, 100)
    return typed || companyParam
  }, [companyName, companyParam])
  // 2026-07-29 CTO修正（L3監査#2）: 従来は companyForNext/noteParam/planParam の
  //   いずれも無ければ nextDest=next をそのまま返しており、isEn(=?lang=en) が
  //   next とは別の sibling クエリだったため、ここで捨てられていた。結果、
  //   /business/en → /signup?lang=en の英語話者がメール確認・OAuth・会社作成後の
  //   着地(/company, /company/onboarding)で常に日本語UIに戻っていた。
  //   nextDest はここ1箇所を通れば以降 emailRedirectTo・OAuthButtons・
  //   ログイン迷子リンクの全てに伝播する（signup 側の唯一の合流点）ため、
  //   ここで lang=en を焼き込む（path が /company かどうかに関わらず常に）。
  const nextDest = useMemo(() => {
    const [path, query = ''] = next.split('?')
    const sp = new URLSearchParams(query)
    if (path === '/company') {
      if (companyForNext) sp.set('company', companyForNext)
      if (noteParam) sp.set('note', noteParam)
      if (planParam) sp.set('plan', planParam)
    }
    if (isEn) sp.set('lang', 'en')
    const qs = sp.toString()
    return qs ? `${path}?${qs}` : path
  }, [next, companyForNext, noteParam, planParam, isEn])

  // C03: 会社名が入力済みなら、signup成立直後にその場で会社を作成して書類へ直行する
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
          track('company_created')
          const extra = new URLSearchParams()
          if (planParam) extra.set('plan', planParam)
          if (isEn) extra.set('lang', 'en')
          const href = extra.toString()
            ? `${afterCompanyCreateHref(newId)}&${extra.toString()}`
            : afterCompanyCreateHref(newId)
          router.push(href)
          return
        }
      } catch {
        /* 作成失敗は本流を壊さない（下の従来遷移へ） */
      }
    }
    router.push(nextDest)
  }

  // 帰属(attribution): Kotri→就業規則AI hire-bridge 等の流入元を計測に載せる。
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
  //   就業規則AI起点の流入だけに1つの短い一文を出し、押した瞬間の温度落差での離脱を埋める。
  //   判定＝「就業規則AIのツール/デモ/LPから来たか」を、既存クエリの意味そのままで導出する:
  //     - next が /company で始まる（デモ・LP・ツールの共通CTA着地）
  //     - もしくは utm_source が有る（帰属付き流入）
  //   直接 /signup（bare）に来た人には出さない＝現行のまま・登録母数を壊さない。
  //   出し分けは2パターンのみ（過剰分岐しない）:
  //     - utm_source=banto_tool（点検ツール由来）→「点検結果を…」
  //     - それ以外の就業規則AI起点（デモ/LP）→「さきほどの答え方を…」
  //   ※判定は正規化後 next(既定/company)でなく生クエリで行う。bare /signup は
  //     next 未指定＝踏み板を出さない（直接流入の母数を壊さない・上記コメントの意図に一致）。
  const fromBanto = (searchParams.get('next') || '').startsWith('/company') || !!attribution.source
  const fromTool = attribution.source === 'banto_tool'
  const fromZure = searchParams.get('intent') === 'zure'
  const contextSource = fromTool ? 'banto_tool' : fromZure ? 'zure' : 'banto_demo'

  // 計測: 登録フォーム到達（/signup の pageview とは別に「signUp 試行の母数」を明示）。
  //   これで 登録フォーム到達→完了/失敗 の各段が Plausible で読める。PIIは送らない。
  //   attribution(source/campaign)が有れば付与＝流入元別コンバージョンが読める。
  //
  //   2026-08-25 是正: ここは以前 `useEffect(..., [attribution])` だった。attribution は
  //   useMemo が返す**オブジェクト**で、依存配列は参照同一性で比較するため、
  //   searchParams の同一性が変わって useMemo が作り直されるたびに再実行され、
  //   同じ訪問で何度も発火していた（Plausible 30日実測: events 67 / visitors 6 ＝
  //   1人あたり11.2回）。段2（名前を取る）の件数をこの母数で判定するので、
  //   参照同一性に依存しない「1訪問1回」へ移した（lib/analytics-once.ts）。
  //   依存配列も、比較が値で済むプリミティブ（キー文字列）だけにする。
  const attributionKey = `${attribution.source ?? ''}|${attribution.campaign ?? ''}`
  useEffect(() => {
    trackOncePerVisit(
      'signup_started',
      Object.keys(attribution).length ? attribution : undefined,
    )
    // attribution は attributionKey と同じ内容を指す（値が同じなら再発火しない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributionKey])

  // 計測: 踏み板が実際に表示された回数（表示→登録の効きを流入元別に読む）。
  //   fromBanto の時だけ1回発火。PIIは載せない（低カーディナリティの source のみ）。
  //   2026-08-25 是正: 依存はプリミティブだが発火ガードが無く、同一タブ内の
  //   再マウント（Suspense 境界の再サスペンド・戻る/進む）で素通りしていた
  //   （実測 events 34 / visitors 5 ＝ 1人あたり6.8回）。1訪問1回に縛る。
  useEffect(() => {
    if (fromBanto) trackOncePerVisit('signup_context_shown', { source: contextSource })
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

    // 2026-07-28 CTO修正（L1監査#12）: 従来は各項目を早期return（1件ずつ）でしか
    //   検証しておらず、1回の送信で1つのエラーしか見えなかった（直してもまた次が出る
    //   体験・ペルソナ6指摘）。<form noValidate> と併せて、ここで全項目をまとめて検証し、
    //   該当する不備を全て一度に表示する。個々のメッセージ文言・判定条件は従来と不変。
    //
    // 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け）。
    // 2026-07-19 growth修正 / 2026-07-26 CTO修正(F-7): チェックボックスの native required
    //   や password の native minLength はブラウザ表示言語依存の英語ツールチップになりうるため
    //   使わず、ここで日本語/英語の自前エラーとして検証する（要件自体は不変）。
    // 2026-07-28 CTO修正（L1監査#12）: メールアドレスも native type="email" の検証に頼らず
    //   ここで検証し、ブラウザネイティブの非日本語ツールチップが出ないようにする。
    const errors: string[] = []
    const emailTrimmed = email.trim()
    const emailFormatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)
    if (!emailTrimmed) {
      errors.push(isEn ? 'Please enter your email address.' : 'メールアドレスを入力してください。')
    } else if (!emailFormatOk) {
      errors.push(isEn ? 'Please check the format of your email address.' : 'メールアドレスの形式をご確認ください。')
    }
    if (password.length < 8) {
      errors.push(isEn ? 'Password must be at least 8 characters.' : 'パスワードは8文字以上で設定してください。')
    }
    if (!ageOk) {
      errors.push(
        isEn
          ? 'Please confirm you are using this as a business (18+) by checking the box.'
          : '事業者としてのご利用（18歳以上）に同意のうえチェックをお願いします。',
      )
    }
    if (!consentOk) {
      errors.push(
        isEn
          ? 'Please agree to the Terms of Service and Privacy Policy by checking the box.'
          : '利用規約とプライバシーポリシーへの同意にチェックをお願いします。',
      )
    }
    if (errors.length > 0) {
      // 改行区切りで結合し、表示側は whitespace-pre-line で1行ずつ見せる
      // （L1監査#12: 一括表示化。区切り文字に依存した split はしない）。
      setError(errors.join('\n'))
      if (!ageOk) track('signup_blocked_age', Object.keys(attribution).length ? attribution : undefined)
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
      setError(isEn ? enSignupError(error.message) : jpSignupError(error.message))
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
        markSignupCompletedAt() // TTV計測: signup完了時刻（初回診断/初回チャットまでの経過秒の起点）
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
            markSignupCompletedAt() // TTV計測: signup完了時刻
            trackThenNavigate('signup_completed', () => void finishSignup(), Object.keys(attribution).length ? attribution : undefined)
            return
          }
        }
      } catch {
        // フォールバックへ
      }
      // 確認メール待ち画面（遷移しない＝ビーコンは通常どおり送出される）。
      markSignupCompletedAt() // TTV計測: signup完了時刻
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
      setError(
        isEn
          ? 'Failed to resend the confirmation email. Please wait a moment and try again.'
          : '確認メールの再送に失敗しました。時間をおいて試してください。',
      )
    } else {
      setResent(true)
    }
    setResending(false)
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">
          {isEn ? 'Confirmation email sent' : '確認メールを送りました'}
        </h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          {isEn
            ? fromZure
              ? `We sent a confirmation email to ${email}. Open the link in the same browser so the one-page sheet can be saved to your company documents. After 24 hours, or on another device, place the file again.`
              : `We sent a confirmation email to ${email}. Open the link to finish signing up.`
            : fromZure
              ? `${email} に確認メールをお送りしました。同じブラウザでメール内のリンクを開くと、さきほどの1枚を会社の書類に残せます。別の端末や、控えから24時間を過ぎた場合は、もう一度ファイルを置いてください。`
              : `${email} に確認メールをお送りしました。メール内のリンクを開くと登録が完了します。`}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          {isEn
            ? 'If the email doesn’t arrive after a few minutes, please also check your spam folder.'
            : '数分待ってもメールが届かない場合は、迷惑メールフォルダもご確認ください。'}
        </p>

        {/* C01: 確認待ちを空白時間にしない。登録が終わった先で就業規則AIが何を覚えるかを先出しし、
            デモ/ツール由来の文脈（fromBanto/fromTool）はここでも引き継ぎを約束する。
            記載は実挙動の範囲のみ（覚える対象は既存機能: 自社ルール・相談履歴・期限）。 */}
        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-left">
          <p className="text-xs font-medium text-neutral-500">
            {isEn ? 'While you wait' : '確認を待つあいだに'}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-neutral-700">
            {isEn ? (
              fromZure ? (
                <>
                  <li>The one-page sheet stays in this browser for 24 hours</li>
                  <li>After confirmation, it moves to your company documents</li>
                  <li>Chat comes after the file</li>
                </>
              ) : (
                <>
                  <li>Place a work rules file to get the one-page sheet</li>
                  <li>After you save it, it moves to your company documents</li>
                  <li>Chat comes after the file</li>
                </>
              )
            ) : fromZure ? (
              <>
                <li>・さきほどの1枚（このブラウザに24時間控えがあります）</li>
                <li>・確認が終わると、会社の書類に残ります</li>
                <li>・相談はファイルのあとです</li>
              </>
            ) : (
              <>
                <li>・就業規則のファイルを置くと、ずれの1枚が出ます</li>
                <li>・残す操作のあと、会社の書類に移ります</li>
                <li>・相談はファイルのあとです</li>
              </>
            )}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
            {isEn
              ? fromZure
                ? 'After confirmation, the one-page sheet moves to your company documents. Chat comes after the file.'
                : 'After confirmation, you can place a work rules file. Chat comes after the file.'
              : fromZure
                ? '確認が終わると、さきほどの1枚が会社の書類に残ります。相談はファイルのあとです。'
                : '確認が終わったら、就業規則のファイルを置けます。相談はファイルのあとです。'}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {resent ? (
            <p className="text-sm text-success-700">
              {isEn ? 'Confirmation email resent.' : '確認メールを再送しました。'}
            </p>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending ? (isEn ? 'Resending...' : '再送中...') : isEn ? 'Resend confirmation email' : '確認メールを再送する'}
            </Button>
          )}

          <Link href={`/login?next=${encodeURIComponent(nextDest)}`} className={buttonClass({ variant: 'ghost', size: 'lg', className: 'w-full' })}>
            {isEn ? 'Go to login' : 'ログイン画面へ'}
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {/* 2026-07-28 CTO修正（L2監査#1）: /signup に見出し(h1等)が1つも無く、
          スクリーンリーダーの見出しナビゲーションが使えなかった（ペルソナ8指摘）。
          視覚デザイン（既存の小さい"無料で始める"文言）は変えず、読み上げ専用の
          h1を追加する。 */}
      <h1 className="sr-only">{isEn ? 'Sign up for 就業規則AI' : '就業規則AI 新規登録'}</h1>

      {/* 2026-07-28 CTO修正（L2監査#3）: /signup?plan=shigyo で来ても画面上には
          何も反映されず、遷移先(nextDest)へ静かに持ち回るだけだった（ペルソナ10
          指摘：「plan=shigyo導線がsignup画面に反映されない」）。士業プランでの
          登録であることをその場で明示する（実挙動＝登録後にonboardingへ
          plan=shigyoが引き継がれる、の範囲のみを伝える）。 */}
      {/* 2026-07-30 PMF修理#4: 士業のためだけに作った plan= の受け皿が、Entry/Standard には
          配線されていなかった（LP側の signupHref が undefined ＝ 既定の /signup?next=/company に
          落ち、「Entryで始める」「Standardで始める」を押した意思が1つも残らなかった）。
          LP側に plan=starter / plan=standard を載せたので、ここで受けて画面に出す。
          文言は実挙動の範囲だけを言う（登録時点ではまだ無料プランで作られ、有料への
          切り替えはご自身の操作でのみ課金される。この画面ではカード情報を集めない）。 */}
      {(planParam === 'starter' || planParam === 'standard') && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
          <p>
            {isEn
              ? `Signing up with the ${PLANS[planParam].displayName} plan (¥${PLANS[planParam].monthlyJpy.toLocaleString()}/month, up to ${PLANS[planParam].seatCap} members per company) in mind. Your account starts on the free plan — you are only charged if you switch to a paid plan yourself.`
              : `${PLANS[planParam].displayName}プラン（¥${PLANS[planParam].monthlyJpy.toLocaleString()}/月・1社${PLANS[planParam].seatCap}名まで）で進みます。まず無料プランで作成され、切り替えはご自身の操作でのみ課金されます。`}
          </p>
          <p className="mt-1 text-neutral-600">
            {isEn ? (
              <>
                See the{' '}
                <Link href="/pricing" className="underline hover:text-neutral-800">pricing page</Link>{' '}
                for what each plan includes.
              </>
            ) : (
              <>
                各プランに含まれる範囲は
                <Link href="/pricing" className="underline hover:text-neutral-800">料金ページ</Link>
                で確認できます。
              </>
            )}
          </p>
        </div>
      )}

      {planParam === 'shigyo' && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
          <p>
            {isEn
              ? 'Signing up for the 士業 (professional) plan — you’ll be able to manage multiple client companies with separate memory for each.'
              : '士業プランでの登録ですね。登録後、複数の顧問先企業を切り替えて管理できるようになります（企業ごとに記憶は分離されます）。'}
          </p>
        </div>
      )}

      {/* 継続コンテキスト（踏み板）: 就業規則AI起点の流入だけに表示。デモ/ツールで温まった
          文脈を「御社の前提で受け取るための登録」として言い直し、温度を持ち越す。
          景表法＝果たせる約束のみ（会社登録は次画面・まず1社ぶんから無料で）。
          フォーム自体は一切変えない＝純粋な追加表示。 */}
      {fromBanto && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-neutral-700">
          <p>
            {isEn
              ? 'This sign-up lets you continue with your own company’s context.'
              : fromZure
                ? 'さきほどの1枚を、この会社に残すための登録です。チャットはまだ開きません。'
                : fromTool
                  ? 'さきほどの点検結果を、自社の前提でそのまま受け取るための登録です。'
                  : 'さきほどの答え方を、自社の前提でそのまま受け取るための登録です。'}
          </p>
          {/* 2026-07-28 CTO修正（L1監査#16）: 「会社の登録は次の画面で」は、実際には
              この画面に会社名欄（任意）が既にあり、下の「はじめるまでの流れ」とも
              食い違っていた（ペルソナ2指摘）。実挙動（この画面でまとめて入力できる・
              未入力でも進める）に合わせて修正する。 */}
          <p className="mt-1 text-neutral-600">
            {isEn
              ? 'You can enter your company name on this same screen (optional, can add later). You can start with your first company for free.'
              : '会社名はこの画面でまとめて入力できます（未入力でもあとから登録できます）。まず1社ぶんから無料で始められます。'}
          </p>
        </div>
      )}

      <p className="mb-2 text-center text-sm text-neutral-600">
        {isEn ? 'Start free' : fromZure ? 'この1枚を残す' : '無料で始める'}
      </p>
      {!fromZure && (
        <p className="mb-4 text-center text-xs leading-relaxed text-neutral-500">
          {isEn ? (
            <>
              You can{' '}
              <Link href="/zure?lang=en" className="text-brand-600 underline underline-offset-2">
                place a work rules file first
              </Link>
              .
            </>
          ) : (
            <>
              <Link href="/zure" className="text-brand-600 underline underline-offset-2">
                先に就業規則のファイルを置く
              </Link>
              こともできます。
            </>
          )}
        </p>
      )}

      {/* 2026-07-25 CTO修正: 課金開始(BILLING_ENABLED=true)に合わせて「無料モニター期間」表記を撤去。
          直接流入（bare /signup）にも安心材料を1行出す。事実（この登録画面ではカード情報を収集しない・
          有料プランへの切り替えは会社ページからご自身の操作でのみ発生・アカウント削除と同時に全データ削除）
          の範囲のみ。 */}
      <p className="mb-4 text-center text-xs leading-relaxed text-neutral-500">
        {isEn
          ? 'Sign-up is free and does not require a credit card. You can switch to a paid plan yourself from the company page after signing up. All data can be deleted at the same time as account deletion.'
          : '登録は無料で、クレジットカードの登録も不要です。有料プランへの切り替えは、登録後に会社ページからご自身で行っていただきます。データはアカウント削除と同時にすべて削除できます。'}
      </p>

      {/* C02: OAuth（Google/GitHub）を主導線として先頭へ（メール登録より摩擦が少ない）。
          Supabase側のプロバイダ設定は有効を実測確認済み（/auth/v1/authorize が302）。
          2026-07-28 CTO修正（L2監査#5）: OAuthボタンの文言が?lang=enでも日本語の
          ままだった（ペルソナ6指摘・部分翻訳）。isEnを渡して英語化する。 */}
      {/* 2026-07-30 PMF修理#6: 日本語の新規登録画面ではGitHubを出さない（ICPである
          中小企業の総務担当にGitHubは無縁で、「開発者向け製品では」という違和感を生む）。
          英語圏（?lang=en / /business/en 経由）の流入にだけ従来どおり出す。
          既存のGitHub連携アカウントは /login で従来どおりログインできる（そちらは不変）。 */}
      {fromZure && !isEn && (
        <p className="mb-3 text-center text-xs leading-relaxed text-neutral-600">
          Googleで続ける場合、下のチェックボックスは不要です。
        </p>
      )}
      <OAuthButtons next={nextDest} isEn={isEn} showGithub={isEn} />
      <p className="mt-2 text-center text-xs text-neutral-500">
        {isEn
          ? 'Signing up with GitHub or Google is also treated as confirming business use (18+).'
          : 'Googleでの登録も、事業者としてのご利用（18歳以上）とみなします。'}
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-500">
        <div className="h-px flex-1 bg-neutral-200" />
        {isEn ? 'or sign up with email' : 'またはメールアドレスで登録'}
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      {/* 2026-07-27 growth施策(週次): signup_started→signup_completed完了率改善のための
          最小変更。フォーム項目・デザインは不変。フォーム直上に所要時間・カード不要を明示し、
          着手前の不確実性を消す（goal-gradient）。必須項目は既に email+password のみ
          （会社名は任意・氏名フィールドは無し）で、氏名・会社名・年齢確認の扱いは変更しない。 */}
      <p className="mb-3 text-center text-xs font-medium text-neutral-500">
        {isEn ? 'Takes about 1 minute · no credit card' : '入力は1分・クレジットカード不要'}
      </p>

      {/* 2026-07-28 CTO修正（L1監査#12）: ブラウザ表示言語依存の非日本語ネイティブ
          バリデーション（メール形式等）を封じ、下の一括検証（errors配列）に完全移管する。
          noValidate は挙動を変えない＝送信時に必ず handleSignup 側の検証を通る。 */}
      <form onSubmit={handleSignup} className="space-y-4" noValidate>
        {/* 2026-07-28 CTO修正（L2監査#1）: メール・パスワード欄がplaceholderのみに
            依存し、label/aria-labelもrequired/aria-required属性も無かった
            （ペルソナ8指摘。スクリーンリーダー利用者はプレースホルダー消失後に
            項目名が分からなくなる）。視覚デザイン（プレースホルダー表示）は不変のまま、
            sr-onlyのlabelとaria-requiredを追加する（native requiredは英語ツールチップを
            避けるため引き続き付けない＝L1監査#12の判断を継承）。 */}
        <div>
          <label htmlFor="signup-email" className="sr-only">
            {isEn ? 'Email address' : 'メールアドレス'}
          </label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={isEn ? 'Email address' : 'メールアドレス'}
            autoComplete="email"
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="sr-only">
            {isEn ? 'Password (8+ characters)' : 'パスワード（8文字以上）'}
          </label>
          <Input
            id="signup-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isEn ? 'Password (8+ characters)' : 'パスワード（8文字以上）'}
            autoComplete="new-password"
            aria-required="true"
          />
        </div>

        {/* C03: 会社名の統合入力（任意）。入力があれば登録直後に会社を作成して
            5問オンボーディングへ直行し、会社作成画面の1段を削減する。
            空のままでも従来フロー（/company で入力）で進める＝後方互換。
            2026-07-29 CTO修正（UX監査Round7#6）: メール・パスワード欄はsr-only
            <label htmlFor>を持つのに会社名欄はaria-labelのみで非対称だった。
            同じsr-only labelパターンへ揃える（視覚デザインは不変）。 */}
        <div>
          <label htmlFor="signup-company" className="sr-only">
            {isEn ? 'Company name (optional)' : '会社名（任意）'}
          </label>
          <Input
            id="signup-company"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder={isEn ? 'Company name (optional, can add later)' : '会社名（任意・あとでも入力できます）'}
            maxLength={100}
            autoComplete="organization"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {isEn
              ? 'If entered, you’ll go to the documents page right after signing up.'
              : '入力しておくと、登録後すぐに書類へ進めます。'}
          </p>
        </div>

        {/* 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け）。
            2026-07-28 CTO修正（L1監査#15）: 必須項目であることが視覚的に分かるよう
            アスタリスク(*)を付ける（チェック要件自体は不変）。 */}
        <label className="flex cursor-pointer items-start gap-3 py-3.5">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={e => setAgeOk(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-500 text-brand-600 focus:ring-brand-500/30"
            aria-required="true"
          />
          <span className="text-xs text-neutral-600">
            {isEn ? 'I am using this as a business (18+)' : '事業者として利用します（18歳以上）'}
            <span className="text-danger-600"> *</span>
          </span>
        </label>

        {/* 2026-07-28 CTO修正（L1監査#8）: 利用規約・プライバシーポリシーへの同意を
            注記文言だけでなく明示チェックボックスにする（機密の労務データを預ける
            契約という性質上、能動的な同意取得が必要というペルソナ10の指摘）。
            リンク先は ?lang=en のときのみ英語版に切り替える。 */}
        <label className="flex cursor-pointer items-start gap-3 py-3.5">
          <input
            type="checkbox"
            checked={consentOk}
            onChange={e => setConsentOk(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-500 text-brand-600 focus:ring-brand-500/30"
            aria-required="true"
          />
          <span className="text-xs text-neutral-600">
            {isEn ? (
              <>
                I agree to the{' '}
                <Link href="/terms/en" className="underline hover:text-neutral-700" target="_blank" rel="noopener noreferrer">Terms of Service</Link>{' '}
                and{' '}
                <Link href="/privacy/en" className="underline hover:text-neutral-700" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
              </>
            ) : (
              <>
                <Link href="/terms" className="underline hover:text-neutral-700" target="_blank" rel="noopener noreferrer">利用規約</Link>と
                <Link href="/privacy" className="underline hover:text-neutral-700" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>
                に同意します
              </>
            )}
            <span className="text-danger-600"> *</span>
          </span>
        </label>

        {/* 更新情報オプトイン */}
        <label className="flex cursor-pointer items-start gap-3 py-3.5">
          <input
            type="checkbox"
            checked={digestOptIn}
            onChange={e => setDigestOptIn(e.target.checked)}
            className="mt-0.5 accent-brand-600"
          />
          <span className="text-xs text-neutral-600">
            {isEn
              ? 'Receive product updates and labor-law news by email (optional, unsubscribe anytime)'
              : '就業規則AIの新機能・労務の最新情報をメールで受け取る（任意・いつでも停止可能）'}
          </span>
        </label>

        {/* 2026-07-28 CTO修正（L1監査#12）: 複数の不備がある場合は1行ずつ改行して
            まとめて表示する（従来は1件ずつ・直しては次が出る体験だった）。 */}
        {error && <p className="whitespace-pre-line text-sm text-danger-600">{error}</p>}

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
              {isEn ? 'Log in with this email address' : 'このメールアドレスでログインする'}
            </Link>
            {/* C11延長: パスワード忘れも行き止まりにしない（既登録→ログイン導線の補完）。 */}
            <p className="text-center text-xs text-neutral-500">
              {isEn ? (
                <>
                  Forgot your password?{' '}
                  <Link href="/forgot-password" className="underline hover:text-neutral-700">Reset it here</Link>.
                </>
              ) : (
                <>
                  パスワードを忘れた場合は{' '}
                  <Link href="/forgot-password" className="underline hover:text-neutral-700">こちらから再設定</Link>
                  できます。
                </>
              )}
            </p>
          </>
        )}

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading
            ? (isEn ? 'Signing up...' : '登録中...')
            : isEn
              ? 'Start free'
              : fromZure
                ? 'この1枚を残す'
                : '無料で始める'}
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
        <p className="mb-2.5 text-xs font-medium text-neutral-500">
          {isEn ? 'How it starts (about 1–2 minutes)' : 'はじめるまでの流れ（1〜2分ほど）'}
        </p>
        <ol className="space-y-2">
          {(isEn
            ? fromZure
              ? [
                  'Enter your email address and password',
                  'Enter one company name (you can do this on this same screen)',
                  'The one-page sheet is saved to your company documents',
                ]
              : [
                  'Enter your email address and password',
                  'Enter one company name (you can do this on this same screen)',
                  'Place your work rules file to get a one-page sheet',
                ]
            : fromZure
              ? [
                  'メールアドレスとパスワードを入力する',
                  '会社名を1つ登録する（この画面でまとめて入力できます）',
                  'さきほどの1枚が、会社の書類に残る',
                ]
              : [
                  'メールアドレスとパスワードを入力する',
                  '会社名を1つ登録する（この画面でまとめて入力できます）',
                  '就業規則のファイルを置くと、ずれの1枚が出る',
                ]
          ).map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-center text-sm text-neutral-500">
        {isEn ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">Log in</Link>
          </>
        ) : (
          <>
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">ログイン</Link>
          </>
        )}
      </p>

      {/* 2026-07-30 PMF修理#6: この画面にはヘッダが無く、料金・サービス概要への導線が
          1本も無かった（ロゴ→/business は (auth)/layout.tsx に既存）。登録の直前で
          「いくらかかるのか」を確かめたくなった人が、戻る手段を持たず離脱していた。
          広告・過剰な情報は足さず、料金と概要への細いリンクを1行だけ置く。 */}
      <p className="mt-2 text-center text-xs text-neutral-500">
        {isEn ? (
          <>
            <Link href="/pricing" className="underline underline-offset-2 hover:text-neutral-600">Check pricing</Link>
            <span className="mx-2">·</span>
            <Link href="/business/en" className="underline underline-offset-2 hover:text-neutral-600">What Banto does</Link>
          </>
        ) : (
          <>
            <Link href="/pricing" className="underline underline-offset-2 hover:text-neutral-600">料金を確認する</Link>
            <span className="mx-2">·</span>
            <Link href="/business" className="underline underline-offset-2 hover:text-neutral-600">サービス概要に戻る</Link>
          </>
        )}
      </p>
    </div>
  )
}
