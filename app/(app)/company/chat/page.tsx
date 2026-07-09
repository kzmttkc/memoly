'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Building2, Send, BookmarkPlus, Check, X, LogIn, MessageSquarePlus, FileText } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button, buttonClass } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { detectDecisionSignal } from '@/lib/decision-detect'
import type { CompanyAttributesRow } from '@/lib/company-attributes'
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

// サンプル質問のオンボ回答連動（UX-2）: company_attributes（オンボ5問の回答）から
// 「この会社がいま一番つまずきやすい質問」を決定的に組み立てる。
//   LLM 非依存・分岐は attributes の値のみ＝毎回同じ入力なら同じ4問（チラつかない）。
//   attributes 未登録/取得失敗時は呼び出し側で固定4問（SAMPLE_PROMPTS）にフォールバック。
function buildSamplePrompts(attrs: CompanyAttributesRow): string[] {
  const prompts: string[] = []
  // 36協定が「ない/不明」は放置リスクが最大級 → 必ず先頭に置く。
  if (attrs.has_36kyotei !== true) {
    prompts.push('36協定を結んでいない場合、何が問題になりますか？')
  }
  if (attrs.has_fixed_ot === true) {
    prompts.push('固定残業代の運用で気をつける点は？')
  }
  // 10人未満なら「就業規則の作成義務はどこから？」が定番のつまずき。
  if (attrs.employee_band === '1-4' || attrs.employee_band === '5-9') {
    prompts.push('従業員10人未満でも就業規則は必要？')
  } else if (attrs.has_work_rules === false) {
    prompts.push('就業規則を作るには何から始めればいい？')
  }
  // 残り枠は固定4問から補充（36協定の重複だけ除外＝同テーマが2枚並ぶのを防ぐ）。
  for (const p of SAMPLE_PROMPTS) {
    if (prompts.length >= 4) break
    if (p.includes('36協定') && prompts.some(q => q.includes('36協定'))) continue
    prompts.push(p)
  }
  return prompts.slice(0, 4)
}

// 文脈アクションチップ（UX-4）: 回答に規程系の語が含まれるときだけ「規程ドラフトの下書き」
// へ連結する判定。lib/digest.ts toCards の draftable 判定と同じ発想
// （あちらは非exportのローカル定義のため、こちらも指示された4語でローカル定義）。
const DRAFTABLE_RE = /就業規則|規程|36協定|労使協定/

// 記憶抽出のトリガ間隔（ユーザー発話n回ごと）。4→2に短縮:
//   3往復未満で離脱した会話が一度も記憶化されない問題の暫定緩和
//   （サーバ側抽出への移行は別タスク。ここではクライアント起点のまま間隔だけ詰める）。
const MEMORY_TRIGGER_EVERY = 2

