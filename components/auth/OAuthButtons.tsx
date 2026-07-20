'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { buttonClass } from '@/components/ui/Button'

// GitHub / Google OAuth（Supabase Auth の外部プロバイダ）。
// Client ID/Secret は本アプリの env ではなく Supabase ダッシュボード
// （Authentication > Providers）側に設定する。ここは signInWithOAuth を
// 呼ぶだけで、Supabase がプロバイダの認可画面へリダイレクトする。
export function OAuthButtons({ next = '/company' }: { next?: string }) {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState('')

  async function signInWithProvider(provider: 'google' | 'github') {
    setError('')
    setLoadingProvider(provider)
    const supabase = createClient()
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/company'
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })
    if (error) {
      setError('連携ログインに失敗しました。時間をおいてもう一度お試しください。')
      setLoadingProvider(null)
    }
    // 成功時はプロバイダの認可画面へ遷移するのでここでは何もしない
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => signInWithProvider('google')}
        disabled={loadingProvider !== null}
        className={buttonClass({ variant: 'secondary', size: 'lg', className: 'w-full' })}
      >
        <GoogleMark />
        Googleで続ける
      </button>
      <button
        type="button"
        onClick={() => signInWithProvider('github')}
        disabled={loadingProvider !== null}
        className={buttonClass({ variant: 'secondary', size: 'lg', className: 'w-full' })}
      >
        <GitHubMark />
        GitHubで続ける
      </button>
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.9 6 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.9 6 29.7 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.6 0 10.6-2.1 14.5-5.5l-6.7-5.6C29.6 34.7 26.9 35.6 24 35.6c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.7 5.6C41.6 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
