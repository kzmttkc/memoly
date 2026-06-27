'use client'

import { Suspense, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Building2, Check } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast } from '@/components/ui/Toast'
import { track } from '@/lib/analytics'
import {
  INDUSTRY_MAJORS,
  EMPLOYEE_BANDS,
  BOOL_QUESTIONS,
  triToBool,
  type TriState,
} from '@/lib/company-attributes'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/onboarding — 会社作成後の「5問 構造化ウィザード」
//   集合知モート（#5）の正規化属性 company_attributes を取る入口。
//   全項目ドロップダウン/トグル＝LLM非依存・決定的（集計の純度を守る）。
//     1. 業種（JSIC大分類のドロップダウン）
//     2. 従業員規模（バンドのドロップダウン）
//     3. 36協定の有無（はい/いいえ/わからない）
//     4. 就業規則の有無（はい/いいえ/わからない）
//     5. 固定残業代の有無（はい/いいえ/わからない）
//   ★三値: 「わからない」は null で保存し false と取り違えない（誤集計防止）。
//   admin のみ保存可（/api/company/attributes が requireAdmin）。
//   保存後は会社ホームへ。スキップも可（後から編集できる前提）。
//   ★UIに同業比較/ベンチマークは一切出さない（発動は50社後）。
// ============================================================================

function OnboardingInner() {
  const params = useSearchParams()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''

  const [industry, setIndustry] = useState('')
  const [band, setBand] = useState('')
  const [tri, setTri] = useState<Record<string, TriState>>(
    Object.fromEntries(BOOL_QUESTIONS.map(q => [q.key, 'unknown'])),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  const homeHref = `/company/home?companyId=${companyId}`

  async function save() {
    if (saving || !companyId) return
    setSaving(true)
    try {
      const res = await fetch('/api/company/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          industry_major: industry || null,
          employee_band: band || null,
          has_36kyotei: triToBool(tri.has_36kyotei),
          has_work_rules: triToBool(tri.has_work_rules),
          has_fixed_ot: triToBool(tri.has_fixed_ot),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '保存に失敗しました')
        setSaving(false)
        return
      }
      // 計測: 会社プロファイルの初回登録成功＝活性化（活性化〜蓄積ファネルの起点）。PIIは送らない。
      track('company_activated')
      router.push(homeHref)
    } catch {
      showToast('保存に失敗しました。通信を確認してください。')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="会社の基本情報を登録"
        description="5つの質問に答えると、自社の前提に沿った相談・診断の精度が上がります。あとから変更できます。"
      />

      <Card className="space-y-6">
        {/* 1. 業種 */}
        <div>
          <label htmlFor="ob-industry" className="mb-1.5 block text-sm font-medium text-neutral-700">
            業種
          </label>
          <select
            id="ob-industry"
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

        {/* 2. 従業員規模 */}
        <div>
          <label htmlFor="ob-band" className="mb-1.5 block text-sm font-medium text-neutral-700">
            従業員数
          </label>
          <select
            id="ob-band"
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

        {/* 3-5. 制度の有無（三値トグル） */}
        {BOOL_QUESTIONS.map(q => (
          <div key={q.key}>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">{q.label}</p>
            <p className="mb-2 text-xs leading-relaxed text-neutral-500">{q.help}</p>
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

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5">
          <Button size="lg" onClick={save} disabled={saving}>
            <Check className="h-4 w-4" aria-hidden />
            {saving ? '保存中...' : '登録して始める'}
          </Button>
          <Link href={homeHref} className={buttonClass({ variant: 'ghost' })}>
            あとで入力する
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            この情報は自社内でのみ利用されます
          </span>
        </div>
      </Card>

      <Toast
        show={toast.show}
        message={toast.message}
        onHide={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  )
}

export default function CompanyOnboardingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <OnboardingInner />
      </CompanyGuard>
    </Suspense>
  )
}
