'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { CompanyGuard } from '../_components/CompanyGuard'
import { KASUHARA_MEASURES, type MeasureVerdict } from '@/lib/kasuhara/measures'

// ============================================================================
// /company/kasuhara — カスハラ10措置 診断履歴（Kabau×番頭 1本化 Phase 2-5）
//   /zure の匿名診断は、控えメールのアドレスがログインメールと一致すると
//   この会社に自動で引き継がれる（API側 claim）。ここは履歴の閲覧と再診断への導線だけ。
//   保存しているのは判定（○△×・条番号参照）のみで、規則本文は保存していない。
// ============================================================================

interface AssessmentRow {
  id: string
  measures: { n: number; verdict: MeasureVerdict; evidence: string; note: string }[]
  policy_generated_at: string | null
  created_at: string
}

function counts(measures: AssessmentRow['measures']) {
  const c = { ok: 0, weak: 0, missing: 0 }
  for (const m of measures ?? []) if (m.verdict in c) c[m.verdict]++
  return c
}

function KasuharaInner() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('companyId') ?? ''
  const [rows, setRows] = useState<AssessmentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/company/kasuhara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyId ? { companyId } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '読み込めませんでした')
        return
      }
      setRows(data.assessments ?? [])
    } catch {
      setError('通信を確認してください')
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="カスハラ10措置"
        description="就業規則と10措置（2026年10月1日義務化）の照合履歴です。診断は入口（ファイルを置く）から実行できます。"
      />

      {error && <p className="mt-4 text-sm text-danger-600">{error}</p>}
      {!error && rows === null && <p className="mt-4 text-sm text-neutral-500">読み込み中...</p>}

      {rows !== null && rows.length === 0 && (
        <Card padded className="mt-4">
          <p className="text-sm text-neutral-700">この会社に紐付いた診断はまだありません。</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            <Link href="/zure" className="text-brand-600 underline underline-offset-2 hover:text-brand-700">
              就業規則のファイルを置く
            </Link>
            と、10措置との照合（○△×）と規程追補案がその場で出ます。診断画面で控えメールに
            このアカウントのメールアドレスを使うと、次回からここに履歴が並びます。
          </p>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {(rows ?? []).map(r => {
          const c = counts(r.measures)
          const gaps = (r.measures ?? []).filter(m => m.verdict !== 'ok')
          return (
            <Card key={r.id} padded>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-neutral-900">
                  {new Date(r.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <Badge tone={c.missing + c.weak === 0 ? 'success' : 'warning'}>
                  ○{c.ok} ／ △{c.weak} ／ ×{c.missing}
                </Badge>
                {r.policy_generated_at && <Badge tone="neutral">追補案 作成済み</Badge>}
              </div>
              {gaps.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {gaps.map(m => {
                    const def = KASUHARA_MEASURES.find(x => x.n === m.n)
                    return (
                      <li key={m.n}>
                        <span className="font-medium">{m.verdict === 'weak' ? '△' : '×'} 措置{m.n} {def?.title}</span>
                        {m.evidence && <span className="ml-1 text-xs text-neutral-500">（根拠: {m.evidence}）</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
              {gaps.length === 0 && (
                <p className="mt-2 text-sm text-neutral-600">10措置すべてに対応する定めが見つかっています。</p>
              )}
            </Card>
          )
        })}
      </div>

      {rows !== null && rows.length > 0 && (
        <p className="mt-4 text-sm text-neutral-600">
          規則を変えたら、
          <Link href="/zure" className="text-brand-600 underline underline-offset-2 hover:text-brand-700">
            もう一度ファイルを置いて再診断
          </Link>
          できます。
        </p>
      )}
    </div>
  )
}

export default function CompanyKasuharaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <KasuharaInner />
      </CompanyGuard>
    </Suspense>
  )
}
