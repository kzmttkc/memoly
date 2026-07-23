'use client'

import { useState } from 'react'
import { Download, ScrollText, ShieldCheck, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ============================================================================
// DataSecuritySection — 設定画面(/company/billing)の「データとセキュリティ」
// ----------------------------------------------------------------------------
//   F10: データエクスポート(JSON)の常設（admin）
//   F09: 監査ログの閲覧（admin・直近50件）
//   F05: /security ページへの導線
//   削除の自己サーブ: アカウント削除（既存 DELETE /api/account を UI から実行可能に。
//     取り違え防止に「削除」と入力させる二段確認。無人になる会社のデータは
//     API 側で即時削除される＝プライバシーポリシー4条の実装）。
// ============================================================================

const ACTION_LABELS: Record<string, string> = {
  'profile.delete': '自社ルールの削除',
  'profile.update': '自社ルールの更新',
  'document.delete': '取込規程の削除',
  'member.invite': 'メンバーの招待',
  'memory.rule.delete': '記憶（ルール候補）の削除',
  'data.export': 'データの一括エクスポート',
}

interface AuditLog {
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  actor_user_id: string | null
  created_at: string
}

export function DataSecuritySection({
  companyId,
  isAdmin,
}: {
  companyId: string
  isAdmin: boolean
}) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function loadLogs() {
    if (logsLoading) return
    setLogsLoading(true)
    setLogsError(null)
    try {
      const res = await fetch(`/api/company/audit-logs?companyId=${companyId}&limit=50`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLogsError(data.error ?? '監査ログを読み込めませんでした')
        return
      }
      setLogs(data.logs ?? [])
    } catch {
      setLogsError('監査ログを読み込めませんでした')
    } finally {
      setLogsLoading(false)
    }
  }

  async function deleteAccount() {
    if (deleting || confirmText !== '削除') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDeleteError(data.error ?? '削除に失敗しました。時間をおいて再度お試しください。')
        return
      }
      // auth ユーザーは消えたためセッションは無効。公開トップへ戻す。
      window.location.href = '/business'
    } catch {
      setDeleteError('削除に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900">
        <ShieldCheck className="h-4.5 w-4.5 text-brand-600" aria-hidden />
        データとセキュリティ
      </h2>

      <div className="space-y-4">
        {/* ===== エクスポート（admin のみ・API側でも403）===== */}
        {isAdmin && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">データのエクスポート</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  自社ルール・記憶・取込規程・期限・相談履歴の一式をJSONでダウンロードできます。データはいつでも持ち出せます。
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  // Content-Disposition: attachment のためページ遷移せずダウンロードされる。
                  window.location.href = `/api/company/export?companyId=${companyId}`
                }}
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden />
                JSONをダウンロード
              </Button>
            </div>
          </Card>
        )}

        {/* ===== 監査ログ（admin のみ・RLSでも admin 限定）===== */}
        {isAdmin && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">操作の監査ログ</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  メンバー招待・規程や記憶の削除・エクスポートなどの重要操作の記録（追記専用・直近50件）。
                </p>
              </div>
              <Button variant="secondary" onClick={loadLogs} disabled={logsLoading}>
                <ScrollText className="mr-1.5 h-4 w-4" aria-hidden />
                {logsLoading ? '読み込み中...' : logs ? '再読み込み' : 'ログを表示'}
              </Button>
            </div>
            {logsError && <p className="mt-3 text-xs text-warning-700">{logsError}</p>}
            {logs && logs.length === 0 && (
              <p className="mt-3 text-xs text-neutral-500">記録された操作はまだありません。</p>
            )}
            {logs && logs.length > 0 && (
              <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                {logs.map((log, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                    <span className="text-xs tabular-nums text-neutral-400">
                      {new Date(log.created_at).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-sm text-neutral-800">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="text-xs text-neutral-500">
                        {Object.entries(log.metadata)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' / ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* ===== セキュリティページへの導線 ===== */}
        <Card>
          <p className="text-sm font-medium text-neutral-900">セキュリティとデータ保護</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            会社ごとのデータ分離（RLS）・AI学習への不使用・委託先の一覧など、番頭のデータ保護の仕組みは
            <Link href="/security" className="text-brand-600 underline" target="_blank">
              セキュリティとデータ保護
            </Link>
            のページで公開しています。
          </p>
        </Card>

        {/* ===== アカウント削除（全ロール・自己サーブ）===== */}
        <Card className="border-warning-500/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">アカウントの削除</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                アカウントを削除します。あなたが最後のメンバーだった会社のデータ（相談履歴・記憶・規程・期限）も同時に削除され、元に戻せません。
              </p>
            </div>
            {!showDelete && (
              <Button variant="secondary" onClick={() => setShowDelete(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                削除の手続きへ
              </Button>
            )}
          </div>
          {showDelete && (
            <div className="mt-4 rounded-lg border border-warning-500/30 bg-warning-50 p-4">
              <p className="text-xs leading-relaxed text-warning-700">
                本当に削除する場合は、確認のため「削除」と入力してください。この操作は取り消せません。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="削除"
                  className="h-9 w-32 rounded-lg border border-neutral-200 bg-white px-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
                  aria-label="削除の確認入力"
                />
                <Button
                  variant="danger"
                  disabled={confirmText !== '削除' || deleting}
                  onClick={deleteAccount}
                >
                  {deleting ? '削除しています...' : 'アカウントを完全に削除する'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDelete(false)
                    setConfirmText('')
                    setDeleteError(null)
                  }}
                >
                  やめる
                </Button>
              </div>
              {deleteError && <p className="mt-2 text-xs text-warning-700">{deleteError}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
