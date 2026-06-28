'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // 番頭(Banto) の動線では /company へ。?next を尊重しつつ既定は /company。
  const next = searchParams.get('next') || '/company'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    } else {
      router.push(next.startsWith('/') ? next : '/company')
    }
  }

  return (
    <div>
      <p className="mb-6 text-center text-sm text-neutral-600">ログイン</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          autoComplete="email"
          required
        />
        <Input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
          required
        />

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? 'ログイン中...' : 'ログイン'}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-neutral-500">
        <p>
          アカウントがない方は{' '}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            新規登録
          </Link>
        </p>
        <p>
          <Link href="/forgot-password" className="text-neutral-500 hover:text-neutral-700">
            パスワードを忘れた方
          </Link>
        </p>
      </div>
    </div>
  )
}
