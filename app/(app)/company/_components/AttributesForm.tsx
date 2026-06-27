'use client'

import { useState } from 'react'
import {
  INDUSTRY_MAJORS,
  EMPLOYEE_BANDS,
  BOOL_QUESTIONS,
  triToBool,
  boolToTri,
  type TriState,
} from '@/lib/company-attributes'
import { Button } from '@/components/ui/Button'
import { Check } from 'lucide-react'

// ============================================================================
// AttributesForm — 集合知モート用「正規化属性」の入力フォーム（決定的・LLM非依存）
//   オンボーディングと、リスク診断前の「未回答属性の差し込み」で共用する。
//   全項目ドロップダウン/三値トグル。三値「わからない」は null 保存（false と混同しない）。
//   保存は /api/company/attributes(admin)。保存成功で onSaved を呼ぶ。
// ============================================================================

export interface AttributesValue {
  industry_major: string | null
  employee_band: string | null
  has_36kyotei: boolean | null
  has_work_rules: boolean | null
  has_fixed_ot: boolean | null
}

export function AttributesForm({
  companyId,
  initial,
  onSaved,
  onError,
  submitLabel = '保存する',
}: {
  companyId: string
  initial?: Partial<AttributesValue> | null
  onSaved?: (saved: AttributesValue) => void
  onError?: (message: string) => void
  submitLabel?: string
}) {
  const [industry, setIndustry] = useState(initial?.industry_major ?? '')
  const [band, setBand] = useState(initial?.employee_band ?? '')
  const [tri, setTri] = useState<Record<string, TriState>>(
    Object.fromEntries(
      BOOL_QUESTIONS.map(q => [q.key, boolToTri((initial as Record<string, boolean | null>)?.[q.key])]),
    ),
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving || !companyId) return
    setSaving(true)
    const payload: AttributesValue = {
      industry_major: industry || null,
      employee_band: band || null,
      has_36kyotei: triToBool(tri.has_36kyotei),
      has_work_rules: triToBool(tri.has_work_rules),
      has_fixed_ot: triToBool(tri.has_fixed_ot),
    }
    try {
      const res = await fetch('/api/company/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onError?.(data.error ?? '保存に失敗しました')
        setSaving(false)
        return
      }
      onSaved?.(payload)
    } catch {
      onError?.('保存に失敗しました。通信を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="af-industry" className="mb-1.5 block text-sm font-medium text-neutral-700">
          業種
        </label>
        <select
          id="af-industry"
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">選択してください</option>
          {INDUSTRY_MAJORS.map(i => (
            <option key={i.code} value={i.code}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="af-band" className="mb-1.5 block text-sm font-medium text-neutral-700">
          従業員数
        </label>
        <select
          id="af-band"
          value={band}
          onChange={e => setBand(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">選択してください</option>
          {EMPLOYEE_BANDS.map(b => (
            <option key={b} value={b}>
              {b}名
            </option>
          ))}
        </select>
      </div>

      {BOOL_QUESTIONS.map(q => (
        <div key={q.key}>
          <p className="mb-2 text-sm font-medium text-neutral-700">{q.label}</p>
          <div className="flex gap-2" role="group" aria-label={q.label}>
            {(
              [
                ['yes', 'ある'],
                ['no', 'ない'],
                ['unknown', 'わからない'],
              ] as [TriState, string][]
            ).map(([val, lbl]) => {
              const active = tri[q.key] === val
              return (
                <button
                  key={val}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTri(prev => ({ ...prev, [q.key]: val }))}
                  className={
                    active
                      ? 'flex-1 rounded-xl border border-brand-500 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                      : 'flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                  }
                >
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <Button size="lg" onClick={save} disabled={saving} className="w-full">
        <Check className="h-4 w-4" aria-hidden />
        {saving ? '保存中...' : submitLabel}
      </Button>
    </div>
  )
}
