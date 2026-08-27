'use client'

import { Suspense, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileBarChart, Copy, Check, UserCog } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Textarea } from '@/components/ui/Textarea'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/reports — F6「経営者向け1枚報告」/ F5「社労士連携メモ」
//   就業規則AIが覚えている会社データ（基本情報・規程・近い期限・過去の判断・未登録項目）を、
//   mode で2通りに整理して生成・表示・コピーする:
//     - owner（F6）    ＝経営者本人向けの1枚まとめ。
//     - sharoushi（F5）＝会社が相談する社労士に渡す下準備メモ（相談論点付き）。
//   事実はサーバ（lib/report.ts）でコード組み立て・LLM は体裁のみ（ハルシネーション防止）。
//   期日はユーザーが確定した登録内容のみを載せる（Phase1）。
// ============================================================================

type ReportMode = 'owner' | 'sharoushi'

function ReportsInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // D05/I08: チャットのアクションチップ「社労士に渡すメモを作る」から ?mode=sharoushi で
  //   遷移してきたときは、最初から社労士メモのタブを開く（URL 指定が初期値・以降は手動切替）。
  const [mode, setMode] = useState<ReportMode>(
    params.get('mode') === 'sharoushi' ? 'sharoushi' : 'owner',
  )
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState('')
  const [copied, setCopied] = useState(false)
  const [advisorText, setAdvisorText] = useState('')
  const [savingAdvisor, setSavingAdvisor] = useState(false)

  // mode を切り替えたら前の生成結果を消す（別種のメモが混ざらないように）。
  const switchMode = useCallback((next: ReportMode) => {
    setMode(next)
    setReport('')
    setCopied(false)
  }, [])

  async function generate() {
    if (generating) return
    setGenerating(true)
    setReport('')
    setCopied(false)
    try {
      const res = await fetch('/api/company/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '生成に失敗しました')
        return
      }
      setReport(data.text ?? '')
      track('report_generated', { source: data.source ?? 'unknown', mode })
    } catch {
      showToast('生成に失敗しました。通信を確認してください。')
    } finally {
      setGenerating(false)
    }
  }

  async function copyReport() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('コピーに失敗しました')
    }
  }

  async function saveAdvisor() {
    if (savingAdvisor) return
    setSavingAdvisor(true)
    try {
      const res = await fetch('/api/company/memory?action=advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, text: advisorText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '記録に失敗しました')
        return
      }
      setAdvisorText('')
      showToast('社労士の返事を外部確定として残しました')
      track('advisor_writeback_saved')
    } catch {
      showToast('記録に失敗しました。通信を確認してください。')
    } finally {
      setSavingAdvisor(false)
    }
  }

  const isSharoushi = mode === 'sharoushi'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="経営のまとめ・社労士に渡すメモ"
        description="就業規則AIが覚えている会社の情報を、目的に合わせて整理します。数値や期限は登録済みの内容にもとづきます。"
      />

      {/* mode 切替: 経営者向けまとめ（F6）/ 社労士に渡すメモ（F5） */}
      <div className="mt-4 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => switchMode('owner')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            !isSharoushi ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          経営者向けまとめ
        </button>
        <button
          type="button"
          onClick={() => switchMode('sharoushi')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            isSharoushi ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          社労士に渡すメモ
        </button>
      </div>

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          {isSharoushi ? (
            <UserCog className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          ) : (
            <FileBarChart className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          )}
          <div className="text-sm text-neutral-700">
            {isSharoushi ? (
              <p>顧問社労士や相談先の社労士に渡すための下準備メモです。基本情報・整備済みの規程・近い期限・会社で決めた運用に加えて、相談したい論点を整理します。相談の往復を減らすための資料です。</p>
            ) : (
              <p>基本情報・覚えている規程・近づいている期限・最近の判断・次に登録するとよい項目を、1枚にまとめます。</p>
            )}
          </div>
        </div>
        <Button
          onClick={generate}
          disabled={generating}
          className="mt-4"
        >
          {generating ? '作成中...' : isSharoushi ? 'メモを作成する' : 'まとめを作成する'}
        </Button>
      </Card>

      {report && (
        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">{isSharoushi ? '社労士相談メモ' : 'まとめ'}</h2>
            <Button variant="secondary" onClick={copyReport}>
              {copied ? (
                <>
                  <Check className="mr-1 h-4 w-4" aria-hidden />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" aria-hidden />
                  コピー
                </>
              )}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800">
            {report}
          </pre>
        </Card>
      )}

      {isSharoushi && (
        <Card className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">社労士の返事を台帳へ戻す</h2>
          <p className="text-sm leading-relaxed text-neutral-600">
            就業規則AIは助言しません。事務所から返ってきた内容を、会社の「外部確定」として残します。
          </p>
          <Textarea
            value={advisorText}
            onChange={e => setAdvisorText(e.target.value)}
            rows={5}
            placeholder="例：試用期間の延長は就業規則に根拠を入れてから、との返事でした。"
          />
          <Button onClick={saveAdvisor} disabled={savingAdvisor || advisorText.trim().length < 8}>
            {savingAdvisor ? '記録中...' : '外部確定として残す'}
          </Button>
        </Card>
      )}

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function CompanyReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <ReportsInner />
      </CompanyGuard>
    </Suspense>
  )
}
