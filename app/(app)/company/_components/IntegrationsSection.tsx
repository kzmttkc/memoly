'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Plug, Copy, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ============================================================================
// IntegrationsSection — 設定画面(/company/billing)の「連携とAPI」（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   1) Slack連携: 自社Slackの Incoming Webhook URL を登録すると、期限リマインドと
//      週次ダイジェストがメールに加えて Slack にも届く。URL は保存後マスク表示のみ。
//   2) 公開API v1 のAPIキー: 発行/失効。生キーは発行直後に一度だけ表示する
//      （サーバーはハッシュのみ保存＝再表示は構造的に不可能）。
//   どちらも admin のみ（親がisAdminで出し分け・API/RLSでも強制）。
// ============================================================================

interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export function IntegrationsSection({
  companyId,
  isAdmin,
}: {
  companyId: string
  isAdmin: boolean
}) {
  // ----- Slack -----
  const [slackConfigured, setSlackConfigured] = useState(false)
  const [slackMasked, setSlackMasked] = useState<string | null>(null)
  const [slackUrl, setSlackUrl] = useState('')
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackMsg, setSlackMsg] = useState<string | null>(null)
  const [slackErr, setSlackErr] = useState<string | null>(null)

  // ----- API keys -----
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null)
  const [keyName, setKeyName] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [keyErr, setKeyErr] = useState<string | null>(null)
  const [newPlainKey, setNewPlainKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    fetch(`/api/company/integrations?companyId=${companyId}`)
      .then(r => r.json())
      .then(d => {
        setSlackConfigured(Boolean(d.slack?.configured))
        setSlackMasked(d.slack?.masked ?? null)
      })
      .catch(() => {})
    fetch(`/api/company/api-keys?companyId=${companyId}`)
      .then(r => r.json())
      .then(d => setKeys(d.keys ?? []))
      .catch(() => setKeys([]))
  }, [companyId, isAdmin])

  async function saveSlack(withTest: boolean) {
    if (slackSaving) return
    setSlackSaving(true)
    setSlackErr(null)
    setSlackMsg(null)
    try {
      const res = await fetch('/api/company/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, webhookUrl: slackUrl.trim(), test: withTest }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSlackErr(data.error ?? '保存に失敗しました')
        return
      }
      setSlackConfigured(true)
      setSlackMasked(data.slack?.masked ?? null)
      setSlackUrl('')
      if (withTest) {
        setSlackMsg(
          data.testSent
            ? '保存しました。テスト通知をSlackへ送信しました。'
            : '保存しました。テスト通知は届きませんでした。URLをご確認ください。',
        )
      } else {
        setSlackMsg('保存しました。次回の配信からSlackにも届きます。')
      }
    } catch {
      setSlackErr('保存に失敗しました。時間をおいてお試しください。')
    } finally {
      setSlackSaving(false)
    }
  }

  async function removeSlack() {
    if (slackSaving) return
    setSlackSaving(true)
    setSlackErr(null)
    setSlackMsg(null)
    try {
      const res = await fetch(`/api/company/integrations?companyId=${companyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSlackErr(data.error ?? '解除に失敗しました')
        return
      }
      setSlackConfigured(false)
      setSlackMasked(null)
      setSlackMsg('Slack連携を解除しました。')
    } catch {
      setSlackErr('解除に失敗しました。時間をおいてお試しください。')
    } finally {
      setSlackSaving(false)
    }
  }

  async function createKey() {
    if (keyBusy) return
    setKeyBusy(true)
    setKeyErr(null)
    setNewPlainKey(null)
    setCopied(false)
    try {
      const res = await fetch('/api/company/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, name: keyName.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setKeyErr(data.error ?? '発行に失敗しました')
        return
      }
      setNewPlainKey(data.plainKey ?? null)
      setKeys(prev => [data.key, ...(prev ?? [])])
      setKeyName('')
    } catch {
      setKeyErr('発行に失敗しました。時間をおいてお試しください。')
    } finally {
      setKeyBusy(false)
    }
  }

  async function revokeKey(id: string) {
    if (keyBusy) return
    setKeyBusy(true)
    setKeyErr(null)
    try {
      const res = await fetch('/api/company/api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setKeyErr(data.error ?? '失効に失敗しました')
        return
      }
      setKeys(prev =>
        (prev ?? []).map(k =>
          k.id === id ? { ...k, revoked_at: k.revoked_at ?? new Date().toISOString() } : k,
        ),
      )
    } catch {
      setKeyErr('失効に失敗しました。時間をおいてお試しください。')
    } finally {
      setKeyBusy(false)
    }
  }

  async function copyNewKey() {
    if (!newPlainKey) return
    try {
      await navigator.clipboard.writeText(newPlainKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (!isAdmin) return null

  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900">
        <Plug className="h-4.5 w-4.5 text-brand-600" aria-hidden />
        連携とAPI
      </h2>

      <div className="space-y-4">
        {/* ===== Slack連携 ===== */}
        <Card>
          <p className="text-sm font-medium text-neutral-900">Slack連携</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            自社Slackの Incoming Webhook URL を登録すると、期限リマインドと週次ダイジェストが、メールに加えてSlackのチャンネルにも届きます。URLはSlackの「App追加 → Incoming Webhooks」から発行できます。
          </p>
          {slackConfigured && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              設定済み: <span className="font-mono">{slackMasked}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={slackUrl}
              onChange={e => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              className="h-9 w-full max-w-sm rounded-lg border border-neutral-200 bg-white px-2 font-mono text-xs text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Slack Incoming Webhook URL"
            />
            <Button
              variant="secondary"
              disabled={slackSaving || !slackUrl.trim()}
              onClick={() => saveSlack(true)}
            >
              {slackSaving ? '保存中...' : '保存してテスト送信'}
            </Button>
            {slackConfigured && (
              <Button variant="ghost" disabled={slackSaving} onClick={removeSlack}>
                連携を解除
              </Button>
            )}
          </div>
          {slackMsg && <p className="mt-2 text-xs text-brand-700">{slackMsg}</p>}
          {slackErr && <p className="mt-2 text-xs text-warning-700">{slackErr}</p>}
        </Card>

        {/* ===== 公開API v1 のAPIキー ===== */}
        <Card>
          <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            <KeyRound className="h-4 w-4 text-brand-600" aria-hidden />
            APIキー（公開API v1）
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            会社の記憶（/api/v1/memories）と期限（/api/v1/deadlines）を読み取り専用で取得できるAPIキーです。キーはハッシュ化して保存され、発行直後にしか表示されません。
          </p>

          {newPlainKey && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-xs font-medium text-brand-700">
                新しいAPIキーが発行されました。この画面でしか表示されないため、今すぐ控えてください。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs text-neutral-800">
                  {newPlainKey}
                </code>
                <Button variant="ghost" onClick={copyNewKey}>
                  {copied ? (
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? 'コピーしました' : 'コピー'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="キーの用途（例: 社内ダッシュボード）"
              className="h-9 w-full max-w-sm rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="APIキーの名前"
            />
            <Button variant="secondary" disabled={keyBusy} onClick={createKey}>
              {keyBusy ? '処理中...' : 'キーを発行'}
            </Button>
          </div>
          {keyErr && <p className="mt-2 text-xs text-warning-700">{keyErr}</p>}

          {keys && keys.length > 0 && (
            <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
              {keys.map(k => (
                <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-mono text-xs text-neutral-700">{k.key_prefix}…</span>
                  <span className="text-xs text-neutral-500">{k.name}</span>
                  <span className="text-xs tabular-nums text-neutral-400">
                    {new Date(k.created_at).toLocaleDateString('ja-JP')} 発行
                  </span>
                  {k.revoked_at ? (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                      失効済み
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={keyBusy}
                      onClick={() => revokeKey(k.id)}
                      className="ml-auto"
                    >
                      失効する
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {keys && keys.length === 0 && (
            <p className="mt-3 text-xs text-neutral-500">発行済みのキーはまだありません。</p>
          )}
        </Card>
      </div>
    </div>
  )
}
