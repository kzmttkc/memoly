'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, Plus, Check, Trash2, Sparkles } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/deadlines — F4 期限レジストリ
//   (1) 次回期限リスト（due_on 昇順・残日数バッジ・adminは編集/削除/済みにする）
//   (2) 追加フォーム（title / due_on / recurrence / note・adminのみ）
//   (3) サジェストカード（属性ベースの候補をワンクリックで登録）
//   期日はユーザーが確定する（システムは日付を断定しない・Phase1）。
// ============================================================================

interface Deadline {
  id: string
  title: string
  note: string | null
  due_on: string
  recurrence: 'none' | 'yearly'
  source: 'manual' | 'suggested'
  active: boolean
  updated_at: string
}

interface Suggestion {
  title: string
  timingLabel: string
  hint?: string
  recurrence: 'none' | 'yearly'
}

/** 残り日数（当日=0・過去は負）。UTC 日付でそろえる（due_on は date）。 */
function daysUntil(dueOn: string): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`)
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((due - today) / (24 * 60 * 60 * 1000))
}

/** 残り日数のバッジ（7日以内=warning・超過=danger・それ以外=neutral）。 */
function remainingBadge(du: number): { tone: 'neutral' | 'warning' | 'danger'; label: string } {
  if (du < 0) return { tone: 'danger', label: `${Math.abs(du)}日超過` }
  if (du <= 7) return { tone: 'warning', label: `残り${du}日` }
  return { tone: 'neutral', label: `残り${du}日` }
}

function DeadlinesInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [deadlines, setDeadlines] = useState<Deadline[] | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // --- 追加フォーム ---
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newRecurrence, setNewRecurrence] = useState<'none' | 'yearly'>('yearly')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!companyId) return
    try {
      const [listRes, sugRes] = await Promise.all([
        fetch(`/api/company/deadlines?companyId=${companyId}`),
        fetch(`/api/company/deadlines?companyId=${companyId}&suggest=1`),
      ])
      const listData = await listRes.json().catch(() => ({}))
      const sugData = await sugRes.json().catch(() => ({}))
      if (listRes.ok) {
        setDeadlines(listData.deadlines ?? [])
        setIsAdmin(Boolean(listData.isAdmin))
      } else {
        setDeadlines([])
      }
      if (sugRes.ok) setSuggestions(sugData.suggestions ?? [])
    } catch {
      showToast('読み込みに失敗しました')
      setDeadlines([])
    }
  }, [companyId, showToast])

  useEffect(() => {
    load()
  }, [load])

  async function addDeadline(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!newTitle.trim()) {
      showToast('期限の名称を入力してください')
      return
    }
    if (!newDue) {
      showToast('期日を選んでください')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/company/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: newTitle.trim(),
          due_on: newDue,
          recurrence: newRecurrence,
          note: newNote.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '登録に失敗しました')
        return
      }
      showToast(`「${data.deadline?.title ?? newTitle}」を登録しました`)
      setNewTitle('')
      setNewDue('')
      setNewNote('')
      setNewRecurrence('yearly')
      await load()
    } catch {
      showToast('登録できませんでした。通信の状態を確かめて、もう一度お試しいただけますか')
    } finally {
      setSaving(false)
    }
  }

  // サジェスト候補をワンクリックで登録。日付はユーザー確定＝当年の目安として本日+7日を
  // 初期値に埋める（システムは断定せず、登録後に編集で調整できる）。
  async function acceptSuggestion(s: Suggestion) {
    const suggestedDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    try {
      const res = await fetch('/api/company/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: s.title,
          due_on: suggestedDue,
          recurrence: s.recurrence,
          source: 'suggested',
          note: s.hint,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '登録に失敗しました')
        return
      }
      showToast(`「${s.title}」を登録しました。期日を確認して調整してください`)
      await load()
    } catch {
      showToast('登録できませんでした。通信の状態を確かめて、もう一度お試しいただけますか')
    }
  }

  async function markDone(d: Deadline) {
    try {
      const res = await fetch('/api/company/deadlines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id: d.id, done: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '更新に失敗しました')
        return
      }
      showToast(`「${d.title}」を来年の予定に更新しました`)
      await load()
    } catch {
      showToast('更新に失敗しました')
    }
  }

  async function updateDue(d: Deadline, due_on: string) {
    if (!due_on) return
    try {
      const res = await fetch('/api/company/deadlines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id: d.id, due_on }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '更新に失敗しました')
        return
      }
      showToast('期日を更新しました')
      await load()
    } catch {
      showToast('更新に失敗しました')
    }
  }

  async function removeDeadline(d: Deadline) {
    try {
      const res = await fetch(
        `/api/company/deadlines?companyId=${companyId}&id=${d.id}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '削除に失敗しました')
        return
      }
      showToast(`「${d.title}」を削除しました`)
      await load()
    } catch {
      showToast('削除に失敗しました')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="期限"
        description="毎年巡ってくる労務の期限を登録しておくと、近づいたときにメールでお知らせします。期日はご自身で確定してください。"
      />

      {/* (3) サジェストカード（未登録の候補があり adminのとき） */}
      {isAdmin && suggestions.length > 0 && (
        <Card className="mb-6 space-y-3 border-brand-200 bg-brand-50/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
            登録しておくとよさそうな期限
          </p>
          <ul className="space-y-2">
            {suggestions.map(s => (
              <li
                key={s.title}
                className="flex items-start justify-between gap-3 rounded-xl border border-brand-100 bg-white px-3.5 py-2.5"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-neutral-900">{s.title}</span>
                  <span className="ml-2 text-xs text-neutral-500">{s.timingLabel}</span>
                  {s.hint && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                      {s.hint}
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => acceptSuggestion(s)}
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  追加
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* (2) 追加フォーム（adminのみ） */}
      {isAdmin && (
        <Card className="mb-6">
          <form onSubmit={addDeadline} className="space-y-3">
            <div>
              <label htmlFor="d-title" className="mb-1.5 block text-sm font-medium text-neutral-700">
                期限の名称
              </label>
              <Input
                id="d-title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="例：36協定の更新"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-1/2">
                <label htmlFor="d-due" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  期日
                </label>
                <Input
                  id="d-due"
                  type="date"
                  value={newDue}
                  onChange={e => setNewDue(e.target.value)}
                />
              </div>
              <div className="sm:w-1/2">
                <label htmlFor="d-rec" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  繰り返し
                </label>
                <select
                  id="d-rec"
                  value={newRecurrence}
                  onChange={e => setNewRecurrence(e.target.value as 'none' | 'yearly')}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  <option value="yearly">毎年</option>
                  <option value="none">一度きり</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="d-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
                メモ（任意）
              </label>
              <Input
                id="d-note"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="例：昨年は6月末に提出"
                maxLength={2000}
              />
            </div>
            <Button type="submit" size="lg" disabled={saving} className="w-full">
              <Plus className="h-4 w-4" aria-hidden />
              {saving ? '登録中...' : '期限を登録する'}
            </Button>
            {/* G-m: 配信予告。登録の見返り（いつ知らせてくれるのか）を登録の瞬間に明示する。 */}
            <p className="text-center text-xs leading-relaxed text-neutral-500">
              登録すると、期日の30日前・14日前・7日前・1日前と当日にメールでお知らせします。
            </p>
          </form>
        </Card>
      )}

      {/* (1) 次回期限リスト（due_on 昇順） */}
      {deadlines === null ? (
        <p className="text-sm text-neutral-500">読み込み中...</p>
      ) : deadlines.length === 0 ? (
        <Card className="bg-neutral-50">
          <p className="text-sm leading-relaxed text-neutral-600">
            登録された期限はまだありません。
            {isAdmin
              ? '上のフォームや候補から追加できます。'
              : '管理者が期限を登録すると、近づいたときにお知らせします。'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {deadlines.map(d => {
            const du = daysUntil(d.due_on)
            const badge = remainingBadge(du)
            return (
              <Card key={d.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      {d.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      期日の目安：{new Date(`${d.due_on}T00:00:00Z`).toLocaleDateString('ja-JP', {
                        timeZone: 'UTC',
                      })}
                      {d.recurrence === 'yearly' && '・毎年'}
                    </p>
                    {d.note && (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{d.note}</p>
                    )}
                  </div>
                  <Badge tone={badge.tone} className="shrink-0">
                    {badge.label}
                  </Badge>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="text-xs text-neutral-500">
                      期日を変更：
                      <input
                        type="date"
                        defaultValue={d.due_on}
                        onChange={e => updateDue(d, e.target.value)}
                        className="ml-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                      />
                    </label>
                    <Button size="sm" variant="secondary" onClick={() => markDone(d)}>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      済みにする
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDeadline(d)}
                      aria-label={`${d.title}を削除`}
                      className="text-neutral-500 hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </ul>
      )}

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function CompanyDeadlinesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <DeadlinesInner />
      </CompanyGuard>
    </Suspense>
  )
}
