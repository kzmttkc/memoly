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

const SAMPLE_PROMPTS = [
  '今週の仕事の悩みを聞いて',
  '私の1週間を振り返りたい',
  '明日の優先タスクを整理して',
  '最近気になっていることを話したい',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [memoryCount, setMemoryCount] = useState<number | null>(null)
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // 記憶件数を取得
  useEffect(() => {
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => {
        const count = (data.memories?.length ?? 0) + (data.profile?.length ?? 0)
        setMemoryCount(count)
      })
      .catch(() => {})
  }, [])

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
    const countMsg = memoryCount && memoryCount > 0
      ? `新しい会話を始めます。\n\nMemolyはあなたの${memoryCount}件の記憶を保持しています。前回の続きもいつでも話せます。`
      : 'こんにちは！私はMemolyです。会話を重ねるごとに、あなたのことを覚えていきます。\n\nまず教えてください — お仕事は何をされていますか？'
    setMessages([{ role: 'assistant', content: countMsg }])
    setInput('')
    setIsFirstMessage(true)
  }

  async function saveMemory(msgs: Message[]) {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      if (res.ok) {
        const data = await res.json()
        // 具体的な内容をトーストで表示
        const extracted = data.extraction
        if (extracted?.profile && Object.keys(extracted.profile).length > 0) {
          const [key, val] = Object.entries(extracted.profile)[0] as [string, string]
          showToast(`「${key}：${val}」を記憶しました`)
        } else if (extracted?.summary) {
          showToast('会話を記憶しました')
        } else {
          showToast('記憶を更新しました')
        }
        // バッジカウントを更新
        setMemoryCount(prev => (prev ?? 0) + 1)
      }
    } catch {}
  }

  async function sendMessage(text?: string) {
    const content = text ?? input
    if (!content.trim() || loading) return

    setIsFirstMessage(false)
    const userMessage: Message = { role: 'user', content }
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
    <div className="flex flex-col max-w-3xl mx-auto" style={{ height: '100dvh' }}>
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-violet-400">Memo</span>ly
          </span>
          {memoryCount !== null && memoryCount > 0 && (
            <Link
              href="/memory"
              className="text-xs bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded-full hover:bg-violet-800/60 transition-colors"
            >
              記憶 {memoryCount}件
            </Link>
          )}
        </div>
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

        {/* 初回サンプルプロンプトチップ */}
        {isFirstMessage && messages.length === 1 && (
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {SAMPLE_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* AI免責テキスト */}
      <p className="text-center text-xs text-gray-700 px-4 pb-1 shrink-0">
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
            onClick={() => sendMessage()}
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
            <p className="text-gray-400 text-sm mb-6">
              現在の会話履歴は消えます。
              {memoryCount && memoryCount > 0
                ? `記憶（${memoryCount}件）はそのまま保持されます。`
                : '記憶はMemory Dashboardに保存されます。'}
            </p>
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

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
