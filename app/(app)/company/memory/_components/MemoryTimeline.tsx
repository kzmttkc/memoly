'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  Gavel,
  MessageSquareText,
  User,
  Sparkles,
  History,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { HandoverView } from './HandoverView'

// ============================================================================
// MemoryTimeline — 「会社の記憶」タイムライン + 承認UI（adminのみ承認操作可）。
//   GET /api/company/memory?companyId= で全記憶（summary/decision/rule候補）を取得し、
//     1) rule候補 = AIが拾った自社事実 → adminがワンタップで正式ルールに昇格
//     2) decision = 過去の自社判断 → 時系列で強調表示（番頭の差別化の核）
//     3) summary  = 相談の記憶 → 時系列表示
//   subject(対象者)が付いた記憶はラベルを併記し「人ごとに覚えている」ことを見せる。
//   ★個人特定情報は表示しない設計: subject は登録時にラベル粒度（例「Aさん(育休)」）で
//     保存される前提。本UIは保存値をそのまま出すだけで、生氏名を新たに引き出さない。
// ============================================================================

interface Memory {
  id: string
  summary: string
  memory_type: 'summary' | 'rule' | 'decision'
  topic: string | null
  subject: string | null
  decided_at: string | null
  created_at: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

// rule候補は「key：value」形式で保存されている。承認APIに渡すため分解する。
function splitRule(summary: string): { key: string; value: string } | null {
  const idx = summary.indexOf('：')
  if (idx <= 0) return null
  return { key: summary.slice(0, idx).trim(), value: summary.slice(idx + 1).trim() }
}

export function MemoryTimeline() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  // 表示モード: 'timeline'（時系列＋承認）/ 'handover'（引き継ぎ/承継サマリー1画面）。
  const [mode, setMode] = useState<'timeline' | 'handover'>('timeline')
  const [memories, setMemories] = useState<Memory[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  })

  const showToast = useCallback(
    (message: string) => setToast({ show: true, message }),
    [],
  )

  const load = useCallback(async () => {
    if (!companyId) return
    try {
      const [memRes, compRes] = await Promise.all([
        fetch(`/api/company/memory?companyId=${companyId}`),
        fetch('/api/company'),
      ])
      const memData = await memRes.json().catch(() => ({}))
      setMemories(memRes.ok ? (memData.memories ?? []) : [])
      // 自社でのロールを判定（admin のみ承認ボタンを出す）。
      const compData = await compRes.json().catch(() => ({}))
      const me = (compData.companies ?? []).find(
        (c: { companyId: string; role: string }) => c.companyId === companyId,
      )
      setIsAdmin(me?.role === 'admin')
    } catch {
      showToast('読み込みに失敗しました')
      setMemories([])
    }
  }, [companyId, showToast])

  useEffect(() => {
    // load は setState を await 後（API応答の同期）にのみ呼ぶ。react-hooks ルールが
    // 関数呼出しを一律警告するため、WeeklyDigest 等と同様に抑止する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function approve(m: Memory) {
    const parts = splitRule(m.summary)
    if (!parts) {
      showToast('この候補は形式が不明のため承認できません')
      return
    }
    setApproving(m.id)
    try {
      const res = await fetch('/api/company/memory?action=approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          key: parts.key,
          value: parts.value,
          memoryId: m.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '承認に失敗しました')
        return
      }
      showToast(`「${parts.key}」を自社ルールに登録しました`)
      await load()
    } catch {
      showToast('承認に失敗しました')
    } finally {
      setApproving(null)
    }
  }

  const { ruleCandidates, timeline } = useMemo(() => {
    const all = memories ?? []
    return {
      ruleCandidates: all.filter(m => m.memory_type === 'rule'),
      // 判断と相談要約を時系列（新しい順）に。decision は decided_at を優先。
      timeline: all
        .filter(m => m.memory_type === 'decision' || m.memory_type === 'summary')
        .sort((a, b) => {
          const ta = new Date(a.decided_at ?? a.created_at).getTime()
          const tb = new Date(b.decided_at ?? b.created_at).getTime()
          return tb - ta
        }),
    }
  }, [memories])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="会社の記憶"
        description="番頭は、過去の相談ややり取りの結果、下した判断、関係者ごとの状況を会社の記憶として残します。担当者が代わっても、会社として何をどう決めてきたかが引き継がれます。"
      />

      {/* 表示モード切替（時系列 / 引き継ぎ）。印刷時は隠す。 */}
      <div
        className="mb-6 inline-flex rounded-xl border border-neutral-200 bg-white p-1 print:hidden"
        role="tablist"
        aria-label="記憶の表示モード"
      >
        {(
          [
            { id: 'timeline', label: 'タイムライン' },
            { id: 'handover', label: '引き継ぎビュー' },
          ] as const
        ).map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              mode === t.id
                ? 'bg-brand-600 text-white'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'handover' ? (
        <HandoverView companyId={companyId} />
      ) : memories === null ? (
        <p className="text-sm text-neutral-500">読み込み中...</p>
      ) : (
        <>
          {/* ===== 承認待ち候補（adminのみ操作可。memberには件数のみ穏当に見せる） ===== */}
          {ruleCandidates.length > 0 && (
            <Card className="mb-6 border-brand-100 bg-brand-50/40">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-700" aria-hidden />
                <p className="text-sm font-semibold text-neutral-900">
                  AIが見つけた自社事実の候補（{ruleCandidates.length}件）
                </p>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-neutral-600">
                {isAdmin
                  ? '相談の中から拾った「自社の事実」の候補です。承認すると、正式な自社ルールとして次回以降の相談の前提になります。'
                  : '相談の中から拾った「自社の事実」の候補です。正式な自社ルールへの登録は管理者が行います。'}
              </p>
              <ul className="space-y-2">
                {ruleCandidates.map(m => {
                  const parts = splitRule(m.summary)
                  return (
                    <li key={m.id}>
                      <Card padded={false} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {parts ? (
                              <>
                                <p className="mb-0.5 text-xs font-medium text-brand-700">
                                  {parts.key}
                                </p>
                                <p className="break-words text-sm text-neutral-900">
                                  {parts.value}
                                </p>
                              </>
                            ) : (
                              <p className="break-words text-sm text-neutral-900">
                                {m.summary}
                              </p>
                            )}
                          </div>
                          {isAdmin && (
                            <Button
                              size="sm"
                              onClick={() => approve(m)}
                              disabled={approving === m.id || !parts}
                              className="shrink-0"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              {approving === m.id ? '...' : '承認'}
                            </Button>
                          )}
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {/* ===== 記憶のタイムライン ===== */}
          {timeline.length === 0 ? (
            <Card className="border-dashed text-center">
              <History
                className="mx-auto mb-3 h-6 w-6 text-neutral-400"
                aria-hidden
              />
              <p className="text-sm text-neutral-600">
                まだ会社の記憶はありません。
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                相談を重ねるほど、判断や関係者ごとの状況がここに積み重なります。
              </p>
            </Card>
          ) : (
            <ol className="space-y-3">
              {timeline.map(m => {
                const isDecision = m.memory_type === 'decision'
                const date = fmtDate(isDecision ? m.decided_at : m.created_at)
                return (
                  <li key={m.id}>
                    <Card padded={false} className="px-4 py-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {isDecision ? (
                          <Badge tone="brand">
                            <Gavel className="h-3 w-3" aria-hidden />
                            自社の判断
                          </Badge>
                        ) : (
                          <Badge tone="neutral">
                            <MessageSquareText className="h-3 w-3" aria-hidden />
                            相談の記憶
                          </Badge>
                        )}
                        {m.subject && (
                          <Badge tone="info">
                            <User className="h-3 w-3" aria-hidden />
                            {m.subject}
                          </Badge>
                        )}
                        {m.topic && <Badge tone="neutral">{m.topic}</Badge>}
                        {date && (
                          <span className="ml-auto text-xs text-neutral-400">
                            {date}
                          </span>
                        )}
                      </div>
                      <p
                        className={
                          isDecision
                            ? 'break-words text-sm font-medium text-neutral-900'
                            : 'break-words text-sm text-neutral-700'
                        }
                      >
                        {m.summary}
                      </p>
                    </Card>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
