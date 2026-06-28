'use client'

import { Suspense, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Copy, FileText, ScanSearch } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { track } from '@/lib/analytics'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/documents — 書類作成 & 規程レビュー（有料の核のUI）
//   タブ1 書類作成: 種類選択 → 生成 → ドラフト表示＋コピー
//   タブ2 規程レビュー: テキスト貼付 → リスク一覧（severity を Badge で）
// ============================================================================

const DOCUMENT_TYPES = ['36協定', '就業規則', '賃金規程', '労働条件通知書']

interface ReviewItem {
  severity: 'high' | 'medium' | 'low'
  category: string
  clause: string
  issue: string
  suggestion: string
}

const SEVERITY: Record<ReviewItem['severity'], { label: string; tone: 'danger' | 'warning' | 'info' }> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warning' },
  low: { label: '低', tone: 'info' },
}

function DocumentsInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [tab, setTab] = useState<'generate' | 'review'>('generate')
  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // --- タブ1: 書類作成 ---
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0])
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState('')

  async function generate() {
    if (generating) return
    setGenerating(true)
    setDraft('')
    try {
      const res = await fetch('/api/company/document/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, documentType: docType }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '生成に失敗しました')
        return
      }
      setDraft(data.text ?? '')
      // 計測: 書類生成成功（有料の核）。doc_type は固定4種の列挙値＝非PII。
      track('document_generated', { doc_type: docType })
    } catch {
      showToast('生成に失敗しました。通信を確認してください。')
    } finally {
      setGenerating(false)
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      showToast('コピーしました')
    } catch {
      showToast('コピーに失敗しました')
    }
  }

  // --- タブ2: 規程レビュー ---
  const [reviewText, setReviewText] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [summary, setSummary] = useState('')
  const [disclaimer, setDisclaimer] = useState('')

  async function review() {
    if (reviewing || reviewText.trim().length < 10) {
      if (reviewText.trim().length < 10) showToast('規程テキストを貼り付けてください')
      return
    }
    setReviewing(true)
    setItems(null)
    setSummary('')
    try {
      const res = await fetch('/api/company/document/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, documentText: reviewText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? 'レビューに失敗しました')
        return
      }
      setItems(data.items ?? [])
      setSummary(data.summary ?? '')
      setDisclaimer(data.disclaimer ?? '')
    } catch {
      showToast('レビューに失敗しました。通信を確認してください。')
    } finally {
      setReviewing(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      active
        ? 'border-brand-600 text-brand-700'
        : 'border-transparent text-neutral-500 hover:text-neutral-800',
    )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="書類作成・規程レビュー"
        description="登録済みの自社ルールをもとに、書類のたたき台を作成したり、既存の規程をAIで点検できます。"
      />

      {/* タブ */}
      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        <button onClick={() => setTab('generate')} className={tabClass(tab === 'generate')}>
          書類を作成
        </button>
        <button onClick={() => setTab('review')} className={tabClass(tab === 'review')}>
          規程をレビュー
        </button>
      </div>

      {tab === 'generate' ? (
        // ---- タブ1: 書類作成 ----
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <label htmlFor="doc-type" className="mb-1.5 block text-sm font-medium text-neutral-700">
                書類の種類
              </label>
              <select
                id="doc-type"
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              >
                {DOCUMENT_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <Button size="lg" onClick={generate} disabled={generating} className="w-full">
              <FileText className="h-4 w-4" aria-hidden />
              {generating ? '作成中...（30秒ほどかかります）' : `${docType}のドラフトを作成`}
            </Button>
          </Card>

          {draft && (
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600">生成されたドラフト</span>
                <Button variant="secondary" size="sm" onClick={copyDraft}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  コピー
                </Button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-900">
                {draft}
              </pre>
            </Card>
          )}
        </div>
      ) : (
        // ---- タブ2: 規程レビュー ----
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <label htmlFor="review-text" className="mb-1.5 block text-sm font-medium text-neutral-700">
                既存の規程テキストを貼り付け
              </label>
              <Textarea
                id="review-text"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                rows={10}
                placeholder="例：第○条 残業は固定残業代に含むものとし、上限は設けない。…"
                maxLength={20000}
                className="resize-y"
              />
            </div>
            <Button size="lg" onClick={review} disabled={reviewing} className="w-full">
              <ScanSearch className="h-4 w-4" aria-hidden />
              {reviewing ? 'レビュー中...（30秒ほどかかります）' : 'この規程をレビューする'}
            </Button>
          </Card>

          {items !== null && (
            <div className="space-y-3">
              {summary && (
                <Card className="bg-neutral-50">
                  <p className="text-sm leading-relaxed text-neutral-700">{summary}</p>
                </Card>
              )}
              {items.length === 0 ? (
                <p className="text-sm text-neutral-500">指摘事項は見つかりませんでした。</p>
              ) : (
                items.map((it, i) => {
                  const sev = SEVERITY[it.severity]
                  return (
                    <Card key={i} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={sev.tone}>リスク {sev.label}</Badge>
                        <span className="text-xs text-neutral-500">{it.category}</span>
                      </div>
                      {it.clause && (
                        <p className="text-xs leading-relaxed text-neutral-500">対象：{it.clause}</p>
                      )}
                      {it.issue && (
                        <p className="text-sm leading-relaxed text-neutral-900">{it.issue}</p>
                      )}
                      {it.suggestion && (
                        <p className="text-sm leading-relaxed text-brand-700">
                          見直しの方向性：{it.suggestion}
                        </p>
                      )}
                    </Card>
                  )
                })
              )}
              {disclaimer && (
                <p className="pt-2 text-xs leading-relaxed text-neutral-500">{disclaimer}</p>
              )}
            </div>
          )}
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

export default function CompanyDocumentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <DocumentsInner />
      </CompanyGuard>
    </Suspense>
  )
}
