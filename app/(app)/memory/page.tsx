'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Memory {
  id: string
  content: string
  memory_type: string
  created_at: string
}

interface Profile {
  id: string
  key: string
  value: string
  updated_at: string
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [profile, setProfile] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => {
        setMemories(data.memories ?? [])
        setProfile(data.profile ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function deleteItem(id: string, type: 'memory' | 'profile') {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type }),
    })
    if (type === 'memory') setMemories(prev => prev.filter(m => m.id !== id))
    else setProfile(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/chat" className="text-sm text-gray-500 hover:text-gray-300 mb-1 block">
            ← チャットに戻る
          </Link>
          <h1 className="text-2xl font-bold">
            <span className="text-violet-400">Memo</span>lyが覚えていること
          </h1>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-center py-12">読み込み中...</p>}

      {!loading && profile.length === 0 && memories.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-4">🧠</p>
          <p>まだ記憶がありません</p>
          <p className="text-sm mt-2">チャットを続けると、あなたのことを覚えていきます</p>
          <Link href="/chat" className="mt-6 inline-block text-violet-400 hover:text-violet-300">
            チャットを始める →
          </Link>
        </div>
      )}

      {/* プロファイル属性 */}
      {profile.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            あなたについて
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.map(p => (
              <div key={p.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-violet-400 mb-1">{p.key}</p>
                  <p className="text-sm text-gray-100">{p.value}</p>
                </div>
                <button
                  onClick={() => deleteItem(p.id, 'profile')}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs mt-1 shrink-0"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 会話サマリー */}
      {memories.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            過去の会話
          </h2>
          <div className="space-y-3">
            {memories.map(m => (
              <div key={m.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-100 leading-relaxed">{m.content}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {new Date(m.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(m.id, 'memory')}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs mt-1 shrink-0"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
