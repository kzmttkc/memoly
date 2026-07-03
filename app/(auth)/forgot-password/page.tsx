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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    // メール存在オラクル遮断（CTO P2-1）:
    //   error の有無で「登録済みか」を推測させないよう、成否にかかわらず同一の
    //   「送信しました（該当すれば届きます）」を表示する。実送信は Supabase 側で
    //   登録済みメールにのみ行われるため、正規ユーザーの復帰導線は壊れない。
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-neutral-900">メールを送信しました</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          入力されたメールアドレスが登録済みの場合、{email} に再設定用リンクを送りました。メールを確認してください。
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
