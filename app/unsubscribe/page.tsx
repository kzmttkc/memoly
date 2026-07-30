'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

// ============================================================================
// /unsubscribe — 配信停止（人が踏む画面）
//   2026-07-30 法務監査#4 の是正: メールのリンクには署名付き ?token= が載る。
//   token があればログインを一切求めずに停止する（メール受信者は別端末・
//   メールアプリ内蔵ブラウザで開くのが普通で、ログイン必須では止められない）。
//   token が無い場合だけ、従来どおりログイン状態で自分の配信を止める。
//   ※ useSearchParams ではなく window.location から読む（Suspense 境界を増やさず、
//     この画面が静的に描画できる状態を保つため）。
// ============================================================================

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'done' | 'login' | 'error'>('loading')

  useEffect(() => {
    async function unsubscribe() {
      const token = new URLSearchParams(window.location.search).get('token')

      if (token) {
        // 認証不要の経路。ログインしていなくても確実に止まる。
        const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, {
          method: 'POST',
        })
        setStatus(res.ok ? 'done' : 'error')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // token の無い直接アクセス。エラーではなくログイン誘導にする
        setStatus('login')
        return
      }
      const res = await fetch('/api/unsubscribe', { method: 'POST' })
      setStatus(res.ok ? 'done' : 'error')
    }
    unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {status === 'loading' && <p className="text-gray-400">処理中...</p>}
        {status === 'done' && (
          <>
            <p className="text-2xl mb-4">✅</p>
            <h1 className="text-xl font-bold text-white mb-2">配信停止しました</h1>
            <p className="text-gray-400 text-sm">このメールの配信を停止しました。設定はいつでもアカウント画面から戻せます。</p>
            <Link href="/company" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ホームに戻る →
            </Link>
          </>
        )}
        {status === 'login' && (
          <>
            <p className="text-2xl mb-4">🔑</p>
            <h1 className="text-xl font-bold text-white mb-2">ログインが必要です</h1>
            <p className="text-gray-400 text-sm">配信停止を完了するには、ログインしてからこのページを開いてください。お手元のメールに記載の「配信停止はこちら」から開くと、ログインなしで停止できます。</p>
            <Link href="/login?next=/unsubscribe" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ログイン →
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-2xl mb-4">❌</p>
            <h1 className="text-xl font-bold text-white mb-2">処理に失敗しました</h1>
            <p className="text-gray-400 text-sm">時間をおいて再度お試しください。解決しない場合は support@banto-roumu.com までご連絡ください。</p>
            <Link href="/company" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ホームに戻る →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
