'use client'

// 2026-07-25 CTO緊急修正 → 2026-07-26 是正: Turbopack(Next 16.2.9)の静的プリレンダが本ルートを
//   サイレントに直近の not-found 境界へ落としていた（ビルドはエラー無しで成功と表示するが
//   .next/server/app/login.html の実体が空の404ページになる既知の症状。/signup・
//   /forgot-password・/reset-password の(auth)グループ全ルートで同時に再現）。
//   `export const dynamic = 'force-dynamic'` をここ('use client'ファイル)に置いていたが、
//   Next.js のルートセグメント設定はサーバーコンポーネントからのエクスポートでなければ
//   効かないため無効だった（本番実測でプリレンダ配信が継続していたことが07-26に判明）。
//   宣言はグループ共通のサーバーコンポーネント app/(auth)/layout.tsx へ移設済み。詳細は同ファイル。
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { OAuthButtons } from '@/components/auth/OAuthButtons'

export default function LoginPage() {
  return (
    <Suspense fallback={<div aria-hidden className="min-h-[1px]" />}>
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
  // 2026-07-28 CTO修正（L2監査#5）: /signup?lang=en は言語出し分けに対応済みだが
  //   /loginは?lang=enパラメータ自体を無視し常に日本語だった（ペルソナ6指摘）。
  //   signupと同じ判定・同じ設計（ロジックは不変・表示文言のみ出し分け）を導入する。
  const isEn = searchParams.get('lang') === 'en'
  // signupと同様、直接遷移先(next)にlang=enを引き継ぐ（例: 既登録の再訪でsignupから
  // ログインへ回された英語ユーザーが、ログイン後も英語のまま次画面へ進めるように）。
  const langSuffix = isEn ? (next.includes('?') ? '&lang=en' : '?lang=en') : ''

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        isEn
          ? 'Incorrect email address or password.'
          : 'メールアドレスまたはパスワードが正しくありません',
      )
      setLoading(false)
    } else {
      // 相対パスのみ許可（'//evil.com' はプロトコル相対URL＝open redirect になるため除外）。
      router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/company')
    }
  }

  return (
    <div>
      {/* 2026-07-28 CTO修正（L2監査#1）: layout.tsxのブランド見出しは<Link>であり
          真の見出し(h1)ではなかった。/loginにも読み上げ専用のh1を追加する
          （視覚デザインは既存の"ログイン"文言のまま不変）。 */}
      <h1 className="sr-only">{isEn ? 'Log in to Banto' : '番頭(Banto) ログイン'}</h1>
      <p className="mb-6 text-center text-sm text-neutral-600">{isEn ? 'Log in' : 'ログイン'}</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="sr-only">
            {isEn ? 'Email address' : 'メールアドレス'}
          </label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={isEn ? 'Email address' : 'メールアドレス'}
            autoComplete="email"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="sr-only">
            {isEn ? 'Password' : 'パスワード'}
          </label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isEn ? 'Password' : 'パスワード'}
            autoComplete="current-password"
            required
            aria-required="true"
          />
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? (isEn ? 'Logging in...' : 'ログイン中...') : isEn ? 'Log in' : 'ログイン'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        {isEn ? 'or' : 'または'}
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <OAuthButtons next={next} isEn={isEn} />

      <div className="mt-6 space-y-2 text-center text-sm text-neutral-500">
        <p>
          {isEn ? (
            <>
              Don’t have an account?{' '}
              <Link
                href={`${next.startsWith('/') && !next.startsWith('//') ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}${langSuffix}`}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              アカウントがない方は{' '}
              {/* ログインに ?next= 付きで来た人が新規登録へ流れても行き先を失わないよう引き継ぐ */}
              <Link
                href={next.startsWith('/') && !next.startsWith('//') ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                新規登録
              </Link>
            </>
          )}
        </p>
        <p>
          <Link href={`/forgot-password${langSuffix}`} className="text-neutral-500 hover:text-neutral-700">
            {isEn ? 'Forgot your password?' : 'パスワードを忘れた方'}
          </Link>
        </p>
      </div>
    </div>
  )
}
