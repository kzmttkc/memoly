'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Share2, MessageSquareText, ClipboardList } from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { RiskMeterHero, RiskMeterBar } from '@/components/ui/RiskMeter'
import { CompanyGuard } from '../_components/CompanyGuard'
import { AttributesForm } from '../_components/AttributesForm'
import { track } from '@/lib/analytics'

// ============================================================================
// /company/risk — 労務リスク・セルフ監査スコア（集客/バイラル）
//   「労務リスク診断を実行」→ RiskMeter(数値+帯ラベル) + カテゴリ別バー + 上位ポイント。
//   結果 → 「この内容でAIに相談」導線でチャットへ送る。
//   シェア用サマリ文（会社名は伏せる）をクリップボードにコピー。
// ============================================================================

interface Category {
  name: string
  score: number
  note: string
}

interface TopRisk {
  title: string
  severity: 'high' | 'medium' | 'low'
  why: string
  fix: string
}

interface RiskResult {
  score: number
  level: string
  categories: Category[]
  topRisks: TopRisk[]
  summary: string
  disclaimer: string
}

const SEVERITY: Record<TopRisk['severity'], { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warning' },
  low: { label: '低', tone: 'neutral' },
}

function RiskInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [toast, setToast] = useState({ show: false, message: '' })
  // 診断前の「未回答属性の差し込み」（#5集合知の正規化属性 company_attributes）。
  //   業種 or 規模 が未回答なら、診断ボタンの前にミニフォームを出して登録を促す。
  //   登録は精度向上のため（任意・スキップ可）。集計の素も同時に貯まる。
  const [needAttrs, setNeedAttrs] = useState(false)
  const [attrsChecked, setAttrsChecked] = useState(false)
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // マウント時に正規化属性の充足を確認（業種/規模が空なら差し込みフォームを出す）。
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/attributes?companyId=${companyId}`)
        const d = await r.json().catch(() => ({}))
        const a = d.attributes
        const incomplete = !a || !a.industry_major || !a.employee_band
        if (!cancelled) {
          setNeedAttrs(incomplete)
          setAttrsChecked(true)
        }
      } catch {
        if (!cancelled) setAttrsChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [companyId])

  async function run() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/company/risk-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '診断に失敗しました')
        return
      }
      setResult(data as RiskResult)
      // 計測: リスク診断完了。スコアは帯（0-40/40-70/70-100）に丸めて非PII化して送る。
      const score = typeof data.score === 'number' ? data.score : null
      const band = score === null ? 'unknown' : score < 40 ? '0-40' : score < 70 ? '40-70' : '70-100'
      track('risk_audit_completed', { overall_band: band })
    } catch {
      showToast('診断に失敗しました。通信を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // シェア用サマリ文。会社名は伏せ、当事者性のある数字でSNS共有を促す。
  function buildShareText(r: RiskResult): string {
    const top = r.topRisks[0]?.title
    const lines = [
      '自社の労務リスクをAIでセルフ診断してみた',
      '',
      `労務健全度スコア：${r.score}/100（${r.level}）`,
    ]
    if (top) lines.push(`いちばん気になった点：${top}`)
    lines.push('')
    lines.push('会社を覚える労務AIで無料診断 → sharoushi-agent.com')
    lines.push('#労務 #労務リスク診断')
    return lines.join('\n')
  }

  async function copyShare(r: RiskResult) {
    try {
      await navigator.clipboard.writeText(buildShareText(r))
      showToast('シェア用テキストをコピーしました')
    } catch {
      showToast('コピーできませんでした。手動で選択してください。')
    }
  }

  // 「この内容でAIに相談」: 上位リスクを初期メッセージとしてチャットへ渡す。
  function consultHref(r: RiskResult): string {
    const top = r.topRisks[0]
    const q = top
      ? `労務リスク診断の結果、「${top.title}」が気になっています。具体的に何をどう見直せばよいか教えてください。`
      : '労務リスク診断の結果について、優先的に見直すべき点を教えてください。'
    return `/company/chat?companyId=${companyId}&q=${encodeURIComponent(q)}`
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="労務リスク・セルフ診断"
        description="登録済みの自社ルール（労働時間・36協定の状況・有給・就業規則など）をもとに、自社の労務リスクをスコア化します。社内のセルフチェックの目安としてお使いください。"
      />

      {/* 診断前の基本情報の差し込み（未回答のときだけ・精度向上＋集合知の素を同時に貯める）。
          登録すると閉じる。スキップしてそのまま診断も可。 */}
      {attrsChecked && needAttrs && !result && (
        <Card className="mb-6">
          <div className="mb-4 flex items-start gap-2">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                より正確な診断のために、基本情報を登録できます
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                業種・規模・主な制度の有無を登録すると、自社に合った診断になります（任意）。
              </p>
            </div>
          </div>
          <AttributesForm
            companyId={companyId}
            onSaved={() => {
              setNeedAttrs(false)
              showToast('基本情報を登録しました')
            }}
            onError={msg => showToast(msg)}
            submitLabel="登録して診断に進む"
          />
        </Card>
      )}

      <Button size="lg" onClick={run} disabled={loading} className="mb-8 w-full">
        {loading
          ? '診断中...（30秒ほどかかります）'
          : result
            ? '最新の状態で再診断する'
            : '労務リスク診断を実行'}
      </Button>

      {result && (
        <div className="space-y-8">
          {/* ============ 結果カード（screenshotしたくなる体裁） ============ */}
          <Card id="risk-result-card">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">
                番頭 ・ 労務セルフ診断
              </span>
              <span className="text-[10px] text-neutral-400">目安スコア</span>
            </div>

            <RiskMeterHero score={result.score} />

            <div className="mt-5 space-y-2.5">
              {result.categories.map((c, i) => (
                <RiskMeterBar key={i} name={c.name} score={c.score} />
              ))}
            </div>

            {result.summary && (
              <p className="mt-5 border-t border-neutral-200 pt-4 text-sm leading-relaxed text-neutral-700">
                {result.summary}
              </p>
            )}
          </Card>

          {/* ============ アクション導線 ============ */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href={consultHref(result)} className={buttonClass({ variant: 'primary' })}>
              <MessageSquareText className="h-4 w-4" aria-hidden />
              この内容でAIに相談
            </Link>
            <Button variant="secondary" onClick={() => copyShare(result)}>
              <Share2 className="h-4 w-4" aria-hidden />
              結果をシェア
            </Button>
            <span className="text-xs text-neutral-500">
              会社名は伏せたシェア文をコピーします。カードはスクリーンショットでどうぞ。
            </span>
          </div>

          {/* ============ 上位ポイント ============ */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">いま気になる上位ポイント</h2>
            <p className="mb-4 text-xs leading-relaxed text-neutral-500">
              自社の属性から、優先的に確認するとよいと考えられる点です。
            </p>
            {result.topRisks.length === 0 ? (
              <p className="text-sm text-neutral-500">
                大きく気になる点は見つかりませんでした。自社ルールを登録すると精度が上がります。
              </p>
            ) : (
              <div className="space-y-3">
                {result.topRisks.map((r, i) => {
                  const sev = SEVERITY[r.severity]
                  return (
                    <Card key={i} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={sev.tone}>リスク{sev.label}</Badge>
                        <p className="text-sm font-semibold text-neutral-900">{r.title}</p>
                      </div>
                      {r.why && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-700">
                          {r.why}
                        </p>
                      )}
                      {r.fix && (
                        <p className="text-sm leading-relaxed text-brand-700">
                          見直しの方向性：{r.fix}
                        </p>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {result.disclaimer && (
            <p className="border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
              {result.disclaimer}
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

export default function CompanyRiskPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">読み込み中...</p>}>
      <CompanyGuard>
        <RiskInner />
      </CompanyGuard>
    </Suspense>
  )
}
