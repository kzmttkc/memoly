'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BookMarked, Check, Copy, Download, FileText, ScanSearch, Trash2 } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { track } from '@/lib/analytics'
import { ingestPendingZure, readPendingZure } from '@/lib/zure-pending'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/documents — 書類作成 & 規程レビュー（有料の核のUI）
//   タブ1 書類作成: 種類選択 → 生成 → ドラフト表示＋コピー
//   タブ2 規程レビュー: テキスト貼付 → リスク一覧（severity を Badge で）
//     ＋ F1 規程まるごと取込: レビューで抽出した自社ルール候補を取捨選択し、
//       規程の原文まるごとを就業規則AIの記憶に保存（以降のチャットが原文参照で答える）。
// ============================================================================

const DOCUMENT_TYPES = ['36協定', '就業規則', '賃金規程', '労働条件通知書']

// 取込時の原文上限（/api/company/document/ingest の MAX_CONTENT と一致させる）。
const INGEST_MAX_CHARS = 100000

interface ReviewItem {
  severity: 'high' | 'medium' | 'low'
  category: string
  clause: string
  issue: string
  suggestion: string
}

/** レビューが規程から抽出した自社ルール候補（承認したものだけ保存される）。 */
interface CompanyFact {
  key: string
  value: string
}

/** 取込済み規程のメタ（一覧表示用・原文は含まない）。 */
interface IngestedDoc {
  id: string
  title: string
  doc_type: string | null
  char_count: number
  updated_at: string
}

const SEVERITY: Record<ReviewItem['severity'], { label: string; tone: 'danger' | 'warning' | 'info' }> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warning' },
  low: { label: '低', tone: 'info' },
}

