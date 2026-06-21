'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/ui/Toast'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
}

const ONBOARDING_MESSAGE: Message = {
  role: 'assistant',
  content: 'こんにちは！私はMemolyです。会話を重ねるごとに、あなたのことを覚えていきます。\n\nまず教えてください — お仕事は何をされていますか？',
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  function resetConversation() {
    setShowResetConfirm(false)
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
  }

  async function saveMemory(msgs: Message[]) {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      if (res.ok) showToast('記憶を更新しました')
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) throw new Error('Chat failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      // タイピングアニメーション開始
      setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantContent += decoder.decode(value)
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: assistantContent, isTyping: false },
          ])
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }]

      // 初回は3メッセージ後、以降は5往復ごとに記憶保存
      const userCount = finalMessages.filter(m => m.role === 'user').length
      if (userCount === 3 || (userCount > 3 && userCount % 5 === 0)) {
        saveMemory(finalMessages)
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '接続に失敗しました。もう一度お試しください。' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <span className="text-xl font-bold">
          <span className="text-violet-400">Memo</span>ly
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            新しい会話
          </button>
          <Link href="/memory" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
            記憶を見る
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-100 rounded-bl-sm'
            }`}>
              {msg.isTyping ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* AI免責テキスト */}
      <p className="text-center text-xs text-gray-700 px-4 pb-1">
        AIの回答は参考情報です。重要な判断は専門家にご相談ください。
      </p>

      {/* 入力エリア */}
      <div className="px-4 py-3 border-t border-gray-800 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="メッセージを入力... (Enterで送信)"
            rows={1}
            className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-sm font-medium"
          >
            {loading ? '...' : '送信'}
          </button>
        </div>
      </div>

      {/* リセット確認ダイアログ */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-white font-semibold mb-2">会話をリセットしますか？</p>
            <p className="text-gray-400 text-sm mb-6">現在の会話履歴は消えます。記憶はMemory Dashboardに保存されます。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 border border-gray-600 text-gray-300 rounded-xl text-sm hover:border-gray-400 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={resetConversation}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
