'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
  const [birthYear, setBirthYear] = useState('')
  const [digestOptIn, setDigestOptIn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const searchParams = useSearchParams()
  // 番頭(Banto) の動線では確認後に /company へ。?next を尊重しつつ既定は /company。
  const nextRaw = searchParams.get('next') || '/company'
  const next = nextRaw.startsWith('/') ? nextRaw : '/company'

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 年齢確認（13歳以上）
    const year = parseInt(birthYear, 10)
    const currentYear = new Date().getFullYear()
    if (!year || currentYear - year < 13) {
      setError('本サービスは13歳以上の方のみご利用いただけます。')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}${next}`,
        data: { digest_unsubscribed: !digestOptIn },
      },
    })

    if (error) {
      setError(error.message === 'User already registered' ? 'このメールアドレスはすでに登録されています。' : error.message)
      setLoading(false)
    } else {
      // 活性化ファネル: 登録完了（email+password の signUp 成功地点）
      // PII は送らない。確認メール送信前のサインアップ確定をカウント
      track('signup_completed')
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">確認メールを送りました</h2>
        <p className="text-sm text-neutral-600">
          {email} に届いたリンクをクリックして登録を完了してください
        </p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 13 - i)

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

        {/* 年齢確認（COPPA / 個情法対応） */}
        <div>
          <label htmlFor="birthYear" className="mb-1.5 block text-xs text-neutral-500">
            生まれた年（年齢確認）
          </label>
          <select
            id="birthYear"
            value={birthYear}
            onChange={e => setBirthYear(e.target.value)}
            required
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">選択してください</option>
            {years.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>

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
