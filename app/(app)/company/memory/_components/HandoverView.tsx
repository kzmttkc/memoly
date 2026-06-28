'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BookOpenCheck,
  Gavel,
  User,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { track } from '@/lib/analytics'

// ============================================================================
// HandoverView — 「会社の記憶 引き継ぎビュー」（TOP5 #4・記憶moatの複利）
//   「人は代わる、番頭は覚えている」を体現する1画面。担当交代/承継時に、新担当が
//   この会社の労務判断履歴をここだけで把握できるようにする。
//     - 確定した自社ルール + 過去の主要判断（新しい順）+ 関係者ごとの状況 + 現行リスク要点。
//   /api/company/handover（GET・LLM不要の集約）から取得し、読みやすく集約表示する。
//   印刷（window.print）とテキストコピー（navigator.clipboard）に対応。
//   ★PDF生成や外部送信はしない（画面＋コピーで十分・Phase1安全）。
//   ★生氏名は出さない（subject は保存済みラベル粒度をそのまま表示）。
// ============================================================================

interface HandoverData {
  companyName: string
  rules: { key: string; value: string }[]
  decisions: { summary: string; topic: string | null; subject: string | null; decidedAt: string | null }[]
  people: { subject: string; notes: string[] }[]
  risk: {
    overall: number
    weakCategories: { name: string; score: number }[]
    diagnosedAt: string
  } | null
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: HandoverData }

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

// 引き継ぎサマリーをプレーンテキスト化（コピー用）。番頭の継続記憶を1通の引き継ぎ書に。
function buildHandoverText(d: HandoverData): string {
  const lines: string[] = []
  lines.push(`【${d.companyName} 労務の引き継ぎサマリー】`)
  lines.push('')

  lines.push('■ 確定した自社ルール')
  if (d.rules.length) {
    for (const r of d.rules) lines.push(`・${r.key}：${r.value}`)
  } else {
    lines.push('（まだ登録された自社ルールはありません）')
  }
  lines.push('')

  lines.push('■ 過去の主要な判断（新しい順）')
  if (d.decisions.length) {
    for (const dec of d.decisions) {
      const date = fmtDate(dec.decidedAt)
      const tags = [dec.subject, dec.topic].filter(Boolean).join('・')
      const head = [date, tags].filter(Boolean).join(' / ')
      lines.push(`・${head ? `（${head}）` : ''}${dec.summary}`)
    }
  } else {
    lines.push('（まだ記録された判断はありません）')
  }
  lines.push('')

  lines.push('■ 関係者ごとの状況')
  if (d.people.length) {
    for (const p of d.people) {
      lines.push(`・${p.subject}`)
      for (const n of p.notes) lines.push(`  - ${n}`)
    }
  } else {
    lines.push('（関係者ごとの記録はありません）')
  }
  lines.push('')

  lines.push('■ 現行リスクの要点')
  if (d.risk) {
    lines.push(`・総合スコア：${d.risk.overall}点（診断日 ${fmtDate(d.risk.diagnosedAt)}）`)
    if (d.risk.weakCategories.length) {
      lines.push('・注意したいカテゴリ：')
      for (const c of d.risk.weakCategories) lines.push(`  - ${c.name}（${c.score}点）`)
    }
  } else {
    lines.push('（まだリスク診断の記録はありません）')
  }
  lines.push('')
  lines.push('※ 本サマリーは番頭が会社の記憶として残してきた内容の要約です。最終的な判断・手続きは一次情報と専門家でご確認ください。')

  return lines.join('\n')
}

