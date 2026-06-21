'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })
    if (error) {
      setError('メールの送信に失敗しました。メールアドレスを確認してください。')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-4xl mb-4">📬</p>
          <h1 className="text-xl font-bold text-white mb-2">メールを送信しました</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {email} に再設定用リンクを送りました。<br />メールを確認してください。
          </p>
          <Link href="/login" className="mt-6 inline-block text-violet-400 hover:text-violet-300 text-sm">
            ← ログインに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-violet-400">Memo</span><span className="text-white">ly</span>
          </Link>
          <h1 className="text-xl font-semibold text-white mt-4">パスワードの再設定</h1>
          <p className="text-gray-400 text-sm mt-1">登録したメールアドレスを入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? '送信中...' : '再設定メールを送る'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="text-gray-400 hover:text-gray-300">← ログインに戻る</Link>
        </p>
      </div>
    </div>
  )
}
