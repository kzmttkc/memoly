'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Building2, Send, BookmarkPlus, Check, X } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { detectDecisionSignal } from '@/lib/decision-detect'
import { track } from '@/lib/analytics'
import { CompanySwitcher } from '../_components/CompanySwitcher'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/chat — 会社スコープのチャット
//   常時表示: 「この会社専用」バッジ + 「参照中の自社ルールn件」（混線しない安心感）。
//   ?q= で初期質問を受け取り自動送信（リスク診断からの「この内容で相談」導線）。
//   POST /api/company/chat に { messages, companyId } を投げ、ストリーム表示。
//   一定往復ごとに /api/company/memory で自社事実の抽出を起動。
// ============================================================================

interface Message {
  role: 'user' | 'assistant'
  content: string
  isTyping?: boolean
}

const ONBOARDING_MESSAGE: Message = {
  role: 'assistant',
  content:
    'こんにちは。この会社専用の労務AIです。登録された自社ルール（所定労働時間・36協定の状況など）を前提に相談に答えます。\n\nまず、いま気になっている労務の疑問を教えてください。',
}

const SAMPLE_PROMPTS = [
  '残業代の割増率は自社だとどうなる？',
  '有給の付与日数を確認したい',
  '36協定が未締結だと何が問題？',
  '今月の給与計算で気をつける点は？',
]

const MEMORY_TRIGGER_EVERY = 4

