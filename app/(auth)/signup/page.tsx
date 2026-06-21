'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

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
      options: { emailRedirectTo: `${location.origin}/chat` },
    })

    if (error) {
      setError(error.message === 'User already registered' ? 'このメールアドレスはすでに登録されています。' : error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-4xl mb-4">📬</p>
        <h2 className="text-xl font-semibold mb-2">確認メールを送りました</h2>
        <p className="text-gray-400 text-sm">{email} に届いたリンクをクリックして登録を完了してください</p>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 13 - i)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold">
            <span className="text-violet-400">Memo</span>ly
          </Link>
          <p className="text-gray-400 mt-2 text-sm">アーリーアクセス登録</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            autoComplete="email"
            className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード（8文字以上）"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500"
          />

          {/* 年齢確認（COPPA / 個情法対応） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">生まれた年（年齢確認）</label>
            <select
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              required
              className="w-full bg-gray-800 text-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">選択してください</option>
              {years.map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? '登録中...' : '無料で始める'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-4">
          登録することで<Link href="/terms" className="underline hover:text-gray-400">利用規約</Link>と<Link href="/privacy" className="underline hover:text-gray-400">プライバシーポリシー</Link>に同意したものとみなします
        </p>

        <p className="text-center text-sm text-gray-500 mt-4">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300">ログイン</Link>
        </p>
      </div>
    </div>
  )
}
