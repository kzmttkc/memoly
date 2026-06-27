'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-neutral-900">メールを送信しました</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          {email} に再設定用リンクを送りました。<br />メールを確認してください。
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-brand-600 hover:text-brand-700"
        >
          ログインに戻る
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">パスワードの再設定</h1>
        <p className="mt-1 text-sm text-neutral-600">
          登録したメールアドレスを入力してください
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          autoComplete="email"
          required
        />
        {error && <p className="text-xs text-danger-600">{error}</p>}
        <Button type="submit" size="lg" disabled={loading || !email} className="w-full">
          {loading ? '送信中...' : '再設定メールを送る'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        <Link href="/login" className="text-neutral-500 hover:text-neutral-700">
          ログインに戻る
        </Link>
      </p>
    </div>
  )
}