function CompanyChat() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''
  const initialQ = params.get('q') ?? ''

  const [messages, setMessages] = useState<Message[]>([ONBOARDING_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [ruleCount, setRuleCount] = useState<number | null>(null)
  // 本日の残り相談回数（P2・429の事前告知）。null=未取得/取得失敗（バッジ非表示）。
  const [chatRemaining, setChatRemaining] = useState<{ remaining: number; limit: number } | null>(null)
  // サンプル質問（UX-2）: 既定は固定4問。attributes が取れたら会社に合わせて出し分け。
  const [samplePrompts, setSamplePrompts] = useState<string[]>(SAMPLE_PROMPTS)
  // 判断採取フック（TOP5 #1）: 番頭が「この方針を記録しますか？」と能動提案する状態。
  //   reason=提案理由ラベル / savingDecision=保存中 / dismissed=この往復では再提示しない。
  const [decisionPrompt, setDecisionPrompt] = useState<{ reason: string } | null>(null)
  const [savingDecision, setSavingDecision] = useState(false)
  // 401（セッション失効）の袋小路防止: 汎用エラーに潰さず、再ログイン導線を明示する。
  const [sessionExpired, setSessionExpired] = useState(false)
  // 会話の継続性（P1-3）: マウント時に直近会話を復元中か / 復元した会話のタイトル。
  //   restoring 中はサンプル質問を出さない（復元結果で上書きされるチラつき防止）。
  const [restoring, setRestoring] = useState(false)
  const [resumedTitle, setResumedTitle] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const lastExtractedAtRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSentRef = useRef(false)
  // 判断採取の対象となる「直近の確定済み会話」（保存時にこの内容をサーバへ送る）。
  const decisionMessagesRef = useRef<Message[]>([])
  // 離脱時の未抽出フラッシュ（F2）用: イベントハンドラから最新の会話を参照するための鏡。
  const messagesRef = useRef<Message[]>(messages)

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

  // 本日の残り相談回数を取得（P2・429の事前告知）。取得失敗時はバッジを出さない。
  const refreshUsage = useCallback(async () => {
    if (!companyId) return
    try {
      const r = await fetch(`/api/company/usage?companyId=${companyId}&kind=chat`)
      if (!r.ok) return
      const d = await r.json()
      if (typeof d.remaining === 'number' && typeof d.limit === 'number') {
        setChatRemaining({ remaining: d.remaining, limit: d.limit })
      }
    } catch {
      // 取得失敗はサイレント（残回数は補助情報。出せないだけで相談は妨げない）
    }
  }, [companyId])

  // 初回マウント時の残回数取得（ruleCount と同じ inline-IIFE パターン）。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/usage?companyId=${companyId}&kind=chat`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled && typeof d.remaining === 'number' && typeof d.limit === 'number') {
          setChatRemaining({ remaining: d.remaining, limit: d.limit })
        }
      } catch {
        // 取得失敗はサイレント（残回数は補助情報）
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // サンプル質問のオンボ回答連動（UX-2）: attributes から会社に合う4問を決定的に組み立てる。
  //   未登録（attributes: null）・取得失敗時は固定4問のまま＝現行挙動にフォールバック。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/attributes?companyId=${companyId}`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled && d.attributes) {
          setSamplePrompts(buildSamplePrompts(d.attributes as CompanyAttributesRow))
        }
      } catch {
        // フォールバック: 固定4問のまま（サンプル質問が出ないより出るほうが良い）
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  // 離脱時フラッシュ（F2）用の鏡: messages の最新値を常に ref に写す。
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 初回記憶の取りこぼしゼロ化（F2-b）: タブ非表示/ページ離脱の瞬間に、まだ記憶抽出して
  // いないユーザー発話が残っていれば navigator.sendBeacon で /api/company/memory へ送る。
  //   fetch は unload 中に打ち切られ得るが、sendBeacon はページ終了後も送信が継続される。
  //   payload は既存 extractFacts と同一形式（{ companyId, messages }）。sendBeacon は
  //   Content-Type を直接指定できないため、Blob に application/json を持たせて渡す。
  useEffect(() => {
    if (!companyId) return
    const flushPendingExtraction = () => {
      const msgs = messagesRef.current
      const userCount = msgs.filter(m => m.role === 'user').length
      if (userCount === 0 || userCount <= lastExtractedAtRef.current) return // 未抽出なし
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return
      const payload = new Blob(
        [
          JSON.stringify({
            companyId,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          }),
        ],
        { type: 'application/json' },
      )
      // 送れたら抽出済み扱いにする（hidden→visible→hidden の往復で二重送信しない）。
      if (navigator.sendBeacon('/api/company/memory', payload)) {
        lastExtractedAtRef.current = userCount
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingExtraction()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushPendingExtraction)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushPendingExtraction)
    }
  }, [companyId])

  // 顧問先を切り替えたら会話状態をリセット（記憶の混線防止）したうえで、
  // 当該会社の「直近の会話」を復元する（P1-3 会話の継続性）。
  //   保存自体は /api/company/chat が毎往復行っているのに参照UIが無く、
  //   リロード/再訪のたびにまっさらに戻っていた問題への対処。
  //   ?q= 付き遷移（リスク診断からの「この内容で相談」等）は“新しい相談”の意図なので
  //   復元せず、従来どおり自動送信で新規会話を始める。
  useEffect(() => {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
    setIsFirstMessage(true)
    setDecisionPrompt(null)
    setSessionExpired(false)
    setResumedTitle(null)
    conversationIdRef.current = null
    lastExtractedAtRef.current = 0
    autoSentRef.current = false

    if (!companyId || initialQ) return

    let cancelled = false
    setRestoring(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/company/conversations?companyId=${companyId}&latest=1`)
        if (!r.ok) return // 復元失敗は新規状態のまま（エラー表示で相談開始を妨げない）
        const d = await r.json()
        if (cancelled || !d.conversation || !Array.isArray(d.messages) || d.messages.length === 0) return
        const history: Message[] = d.messages
          .filter((m: Message) => m.role === 'user' || m.role === 'assistant')
          .map((m: Message) => ({ role: m.role, content: String(m.content) }))
        if (history.length === 0) return
        conversationIdRef.current = d.conversation.id
        setMessages([ONBOARDING_MESSAGE, ...history])
        setIsFirstMessage(false)
        setResumedTitle(d.conversation.title ?? '前回の相談')
        // 復元分のユーザー発話は抽出済みとみなす（再抽出による記憶の重複を防ぐ）。
        lastExtractedAtRef.current = history.filter(m => m.role === 'user').length
      } catch {
        // 復元失敗はサイレント（新規状態で開始できることが最優先）
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, initialQ])

  // 「新しい相談を始める」: 復元済み/進行中の会話を離れ、新規会話に切り替える。
  //   サーバ側は conversationId 未指定の送信で新規 company_conversations を作るため、
  //   クライアントは状態を初期化するだけでよい（過去の会話は消えず保存されたまま）。
  const startNewConversation = useCallback(() => {
    setMessages([ONBOARDING_MESSAGE])
    setInput('')
    setIsFirstMessage(true)
    setDecisionPrompt(null)
    setResumedTitle(null)
    conversationIdRef.current = null
    lastExtractedAtRef.current = 0
  }, [])

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
        // 429: 本日の利用上限。API が返す上限メッセージをそのまま出し、再試行を促さない
        //   （「接続に失敗しました。もう一度」に潰すと、何度送っても失敗する袋小路になる）。
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}))
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: data.error ?? '本日の利用上限に達しました。' },
          ])
          setLoading(false)
          return
        }
        // 401: セッション失効。汎用エラーでなく再ログイン導線（下部バナー）を出す。
        if (res.status === 401) {
          setSessionExpired(true)
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
        // 初回記憶の取りこぼしゼロ化（F2-a）: この会話でまだ一度も抽出していなければ
        // 1往復目から先行発火する（1往復で離脱した会話が記憶ゼロになる穴を塞ぐ）。
        // 2回目以降は従来どおり MEMORY_TRIGGER_EVERY 間隔。
        const firstExtraction = lastExtractedAtRef.current === 0 && userCount >= 1
        if (
          firstExtraction ||
          (userCount >= MEMORY_TRIGGER_EVERY &&
            userCount - lastExtractedAtRef.current >= MEMORY_TRIGGER_EVERY)
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
        // 送信のたびに残回数を更新（次の送信前に最新の残りが出る）。
        refreshUsage()
      }
    },
    [input, loading, companyId, messages, router, extractFacts, refreshUsage],
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
        // 記憶が増えた瞬間の実感強化（UX-5）: 保存直後に記憶残高を取り、件数入りで伝える。
        //   stats が取れない時は現行文言のまま（トーストを遅らせない/失敗で壊さない）。
        let toastMessage = 'この方針を会社の記憶に残しました'
        try {
          const statsRes = await fetch(`/api/company/memory/stats?companyId=${companyId}`)
          if (statsRes.ok) {
            const stats = await statsRes.json()
            if (typeof stats.total === 'number' && stats.total > 0) {
              toastMessage = `この方針を記録しました。会社の記憶が${stats.total}件になりました`
            }
          }
        } catch {
          // 件数取得失敗はサイレント（保存自体は成功している）
        }
        showToast(toastMessage)
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
        {/* 参照ルールバッジのリンク化（UX-3）: 「何を前提に答えているか」を1タップで確認できる透明性 */}
        {ruleCount !== null && (
          <Link
            href={`/company/rules?companyId=${companyId}`}
            aria-label={`参照中の自社ルール${ruleCount}件を確認する`}
            className="rounded-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Badge tone="neutral">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
              参照中の自社ルール {ruleCount}件
            </Badge>
          </Link>
        )}
        {/* 本日の残り相談回数（P2・429の事前告知）。残りわずかは warning で早めに気づかせる。 */}
        {chatRemaining !== null && (
          <Badge tone={chatRemaining.remaining <= 3 ? 'warning' : 'neutral'}>
            本日の残り相談 {chatRemaining.remaining}/{chatRemaining.limit}回
          </Badge>
        )}
        {/* 会話が始まっている（復元 or 送信済み）ときだけ「新しい相談」への切替を出す */}
        {messages.length > 1 && !loading && (
          <button
            onClick={startNewConversation}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            新しい相談を始める
          </button>
        )}
        <div className="ml-auto sm:hidden">
          <CompanySwitcher companyId={companyId} variant="header" />
        </div>
      </div>

      {/* 会話の継続性（P1-3）: 直近会話を復元したことを明示（黙って続きにしない） */}
      {resumedTitle && (
        <p className="mb-2 truncate text-xs text-neutral-500">
          前回の相談「{resumedTitle}」の続きから再開しています
        </p>
      )}

      <div
        className="flex-1 space-y-5 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4"
        role="log"
        aria-live="polite"
        aria-label="チャット履歴"
      >
        {messages.map((msg, i) => {
          // 直近の確定済み assistant 回答にだけ「次の一歩」を添える（全回答に出すとノイズ）。
          //   i > 0 でオンボーディング挨拶を除外。ストリーミング中(loading/isTyping)は出さない。
          const isLatestAnswer =
            msg.role === 'assistant' && i === messages.length - 1 && i > 0 && !msg.isTyping && !loading
          // UX-4: 回答が規程系の話題のときだけ、起草（documents）への連結チップを出す。
          const showDraftChip = isLatestAnswer && DRAFTABLE_RE.test(msg.content)
          // F3: 【根拠】で自社ルールを引いた回答には「前提の修正」導線（誤前提の自己修復路）。
          const showFixPremise = isLatestAnswer && msg.content.includes('【根拠】')
          return (
            <div key={i}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
              {(showDraftChip || showFixPremise) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-1">
                  {showDraftChip && (
                    <Link
                      href={`/company/documents?companyId=${companyId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      この内容で規程ドラフトの下書きを作る
                    </Link>
                  )}
                  {showFixPremise && (
                    <Link
                      href={`/company/rules?companyId=${companyId}`}
                      className="text-xs text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      前提が違う場合は修正する
                    </Link>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* restoring 中はサンプル質問を出さない（復元結果で上書きされるチラつき防止） */}
        {isFirstMessage && !restoring && messages.length === 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="相談の始め方の例">
            {samplePrompts.map(prompt => (
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

      {/* セッション失効（401）: 現在のパスへ戻れる next 付きで再ログインへ誘導する。 */}
      {sessionExpired && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center">
          <p className="min-w-0 text-sm text-neutral-900">
            セッションの有効期限が切れました。もう一度ログインしてください。
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(
              `${pathname}${params.toString() ? `?${params.toString()}` : ''}`,
            )}`}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            ログインし直す
          </Link>
        </div>
      )}

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
