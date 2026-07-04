'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track, trackThenNavigate } from '@/lib/analytics'
import { Input } from '@/components/ui/Input'
import { Button, buttonClass } from '@/components/ui/Button'

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageOk, setAgeOk] = useState(false)
  const [digestOptIn, setDigestOptIn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // 番頭(Banto) の動線では確認後に /company へ。?next を尊重しつつ既定は /company。
  const nextRaw = searchParams.get('next') || '/company'
  const next = nextRaw.startsWith('/') ? nextRaw : '/company'

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

  // 計測: 登録フォーム到達（/signup の pageview とは別に「signUp 試行の母数」を明示）。
  //   これで 登録フォーム到達→完了/失敗 の各段が Plausible で読める。PIIは送らない。
  //   attribution(source/campaign)が有れば付与＝流入元別コンバージョンが読める。
  useEffect(() => {
    track('signup_started', Object.keys(attribution).length ? attribution : undefined)
  }, [attribution])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け）
    if (!ageOk) {
      setError('事業者としてのご利用（18歳以上）に同意のうえチェックをお願いします。')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}${next}`,
        data: { digest_unsubscribed: !digestOptIn },
      },
    })

    if (error) {
      const already = error.message === 'User already registered'
      // 計測: 登録失敗を可視化（今まで完全に不可視だった）。既登録の再訪＝ログイン迷子は別問題として切り分け。
      track('signup_failed', { reason: already ? 'already_registered' : 'other', ...attribution })
      setError(already ? 'このメールアドレスはすでに登録されています。' : error.message)
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
        trackThenNavigate('signup_completed', () => router.push(next), Object.keys(attribution).length ? attribution : undefined)
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
            trackThenNavigate('signup_completed', () => router.push(next), Object.keys(attribution).length ? attribution : undefined)
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
      options: { emailRedirectTo: `${location.origin}${next}` },
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

          <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass({ variant: 'ghost', size: 'lg', className: 'w-full' })}>
            ログイン画面へ
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <p className="mb-6 text-center text-sm text-neutral-600">無料で始める</p>

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

        {/* 利用主体・年齢の確認（COPPA / 個情法対応・事業者向け） */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={e => setAgeOk(e.target.checked)}
            required
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

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? '登録中...' : '無料で始める'}
        </Button>
      </form>

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
