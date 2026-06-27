'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('パスワードの更新に失敗しました。リンクが期限切れの可能性があります。')
      setLoading(false)
    } else {
      router.push('/company')
    }
  }

  return (
    <div>
      <p className="mb-6 text-center text-sm text-neutral-600">新しいパスワードを設定</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="新しいパスワード（8文字以上）"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && <p className="text-xs text-danger-600">{error}</p>}
        <Button type="submit" size="lg" disabled={loading || !password} className="w-full">
          {loading ? '更新中...' : 'パスワードを更新する'}
        </Button>
      </form>
    </div>
  )
}