function CompanyChat() {
  const params = useSearchParams()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''
  const initialQ = params.get('q') ?? ''

  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [ruleCount, setRuleCount] = useState<number | null>(null)
  // 判断採取フック（TOP5 #1）: 番頭が「この方針を記録しますか？」と能動提案する状態。
  //   reason=提案理由ラベル / savingDecision=保存中 / dismissed=この往復では再提示しない。
  const [decisionPrompt, setDecisionPrompt] = useState<{ reason: string } | null>(null)
  const [savingDecision, setSavingDecision] = useState(false)
  const conversationIdRef = useRef<string | null>(null)
  const lastExtractedAtRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)
  // 判断採取の対象となる「直近の確定済み会話」（保存時にこの内容をサーバへ送る）。
  const decisionMessagesRef = useRef<Message[]>([])

  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 参照中の自社ルール件数を取得（常時表示の安心材料）。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/profile?companyId=${companyId}`)
        if (!r.ok) {
          if (!cancelled) setRuleCount(null)
          return
        }
        const d = await r.json()
        if (!cancelled) setRuleCount((d.profiles ?? []).length)
      } catch {
        if (!cancelled) setRuleCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // 顧問先を切り替えたら会話状態をリセット（記憶の混線防止）。
  useEffect(() => {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
    setIsFirstMessage(true)
    setDecisionPrompt(null)
    conversationIdRef.current = null
    lastExtractedAtRef.current = 0
    autoSentRef.current = false
  }, [companyId])

  const extractFacts = useCallback(
    async (msgs: Message[]) => {
      try {
        const res = await fetch('/api/company/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.savedRuleCandidates > 0) {
          showToast(`自社の事実を${data.savedRuleCandidates}件、覚える候補にしました`)
        }
      } catch {
        // 抽出失敗はサイレント
      }
    },
    [companyId, showToast],
  )

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = text ?? input
      if (!content.trim() || loading || !companyId) return

      setIsFirstMessage(false)
      const userMessage: Message = { role: 'user', content }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')
      setLoading(true)

      try {
        const res = await fetch('/api/company/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            companyId,
            conversationId: conversationIdRef.current,
          }),
        })

        if (res.status === 409) {
          setLoading(false)
          router.push('/company')
          return
        }
        if (res.status === 403) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'この会社にアクセスする権限がありません。' }])
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error('Chat failed')

        const convId = res.headers.get('X-Conversation-Id')
        if (convId) conversationIdRef.current = convId

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

        const finalMessages: Message[] = [
          ...newMessages,
          { role: 'assistant', content: assistantContent },
        ]
        const userCount = finalMessages.filter(m => m.role === 'user').length
        if (
          userCount >= MEMORY_TRIGGER_EVERY &&
          userCount - lastExtractedAtRef.current >= MEMORY_TRIGGER_EVERY
        ) {
          lastExtractedAtRef.current = userCount
          extractFacts(finalMessages)
        }

        // --- 判断採取フック（TOP5 #1）: 番頭側から能動的に「記録しますか？」を提案 ---
        //   追加のLLM呼び出しはせず、軽量ヒューリスティックで“出すか”だけ判定する。
        //   出すと決めたら、保存対象としてこの確定会話を控える（human-in-the-loop）。
        const signal = detectDecisionSignal(
          finalMessages.map(m => ({ role: m.role, content: m.content })),
        )
        if (signal.suggest) {
          decisionMessagesRef.current = finalMessages
          setDecisionPrompt({ reason: signal.reason })
        }
      } catch {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '接続に失敗しました。もう一度お試しください。' },
        ])
      } finally {
        setLoading(false)
      }
    },
    [input, loading, companyId, messages, router, extractFacts],
  )

  // 判断採取の確定保存（ユーザーが「記録する」を押したときだけ呼ぶ＝human-in-the-loop）。
  //   サーバは既存 extractCompanyMemory（1パス）で topic/subject を構造化し decision 保存。
  const saveDecision = useCallback(async () => {
    if (savingDecision || !companyId) return
    const msgs = decisionMessagesRef.current
    if (!msgs.length) {
      setDecisionPrompt(null)
      return
    }
    setSavingDecision(true)
    try {
      const res = await fetch('/api/company/memory?action=decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.saved) {
        // 計測: 判断採取の保存成功＝蓄積の核イベント。生本文/氏名/topicラベルは送らず、
        // topicが付いたか(非PIIのbool)だけ記録する。
        track('judgment_captured', { has_topic: Boolean(data.decision?.topic) })
        showToast('この方針を会社の記憶に残しました')
      } else {
        showToast(data.error ?? '記録できませんでした')
      }
    } catch {
      showToast('記録できませんでした。通信を確認してください。')
    } finally {
      setSavingDecision(false)
      setDecisionPrompt(null)
    }
  }, [savingDecision, companyId, showToast])

  // ?q= の初回自動送信（リスク診断などからの誘導）。1回だけ。
  useEffect(() => {
    if (initialQ && !autoSentRef.current && companyId) {
      autoSentRef.current = true
      sendMessage(initialQ)
    }
  }, [initialQ, companyId, sendMessage])

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: 'calc(100dvh - 8rem)' }}>
      {/* この会社専用 / 参照ルール件数（常時表示） */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          この会社専用
        </Badge>
        {ruleCount !== null && (
          <Badge tone="neutral">
            <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
            参照中の自社ルール {ruleCount}件
          </Badge>
        )}
        <div className="ml-auto sm:hidden">
          <CompanySwitcher companyId={companyId} variant="header" />
        </div>
      </div>

      <div
        className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4"
        role="log"
        aria-live="polite"
        aria-label="チャット履歴"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-brand-600 text-white'
                  : 'rounded-bl-sm bg-neutral-100 text-neutral-900'
              }`}
            >
              {msg.isTyping ? (
                <span className="flex h-4 items-center gap-1" aria-label="入力中">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isFirstMessage && messages.length === 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="相談の始め方の例">
            {SAMPLE_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 判断採取フック（TOP5 #1）: 番頭が能動的に「この方針を記録しますか？」と促す。
          押したときだけサーバが decision として構造化保存する（自動保存しない＝誤記憶防止）。 */}
      {decisionPrompt && !loading && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-2">
            <BookmarkPlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                この方針を会社の記憶に残しますか？
              </p>
              <p className="text-xs text-neutral-600">
                {decisionPrompt.reason}。担当者が代わっても番頭が覚えています。
              </p>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto sm:shrink-0">
            <Button size="sm" onClick={saveDecision} disabled={savingDecision}>
              <Check className="h-4 w-4" aria-hidden />
              {savingDecision ? '記録中...' : '記録する'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDecisionPrompt(null)}
              disabled={savingDecision}
              aria-label="記録しない"
            >
              <X className="h-4 w-4" aria-hidden />
              いいえ
            </Button>
          </div>
        </div>
      )}

      <p className="px-1 pb-1 pt-2 text-center text-xs text-neutral-400">
        AIの回答は参考情報です。重要な判断は社会保険労務士など専門家にご相談ください。
      </p>

      <div className="flex gap-2 pt-1">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="自社の労務について相談... (Enterで送信)"
          rows={1}
          aria-label="メッセージを入力"
          className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <Button
          size="lg"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          aria-label="送信"
        >
          <Send className="h-4 w-4" aria-hidden />
          {loading ? '...' : '送信'}
        </Button>
      </div>

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function CompanyChatPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <CompanyChat />
      </CompanyGuard>
    </Suspense>
  )
}
