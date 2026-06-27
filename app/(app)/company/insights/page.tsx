'use client'

import { Suspense, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Banknote, Scale } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { CompanyGuard } from '../_components/CompanyGuard'

// ============================================================================
// /company/insights — 能動インサイト（助成金 / 法改正）
//   「自社が使える助成金」「自社に関係する法改正」を2セクションでカード表示。
// ============================================================================

interface Subsidy {
  name: string
  reason: string
  nextStep: string
}

interface LawChange {
  title: string
  summary: string
  impact: string
  action: string
}

function InsightsInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [subsidies, setSubsidies] = useState<Subsidy[]>([])
  const [lawChanges, setLawChanges] = useState<LawChange[]>([])
  const [disclaimer, setDisclaimer] = useState('')
  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  async function run() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/company/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '取得に失敗しました')
        return
      }
      setSubsidies(data.subsidies ?? [])
      setLawChanges(data.lawChanges ?? [])
      setDisclaimer(data.disclaimer ?? '')
      setLoaded(true)
    } catch {
      showToast('取得に失敗しました。通信を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="自社の労務インサイト"
        description="登録済みのルール（業種・規模・36協定の状況など）をもとに、自社で使える可能性のある助成金と、関係する法改正を自分ごととして整理します。"
      />

      <Button size="lg" onClick={run} disabled={loading} className="mb-8 w-full">
        <Sparkles className="h-4 w-4" aria-hidden />
        {loading ? '診断中...（30秒ほどかかります）' : loaded ? '最新の状態で再診断する' : '自社のインサイトを診断する'}
      </Button>

      {loaded && (
        <div className="space-y-10">
          {/* ---- 自社が使える助成金 ---- */}
          <section>
            <div className="mb-1 flex items-center gap-2">
              <Banknote className="h-5 w-5 text-brand-600" aria-hidden />
              <h2 className="text-lg font-semibold text-neutral-900">自社が使える助成金</h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-neutral-500">
              自社の属性・状況から、対象になりうる助成金の方向性です。
            </p>
            {subsidies.length === 0 ? (
              <p className="text-sm text-neutral-500">
                該当しそうな助成金は見つかりませんでした。自社ルールを登録すると精度が上がります。
              </p>
            ) : (
              <div className="space-y-3">
                {subsidies.map((s, i) => (
                  <Card key={i} className="space-y-2">
                    <p className="text-sm font-semibold text-brand-700">{s.name}</p>
                    {s.reason && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-900">
                        {s.reason}
                      </p>
                    )}
                    {s.nextStep && (
                      <p className="text-sm leading-relaxed text-neutral-600">次の一歩：{s.nextStep}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ---- 自社に関係する法改正 ---- */}
          <section>
            <div className="mb-1 flex items-center gap-2">
              <Scale className="h-5 w-5 text-brand-600" aria-hidden />
              <h2 className="text-lg font-semibold text-neutral-900">自社に関係する法改正</h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-neutral-500">
              近時の労務法改正のうち、自社に影響しうるものと見直しの方向性です。
            </p>
            {lawChanges.length === 0 ? (
              <p className="text-sm text-neutral-500">
                自社に直接関係しそうな法改正は見つかりませんでした。
              </p>
            ) : (
              <div className="space-y-3">
                {lawChanges.map((l, i) => (
                  <Card key={i} className="space-y-2">
                    <p className="text-sm font-semibold text-neutral-900">{l.title}</p>
                    {l.summary && (
                      <p className="text-xs leading-relaxed text-neutral-500">{l.summary}</p>
                    )}
                    {l.impact && (
                      <p className="text-sm leading-relaxed text-neutral-900">自社への影響：{l.impact}</p>
                    )}
                    {l.action && (
                      <p className="text-sm leading-relaxed text-brand-700">見直しの方向性：{l.action}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          {disclaimer && (
            <p className="border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
              {disclaimer}
            </p>
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

export default function CompanyInsightsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <InsightsInner />
      </CompanyGuard>
    </Suspense>
  )
}
