'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'done' | 'login' | 'error'>('loading')

  useEffect(() => {
    async function unsubscribe() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // メールのリンクから来た未ログイン状態。エラーではなくログイン誘導にする
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
            <p className="text-gray-400 text-sm">週次ダイジェストメールの配信を停止しました。</p>
            <Link href="/company" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ホームに戻る →
            </Link>
          </>
        )}
        {status === 'login' && (
          <>
            <p className="text-2xl mb-4">🔑</p>
            <h1 className="text-xl font-bold text-white mb-2">ログインが必要です</h1>
            <p className="text-gray-400 text-sm">配信停止を完了するには、ログインしてからこのページを開いてください。</p>
            <Link href="/login?next=/unsubscribe" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ログイン →
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-2xl mb-4">❌</p>
            <h1 className="text-xl font-bold text-white mb-2">処理に失敗しました</h1>
            <p className="text-gray-400 text-sm">時間をおいて再度お試しください。解決しない場合は kazumototakeshi@gmail.com までご連絡ください。</p>
            <Link href="/company" className="mt-6 inline-block text-gray-300 hover:text-white underline text-sm">
              ホームに戻る →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
