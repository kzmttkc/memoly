'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  const [search, setSearch] = useState('')
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const router = useRouter()

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

  async function saveEdit(id: string) {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, value: editValue }),
    })
    setProfile(prev => prev.map(p => p.id === id ? { ...p, value: editValue } : p))
    setEditingId(null)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (res.ok) router.push('/?deleted=1')
    } finally {
      setDeleting(false)
      setShowDeleteAccount(false)
    }
  }

  const filteredMemories = useMemo(() =>
    memories.filter(m => m.content.toLowerCase().includes(search.toLowerCase())),
    [memories, search]
  )

  const filteredProfile = useMemo(() =>
    profile.filter(p =>
      p.key.toLowerCase().includes(search.toLowerCase()) ||
      p.value.toLowerCase().includes(search.toLowerCase())
    ),
    [profile, search]
  )

  // 「○ヶ月前の記憶」をランダムに1件取得
  const oldMemory = useMemo(() => {
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const old = memories.filter(m => new Date(m.created_at) < threeMonthsAgo)
    return old.length > 0 ? old[Math.floor(Math.random() * old.length)] : null
  }, [memories])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/chat" className="text-sm text-gray-500 hover:text-gray-300 mb-1 block">
            ← チャットに戻る
          </Link>
          <h1 className="text-2xl font-bold">
            <span className="text-violet-400">Memo</span>lyが覚えていること
          </h1>
        </div>
        <span className="text-xs text-gray-600">{memories.length + profile.length}件</span>
      </div>

      {/* 過去の記憶ハイライト */}
      {oldMemory && (
        <div className="bg-violet-950/40 border border-violet-800/30 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-violet-400 mb-1">
            {Math.floor((Date.now() - new Date(oldMemory.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))}ヶ月前の記憶
          </p>
          <p className="text-sm text-gray-300">{oldMemory.content}</p>
        </div>
      )}

      {/* 検索 */}
      {(memories.length > 0 || profile.length > 0) && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="記憶を検索..."
          className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-violet-500 mb-6"
        />
      )}

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
      {filteredProfile.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            あなたについて
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredProfile.map(p => (
              <div key={p.id} className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-violet-400 mb-1">{p.key}</p>
                {editingId === p.id ? (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id) }}
                      autoFocus
                      className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button onClick={() => saveEdit(p.id)} className="text-violet-400 text-xs hover:text-violet-300">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs hover:text-gray-300">キャンセル</button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-sm text-gray-100 cursor-pointer hover:text-violet-300 transition-colors"
                      onClick={() => { setEditingId(p.id); setEditValue(p.value) }}
                    >
                      {p.value}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setEditingId(p.id); setEditValue(p.value) }}
                        className="text-gray-600 hover:text-violet-400 transition-colors text-xs"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteItem(p.id, 'profile')}
                        className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 会話サマリー */}
      {filteredMemories.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            過去の会話
          </h2>
          <div className="space-y-3">
            {filteredMemories.map(m => (
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

      {/* フッター */}
      <div className="mt-12 pt-6 border-t border-gray-800 space-y-4">
        <div className="flex gap-4 text-xs text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400">プライバシーポリシー</Link>
          <Link href="/terms" className="hover:text-gray-400">利用規約</Link>
        </div>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="text-xs text-red-800 hover:text-red-500 transition-colors"
        >
          アカウントを削除する
        </button>
      </div>

      {/* アカウント削除確認ダイアログ */}
      {showDeleteAccount && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <p id="delete-account-title" className="text-white font-semibold mb-2">アカウントを削除しますか？</p>
            <p className="text-gray-400 text-sm mb-6">
              全ての記憶・会話・プロフィールデータが完全に削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAccount(false)}
                className="flex-1 py-2 border border-gray-600 text-gray-300 rounded-xl text-sm hover:border-gray-400 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
