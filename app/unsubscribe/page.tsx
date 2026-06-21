'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    async function unsubscribe() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('error')
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
            <Link href="/chat" className="mt-6 inline-block text-violet-400 hover:text-violet-300 text-sm">
              チャットに戻る →
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-2xl mb-4">❌</p>
            <h1 className="text-xl font-bold text-white mb-2">処理に失敗しました</h1>
            <p className="text-gray-400 text-sm">ログインしてから再度お試しください。</p>
            <Link href="/login" className="mt-6 inline-block text-violet-400 hover:text-violet-300 text-sm">
              ログイン →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
