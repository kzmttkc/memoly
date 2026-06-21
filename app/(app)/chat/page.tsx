'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const ONBOARDING_MESSAGE: Message = {
  role: 'assistant',
  content: 'こんにちは！私はMemolyです。会話を重ねるごとに、あなたのことを覚えていきます。\n\nまず教えてください — お仕事は何をされていますか？',
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function resetConversation() {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
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

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantContent += decoder.decode(value)
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: assistantContent },
          ])
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }]

      // 10メッセージごとに記憶保存（オンボーディングメッセージを除くカウント）
      const userMessages = finalMessages.filter(m => m.role === 'user')
      if (userMessages.length % 5 === 0) {
        fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: finalMessages }),
        })
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
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xl font-bold">
          <span className="text-violet-400">Memo</span>ly
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={resetConversation}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            新しい会話
          </button>
          <Link href="/memory" className="text-sm text-gray-400 hover:text-violet-400 transition-colors">
            記憶を見る
          </Link>
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
              {msg.content || <span className="opacity-50">...</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="px-4 py-4 border-t border-gray-800">
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
    </div>
  )
}