function DocumentsInner() {
  const params = useSearchParams()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''

  const [tab, setTab] = useState<'generate' | 'review'>('review')
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
  // 2026-07-24 成長施策: 日次上限(429・upgradeAvailable=true)を「プランを見る」トースト
  //   アクションに変換する（書類作成/規程レビューの両429で共通利用）。
  const showRateLimitToast = useCallback(
    (data: { error?: string; upgradeAvailable?: boolean }, fallback: string) => {
      if (data.upgradeAvailable) {
        showToast(data.error ?? fallback, {
          label: 'プランを見る',
          onClick: () => {
            track('documents_upgrade_prompt_click')
            router.push(`/company/billing?companyId=${companyId}`)
          },
        })
      } else {
        showToast(data.error ?? fallback)
      }
    },
    [showToast, router, companyId],
  )

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
        if (res.status === 429) showRateLimitToast(data, '生成に失敗しました')
        else showToast(data.error ?? '生成に失敗しました')
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

  // D13: 生成結果をワンクリックで .txt ダウンロード（プレーンテキストコピーは維持）。
  //   Word等の形式変換はしない（体裁の崩れた文書を「完成品」に見せない・Phase1）。
  function downloadDraft() {
    if (!draft) return
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docType}_ドラフト_${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    track('document_downloaded', { doc_type: docType })
  }

  // --- タブ2: 規程レビュー ---
  const [reviewText, setReviewText] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [unreadNote, setUnreadNote] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [summary, setSummary] = useState('')
  const [disclaimer, setDisclaimer] = useState('')

  // --- F1 規程まるごと取込 ---
  //   facts: レビューが抽出した自社ルール候補 / factChecked: 保存するものの取捨選択
  //   ingestTitle: 保存する規程名（同名は差替え） / ingested: 取込済み規程の一覧
  const [facts, setFacts] = useState<CompanyFact[]>([])
  const [factChecked, setFactChecked] = useState<boolean[]>([])
  const [ingestTitle, setIngestTitle] = useState('就業規則')
  const [ingesting, setIngesting] = useState(false)
  const [ingested, setIngested] = useState<IngestedDoc[]>([])
  // D22: 同名規程の再取込（改定）時にサーバが生成する「何が変わったか」の差分要約。
  //   初回取込では null（サーバ側で LLM を呼ばない）。トーストは消えるため、
  //   要約はカードで残して読める形にする。
  const [changeSummary, setChangeSummary] = useState<string | null>(null)

  async function extractFile(file: File) {
    if (extracting) return
    setExtracting(true)
    setUnreadNote(null)
    try {
      const form = new FormData()
      form.set('companyId', companyId)
      form.set('file', file)
      const res = await fetch('/api/company/document/extract', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? 'ファイルの読み取りに失敗しました')
        return
      }
      const text = typeof data.text === 'string' ? data.text : ''
      if (text) setReviewText(text)
      if (!ingestTitle || ingestTitle === '就業規則') {
        const base = String(data.filename ?? file.name).replace(/\.[^.]+$/, '')
        if (base) setIngestTitle(base.slice(0, 100))
      }
      const note = typeof data.unreadNote === 'string' ? data.unreadNote : null
      setUnreadNote(note)
      if (note && !text) showToast(note)
      else if (text) showToast(note ? `本文を読みました。${note}` : '本文を読みました。下でレビューできます。')
    } catch {
      showToast('ファイルの読み取りに失敗しました。通信を確認してください。')
    } finally {
      setExtracting(false)
    }
  }

  const loadIngested = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/company/document/ingest?companyId=${companyId}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) setIngested(data.documents ?? [])
    } catch {
      // 一覧はベストエフォート（未取込/未適用でも他機能を妨げない）
    }
  }, [companyId])

  useEffect(() => {
    loadIngested()
  }, [loadIngested])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    void (async () => {
      const pendingBefore = readPendingZure()
      const ok = await ingestPendingZure(companyId)
      if (cancelled) return
      if (ok) {
        setTab('review')
        await loadIngested()
        showToast('就業規則のファイルを残しました。')
        return
      }
      if (pendingBefore) {
        showToast('1枚を残す操作が終わりませんでした。下の欄に、同じファイルを置いてください。')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, loadIngested, showToast])

  async function review() {
    if (reviewing || reviewText.trim().length < 10) {
      if (reviewText.trim().length < 10) showToast('規程テキストを貼り付けてください')
      return
    }
    setReviewing(true)
    setItems(null)
    setSummary('')
    setFacts([])
    setFactChecked([])
    try {
      const res = await fetch('/api/company/document/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, documentText: reviewText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) showRateLimitToast(data, 'レビューに失敗しました')
        else showToast(data.error ?? 'レビューに失敗しました')
        return
      }
      setItems(data.items ?? [])
      setSummary(data.summary ?? '')
      setDisclaimer(data.disclaimer ?? '')
      // F1: 抽出された自社ルール候補は既定で全チェック（外すのはユーザーの取捨選択）
      const extracted: CompanyFact[] = data.companyFacts ?? []
      setFacts(extracted)
      setFactChecked(extracted.map(() => true))
    } catch {
      showToast('レビューに失敗しました。通信を確認してください。')
    } finally {
      setReviewing(false)
    }
  }

  // F1: 規程原文まるごと＋承認済みルール候補を就業規則AIの記憶へ保存する。
  async function ingest() {
    if (ingesting) return
    if (reviewText.trim().length < 10) {
      showToast('取り込む規程テキストを貼り付けてください')
      return
    }
    if (!ingestTitle.trim()) {
      showToast('規程名を入力してください')
      return
    }
    setIngesting(true)
    setChangeSummary(null)
    try {
      const selected = facts.filter((_, i) => factChecked[i])
      const res = await fetch('/api/company/document/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: ingestTitle.trim(),
          docType: '規程',
          documentText: reviewText,
          profiles: selected,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '取込に失敗しました')
        return
      }
      const savedProfiles: number = data.savedProfiles ?? 0
      // D22: 改定（同名再取込）ならサーバが差分要約を返す。カードで常設表示する。
      const summary: string | null =
        typeof data.changeSummary === 'string' && data.changeSummary ? data.changeSummary : null
      setChangeSummary(summary)
      showToast(
        summary
          ? `「${data.document?.title ?? ingestTitle}」を更新しました（変更点を要約しました）`
          : savedProfiles > 0
            ? `「${data.document?.title ?? ingestTitle}」を覚えました（自社ルール${savedProfiles}件も登録）`
            : `「${data.document?.title ?? ingestTitle}」を覚えました`,
      )
      // 計測: 規程取込（看板「会社を覚える」の実体・非PII: 件数のみ）。
      track('document_ingested', { fact_count: savedProfiles })
      await loadIngested()
    } catch {
      showToast('取込に失敗しました。通信を確認してください。')
    } finally {
      setIngesting(false)
    }
  }

  async function removeIngested(doc: IngestedDoc) {
    try {
      const res = await fetch('/api/company/document/ingest', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, id: doc.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '削除に失敗しました')
        return
      }
      showToast(`「${doc.title}」の記憶を削除しました`)
      await loadIngested()
    } catch {
      showToast('削除に失敗しました')
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
        description="就業規則のファイルを置くと、ずれの1枚が会社に残ります。相談はそのあとです。"
      />

      {ingested.length === 0 && (
        <p className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-relaxed text-neutral-800">
          まだ就業規則は残っていません。下の「規程をレビュー」からファイルを置くか、テキストを貼り付けてください。
        </p>
      )}

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
                className="w-full rounded-xl border border-neutral-500 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-600">生成されたドラフト</span>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={copyDraft}>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    コピー
                  </Button>
                  {/* D13: ワンクリック保存（.txt）。 */}
                  <Button variant="secondary" size="sm" onClick={downloadDraft}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    ダウンロード
                  </Button>
                </div>
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
              <label htmlFor="review-file" className="mb-1.5 block text-sm font-medium text-neutral-700">
                ファイルから本文を取り込む（PDF・Word・テキスト）
              </label>
              <input
                id="review-file"
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
                disabled={extracting}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void extractFile(file)
                  e.target.value = ''
                }}
                className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
              />
              <p className="mt-1 text-xs text-neutral-500">
                {extracting
                  ? '読み取り中です…'
                  : '本文が取れた分だけ下に入ります。スキャン画像など取れなかったページは未読として残します。'}
              </p>
              {unreadNote && (
                <p className="mt-1 text-xs leading-relaxed text-warning-700">{unreadNote}</p>
              )}
            </div>
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
                maxLength={INGEST_MAX_CHARS}
                className="resize-y"
              />
              <p className="mt-1 text-xs text-neutral-500">
                レビューは先頭20,000字が対象です。「就業規則AIに覚えさせる」では貼り付けた全文が記憶されます。
              </p>
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

              {/* F1 規程まるごと取込: レビュー後に「この規程を就業規則AIに覚えさせる」を提示 */}
              <Card className="space-y-4 border-brand-200 bg-brand-50/40">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <BookMarked className="h-4 w-4 text-brand-600" aria-hidden />
                    この規程を就業規則AIに覚えさせる
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                    貼り付けた規程の全文を記憶します。以降の相談で「自社の規程では第○条に〜」と、
                    自社の条文を参照した回答ができるようになります（管理者のみ・同じ規程名は上書き）。
                  </p>
                </div>

                {facts.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-neutral-700">
                      この規程から読み取れた自社ルール候補（チェックした項目を自社ルールにも登録します）
                    </p>
                    <ul className="space-y-1.5">
                      {facts.map((f, i) => (
                        <li key={`${f.key}-${i}`}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={factChecked[i] ?? false}
                              onChange={() =>
                                setFactChecked(prev => prev.map((c, j) => (j === i ? !c : c)))
                              }
                              className="mt-0.5 h-4 w-4 rounded border-neutral-500 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="min-w-0">
                              <span className="font-medium text-brand-700">{f.key}</span>
                              <span className="text-neutral-700">：{f.value}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={ingestTitle}
                    onChange={e => setIngestTitle(e.target.value)}
                    placeholder="規程名（例：就業規則）"
                    maxLength={100}
                    className="sm:w-1/2"
                    aria-label="規程名"
                  />
                  <Button onClick={ingest} disabled={ingesting} className="flex-1">
                    <Check className="h-4 w-4" aria-hidden />
                    {ingesting ? '取込中...' : '全文を覚えさせる'}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* D22: 規程改定の差分要約（同名再取込時のみサーバが生成・記憶にも保存済み） */}
          {changeSummary && (
            <Card className="space-y-1.5 border-brand-200 bg-brand-50/50">
              <p className="text-sm font-medium text-brand-800">
                前回の取込からの変更点（自動要約）
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {changeSummary}
              </p>
              <p className="text-xs text-neutral-500">
                この要約は会社の記憶にも保存しました。以降の相談で参照されます。
              </p>
            </Card>
          )}

          {/* 取込済み規程の一覧（会社の記憶として保持中） */}
          {ingested.length > 0 && (
            <Card className="space-y-2">
              <p className="text-sm font-medium text-neutral-600">就業規則AIが覚えている規程</p>
              <ul className="space-y-1.5">
                {ingested.map(doc => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-neutral-900">{doc.title}</span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {doc.char_count.toLocaleString()}字・
                        {new Date(doc.updated_at).toLocaleDateString('ja-JP')}取込
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeIngested(doc)}
                      aria-label={`${doc.title}の記憶を削除`}
                      className="shrink-0 text-neutral-500 hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
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

export default function CompanyDocumentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <DocumentsInner />
      </CompanyGuard>
    </Suspense>
  )
}