export function HandoverView({ companyId }: { companyId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  })

  const load = useCallback(
    async (ignore?: () => boolean) => {
      try {
        const res = await fetch(`/api/company/handover?companyId=${companyId}`)
        const data = await res.json().catch(() => ({}))
        if (ignore?.()) return
        if (!res.ok) {
          setState({ status: 'error', message: data.error ?? '取得に失敗しました' })
          return
        }
        setState({ status: 'ready', data: data as HandoverData })
        // 計測: 引き継ぎビューの表示成功（記憶moatの体験）。件数・本文は送らない。
        track('handover_viewed')
      } catch {
        if (ignore?.()) return
        setState({ status: 'error', message: '取得に失敗しました。通信を確認してください。' })
      }
    },
    [companyId],
  )

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [companyId, load])

  const text = useMemo(
    () => (state.status === 'ready' ? buildHandoverText(state.data) : ''),
    [state],
  )

  async function copy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setToast({ show: true, message: '引き継ぎサマリーをコピーしました' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setToast({ show: true, message: 'コピーに失敗しました' })
    }
  }

  if (state.status === 'loading') {
    return <p className="text-sm text-neutral-500">読み込み中...</p>
  }
  if (state.status === 'error') {
    return (
      <Card className="text-center">
        <p className="text-sm text-neutral-700">{state.message}</p>
      </Card>
    )
  }

  const d = state.data

  return (
    <div>
      {/* 操作バー（印刷時は隠す）。 */}
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? 'コピーしました' : 'テキストでコピー'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          印刷する
        </Button>
      </div>

      <p className="mb-6 rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-sm leading-relaxed text-neutral-700">
        人は代わっても、番頭は覚えています。この1画面で、{d.companyName}の労務ルール・過去の判断・関係者ごとの状況・現行リスクを引き継げます。
      </p>

      {/* ===== 確定した自社ルール ===== */}
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-brand-700" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">確定した自社ルール</h3>
        </div>
        {d.rules.length ? (
          <Card padded={false} className="divide-y divide-neutral-100">
            {d.rules.map((r, i) => (
              <div key={i} className="px-4 py-3">
                <p className="mb-0.5 text-xs font-medium text-brand-700">{r.key}</p>
                <p className="break-words text-sm text-neutral-900">{r.value}</p>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="text-sm text-neutral-500">まだ登録された自社ルールはありません。</Card>
        )}
      </section>

      {/* ===== 過去の主要な判断 ===== */}
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <Gavel className="h-4 w-4 text-brand-700" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">過去の主要な判断（新しい順）</h3>
        </div>
        {d.decisions.length ? (
          <ol className="space-y-2">
            {d.decisions.map((dec, i) => {
              const date = fmtDate(dec.decidedAt)
              return (
                <li key={i}>
                  <Card padded={false} className="px-4 py-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {dec.subject && (
                        <Badge tone="info">
                          <User className="h-3 w-3" aria-hidden />
                          {dec.subject}
                        </Badge>
                      )}
                      {dec.topic && <Badge tone="neutral">{dec.topic}</Badge>}
                      {date && <span className="ml-auto text-xs text-neutral-400">{date}</span>}
                    </div>
                    <p className="break-words text-sm font-medium text-neutral-900">{dec.summary}</p>
                  </Card>
                </li>
              )
            })}
          </ol>
        ) : (
          <Card className="text-sm text-neutral-500">まだ記録された判断はありません。</Card>
        )}
      </section>

      {/* ===== 関係者ごとの状況 ===== */}
      {d.people.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-brand-700" aria-hidden />
            <h3 className="text-sm font-semibold text-neutral-900">関係者ごとの状況</h3>
          </div>
          <div className="space-y-2">
            {d.people.map((p, i) => (
              <Card key={i} padded={false} className="px-4 py-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-900">{p.subject}</p>
                <ul className="space-y-1">
                  {p.notes.map((n, j) => (
                    <li key={j} className="break-words text-sm text-neutral-700">
                      ・{n}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ===== 現行リスクの要点 ===== */}
      <section className="mb-2">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-brand-700" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">現行リスクの要点</h3>
        </div>
        {d.risk ? (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-neutral-700">総合スコア</span>
              <span className="text-lg font-semibold text-neutral-900">{d.risk.overall}</span>
              <span className="text-xs text-neutral-400">点</span>
              {fmtDate(d.risk.diagnosedAt) && (
                <span className="ml-auto text-xs text-neutral-400">
                  診断日 {fmtDate(d.risk.diagnosedAt)}
                </span>
              )}
            </div>
            {d.risk.weakCategories.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-neutral-500">注意したいカテゴリ</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.risk.weakCategories.map((c, i) => (
                    <Badge key={i} tone="warning">
                      {c.name}（{c.score}点）
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="text-sm text-neutral-500">
            まだリスク診断の記録はありません。リスク診断を実行すると、ここに現行の要点が表示されます。
          </Card>
        )}
      </section>

      <p className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        本サマリーは番頭が会社の記憶として残してきた内容の要約です。最終的な判断・手続きは一次情報と専門家でご確認ください。
      </p>

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}
