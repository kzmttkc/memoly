'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/rules — 自社ルール編集（adminのみ）
//   company_profiles を key/value で一覧 → 追加 / 編集 / 削除。
//   テンプレ(チェックリスト): 推奨項目を先出しし、未登録のものをワンタップ下書き。
//   削除は undo 付きトーストで誤操作を救済する。
// ============================================================================

interface Profile {
  id: string
  key: string
  value: string
  updated_at?: string
}

// 推奨テンプレ。登録済みかどうかで「済 / 未登録」を出し分ける（空状態を先出し）。
const TEMPLATE: { key: string; sample: string }[] = [
  { key: '所定労働時間', sample: '1日8時間 / 週40時間' },
  { key: '36協定', sample: '未締結' },
  { key: '有給付与', sample: '入社6ヶ月後に10日' },
  { key: '給与締め日', sample: '毎月末締め翌月25日払い' },
]

function RulesEditor() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    action?: { label: string; onClick: () => void }
  }>({ show: false, message: '' })

  const showToast = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) =>
      setToast({ show: true, message, action }),
    [],
  )

  const load = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/company/profile?companyId=${companyId}`)
      if (res.status === 403) {
        setForbidden(true)
        setProfiles([])
        return
      }
      const data = await res.json()
      setProfiles(data.profiles ?? [])
    } catch {
      showToast('読み込みに失敗しました')
      setProfiles([])
    }
  }, [companyId, showToast])

  useEffect(() => {
    load()
  }, [load])

  async function upsert(key: string, value: string) {
    const res = await fetch('/api/company/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, key, value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? '保存に失敗しました')
    return data
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    if (!newKey.trim() || !newValue.trim() || saving) return
    setSaving(true)
    try {
      const data = await upsert(newKey.trim(), newValue.trim())
      setNewKey('')
      setNewValue('')
      showToast(`「${data.profile.key}」を覚えました`)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(p: Profile) {
    if (!editValue.trim()) return
    try {
      const res = await fetch('/api/company/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id: p.id, value: editValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error ?? '更新に失敗しました')
        return
      }
      setEditId(null)
      setEditValue('')
      showToast('更新しました')
      await load()
    } catch {
      showToast('更新に失敗しました')
    }
  }

  async function removeRule(p: Profile) {
    try {
      const res = await fetch('/api/company/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id: p.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '削除に失敗しました')
        return
      }
      await load()
      // undo: 直前の key/value を再 upsert で復元する。
      showToast(`「${p.key}」を削除しました`, {
        label: '取り消す',
        onClick: async () => {
          try {
            await upsert(p.key, p.value)
            await load()
          } catch {
            showToast('復元に失敗しました')
          }
        },
      })
    } catch {
      showToast('削除に失敗しました')
    }
  }

  if (forbidden) {
    return (
      <Card className="mx-auto max-w-2xl border-warning-500/30 bg-warning-50">
        <p className="flex items-center gap-2 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          自社ルールの編集は管理者のみ可能です。あなたはこの会社のメンバー席です。
        </p>
      </Card>
    )
  }

  const registeredKeys = new Set((profiles ?? []).map(p => p.key))
  const missing = TEMPLATE.filter(t => !registeredKeys.has(t.key))

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="自社ルールを覚えさせる"
        description="ここで登録した内容を、AIが自社の前提として相談時に参照します。所定労働時間・36協定の締結状況・給与の締め支払日など、会社ごとに違う事実を登録してください。"
      />

      {/* 推奨テンプレ（チェックリスト）: 未登録項目を先出し */}
      <Card className="mb-6">
        <p className="mb-3 text-sm font-semibold text-neutral-900">推奨される登録項目</p>
        <ul className="space-y-2">
          {TEMPLATE.map(t => {
            const done = registeredKeys.has(t.key)
            return (
              <li key={t.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      done
                        ? 'grid h-5 w-5 place-items-center rounded-full bg-success-500 text-white'
                        : 'grid h-5 w-5 place-items-center rounded-full border border-neutral-300 text-neutral-400'
                    }
                    aria-hidden
                  >
                    {done ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className={done ? 'text-neutral-500 line-through' : 'text-neutral-800'}>
                    {t.key}
                  </span>
                  {done ? (
                    <Badge tone="success">登録済み</Badge>
                  ) : (
                    <Badge tone="warning">未登録</Badge>
                  )}
                </span>
                {!done && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewKey(t.key)
                      setNewValue(t.sample)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    下書き
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {missing.length === 0 && profiles !== null && (
          <p className="mt-3 text-xs text-success-700">推奨項目はすべて登録済みです。</p>
        )}
      </Card>

      {/* 追加フォーム */}
      <Card className="mb-6">
        <form onSubmit={addRule} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="項目（例：所定労働時間）"
              className="sm:w-1/3"
              maxLength={100}
              aria-label="項目名"
            />
            <Input
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="内容（例：1日8時間 / 週40時間）"
              className="flex-1"
              maxLength={500}
              aria-label="内容"
            />
            <Button type="submit" disabled={saving || !newKey.trim() || !newValue.trim()}>
              {saving ? '...' : '覚えさせる'}
            </Button>
          </div>
        </form>
      </Card>

      {/* 一覧 */}
      {profiles === null ? (
        <p className="text-sm text-neutral-500">読み込み中...</p>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed text-center">
          <p className="text-sm text-neutral-600">
            まだ登録されたルールはありません。
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            上の推奨項目から「下書き」を押すと、すぐに最初の1件を登録できます。
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {profiles.map(p => (
            <li key={p.id}>
              <Card padded={false} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs font-medium text-brand-700">{p.key}</p>
                    {editId === p.id ? (
                      <div className="mt-1 flex gap-2">
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="flex-1"
                          maxLength={500}
                          aria-label={`${p.key}の内容を編集`}
                        />
                        <Button size="sm" onClick={() => saveEdit(p)}>
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditId(null)
                            setEditValue('')
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <p className="break-words text-sm text-neutral-900">{p.value}</p>
                    )}
                  </div>
                  {editId !== p.id && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditId(p.id)
                          setEditValue(p.value)
                        }}
                        aria-label={`${p.key}を編集`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRule(p)}
                        aria-label={`${p.key}を削除`}
                        className="text-neutral-500 hover:text-danger-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Toast
        show={toast.show}
        message={toast.message}
        action={toast.action}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function RulesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <RulesEditor />
      </CompanyGuard>
    </Suspense>
  )
}
