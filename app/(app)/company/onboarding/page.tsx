'use client'

import { Suspense, useState, useCallback, useEffect, useMemo } from 'react'
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
import { computeFallbackRiskAudit } from '@/lib/risk-fallback'
import { CompanyGuard } from '../_components/CompanyGuard'
import { localizeError } from '../_components/errors'
import { PAID_PLAN_IDS, type PlanId } from '@/lib/plans'

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

// オンボA/B変種レール（app/business/_lib/variant.ts と同じ割付流儀を踏襲）:
//   スキップ導線の視覚格下げ実験。LP実験(banto_lp_variant)とは別キーで独立させ、
//   一方の割付が他方に相関しないようにする。着地時に1回だけ50/50でバケット固定し、
//   以降の同一来訪者は常に同じ変種。SSR/初回ハイドレーションは常に 'A'（現状UIと一致）、
//   マウント後の useEffect で実バケットへ更新する（'A' は回帰ゼロ・'B' のみ差し替え）。
//   値は 'A' | 'B' の2値のみ・PIIは載せない（既存 track 規約を継承）。
const ONBOARDING_VARIANT_KEY = 'banto_onboarding_variant'

function getOnboardingVariant(): 'A' | 'B' {
  if (typeof window === 'undefined') return 'A'
  try {
    const stored = window.localStorage.getItem(ONBOARDING_VARIANT_KEY)
    if (stored === 'A' || stored === 'B') return stored
    const assigned: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B'
    window.localStorage.setItem(ONBOARDING_VARIANT_KEY, assigned)
    return assigned
  } catch {
    return 'A'
  }
}

function OnboardingInner() {
  const params = useSearchParams()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''
  // 2026-07-26 CTO修正(I3導線バグ): 士業LP CTA(/signup?plan=shigyo)由来の意図を
  //   5問ウィザードの後まで持ち回る。5問自体（自社属性の集合知モート）は不変で、
  //   保存/スキップ後の「次の一歩」だけを billing（該当プラン事前選択）に差し替える
  //   （通常フローの risk 診断誘導は plan 無指定時のみ・既存挙動不変）。
  const planParam = (() => {
    const raw = (params.get('plan') ?? '').trim()
    return PAID_PLAN_IDS.includes(raw as PlanId) ? (raw as PlanId) : ''
  })()

  const [industry, setIndustry] = useState('')
  const [band, setBand] = useState('')
  const [tri, setTri] = useState<Record<string, TriState>>(
    Object.fromEntries(BOOL_QUESTIONS.map(q => [q.key, 'unknown'])),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // 変種はSSR/初回は 'A'（現状UI）。マウント後に実バケットへ更新し、その時点で
  // onboarding_started を1回だけ発火する（活性化ファネルの分母＝到達を点灯）。
  const [variant, setVariant] = useState<'A' | 'B'>('A')
  useEffect(() => {
    const v = getOnboardingVariant()
    setVariant(v)
    track('onboarding_started', { variant: v })
  }, [])

  const homeHref = `/company/home?companyId=${companyId}`
  // TTV: 5問の回答を「集めて終わり」にせず、登録直後に自社専用のリスク診断を即提示する。
  //   空のホームでなく、答えた内容がその場で診断結果になる＝「会社が覚えられた」を最短で体感させる。
  const riskHref = `/company/risk?companyId=${companyId}&from=onboarding`
  // 士業CTA由来(planParam)の場合のみ「次の一歩」を billing に差し替える
  // （該当プランを billing 側で事前選択・ハイライトする。plan 無指定時は従来どおり不変）。
  const nextHref = planParam
    ? `/company/billing?companyId=${companyId}&plan=${planParam}`
    : riskHref
  const skipHref = planParam
    ? `/company/billing?companyId=${companyId}&plan=${planParam}`
    : homeHref

  // 実際に何か操作したか（速報プレビューの表示条件）。着地直後の無操作でスコアを
  //   出さないためのフラグ。業種/規模/三値のいずれかを触ると true になる。
  const [touched, setTouched] = useState(false)

  // C-2(2026-07-24) 「わからない」プリ選択と「0/5・登録無効」の矛盾を解消する（P07）。
  //   3つの制度設問は初期値「わからない」が視覚的に選択状態（brand色ハイライト）で描画され、
  //   ユーザーには最初から「回答済み」に見える。にもかかわらず旧実装は unknown を未回答扱いにして
  //   「回答0/5・登録ボタン無効」の行き止まりを作っていた。「わからない」も明示的な回答（三値の一つ）
  //   として数え、常に登録へ進めるようにする。初心者が「もう全部選んでいるのに進めない」で詰まらない。
  //   ※保存値は不変: triToBool(unknown)=null で保存し false と取り違えない（集計純度は保たれる）。
  const answeredCount =
    (industry !== '' ? 1 : 0) +
    (band !== '' ? 1 : 0) +
    BOOL_QUESTIONS.length // 制度3問は常に選択状態（「わからない」も回答としてカウント）
  const remainingSeconds = Math.max(0, 5 - answeredCount) * 8

  // C09 ライブプレビュー: 答えるたびに、決定的な純関数（LLM・API・DB書込みゼロ）で
  //   速報スコアを再計算して見せる＝「答えるほど診断が具体化する」体験。
  //   risk_audit_completed は発火しない（北極星KPIの分子を汚さない。正式な計測は
  //   /company/risk 側の既存経路のみ）。表記は「速報（目安）」に固定（誠実関所）。
  const preview = useMemo(() => {
    if (!touched) return null
    return computeFallbackRiskAudit({
      industry_major: industry || null,
      employee_band: band || null,
      has_36kyotei: triToBool(tri.has_36kyotei),
      has_work_rules: triToBool(tri.has_work_rules),
      has_fixed_ot: triToBool(tri.has_fixed_ot),
    })
  }, [touched, industry, band, tri])

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
        showToast(localizeError(data.error, '保存に失敗しました'))
        setSaving(false)
        return
      }
      // 計測: 会社プロファイルの初回登録成功＝活性化（活性化〜蓄積ファネルの起点）。PIIは送らない。
      //   variant を載せ、スキップ導線A/Bが活性化率に効いたかを変種別に読めるようにする。
      track('company_activated', { variant })
      // 登録直後に診断へ送り、答えた内容を即「自社のリスク結果」として返す（TTV短縮）。
      // 士業CTA由来なら billing（該当プラン事前選択）へ（上の nextHref 定義参照）。
      router.push(nextHref)
    } catch {
      showToast('保存に失敗しました。通信を確認してください。')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="会社の基本情報を登録"
        description="答えるとその場で、自社の労務リスクのセルフ診断（目安）と年間手続きカレンダーが出ます。総務をお一人で担当している方でも1分ほどで終わります。わからない項目は「わからない」のままで大丈夫です。あとから変更できます。"
      />

      {/* C07: 進捗と残り時間の目安。ゴールまでの短さを常時見せて途中離脱を防ぐ。 */}
      <div className="mb-4" aria-live="polite">
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">回答 {answeredCount}/5</span>
          <span>{answeredCount >= 5 ? 'すべて回答済みです' : `残り約${remainingSeconds}秒`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200" role="presentation">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${(answeredCount / 5) * 100}%` }}
          />
        </div>
      </div>

      <Card className="space-y-6">
        {/* 1. 業種 */}
        <div>
          <label htmlFor="ob-industry" className="mb-1.5 block text-sm font-medium text-neutral-700">
            業種
          </label>
          <select
            id="ob-industry"
            value={industry}
            onChange={e => {
              setIndustry(e.target.value)
              setTouched(true)
            }}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">選択してください</option>
            {INDUSTRY_MAJORS.map(i => (
              <option key={i.code} value={i.code}>
                {'examples' in i && i.examples ? `${i.label}（${i.examples}）` : i.label}
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
            onChange={e => {
              setBand(e.target.value)
              setTouched(true)
            }}
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
                    onClick={() => {
                      setTri(prev => ({ ...prev, [q.key]: val }))
                      setTouched(true)
                    }}
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

        {/* C09: 答えるたびに更新される速報プレビュー（決定的な純関数・通信ゼロ）。
            「答えるほど診断が具体化する」を入力中に体感させる。正式な結果は登録後の
            /company/risk（LLM精査つき）で出す＝ここは目安表記に固定。 */}
        {preview && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
            <p className="text-xs font-medium text-neutral-500">
              ここまでの回答での速報（目安）・答えるほど具体化します
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              労務健全度 {preview.score}/100（{preview.level}）
            </p>
            {preview.topRisks[0] && (
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                いま気になる点：{preview.topRisks[0].title}
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
              登録すると、この続きが自社の診断結果と年間手続きカレンダーになります。スコアはあくまで目安です。
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-5">
          <Button size="lg" onClick={save} disabled={saving}>
            <Check className="h-4 w-4" aria-hidden />
            {saving ? '保存中...' : '登録して始める'}
          </Button>
          {variant === 'B' && (
            <p className="w-full text-sm leading-relaxed text-neutral-600">
              答えると、自社専用の診断がこの場ですぐ出ます。
            </p>
          )}
          <Link
            href={skipHref}
            onClick={() => track('onboarding_skipped', { variant })}
            className={
              variant === 'B'
                ? 'text-sm text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-700'
                : buttonClass({ variant: 'ghost' })
            }
          >
            あとで入力する
          </Link>
          {/* C-2: 「わからない」のままでも進めることを明示（0/5無効の行き止まりを作らない）。 */}
          <p className="w-full text-xs leading-relaxed text-neutral-500">
            わからない項目は「わからない」のままで登録できます（全部わかっていなくて大丈夫です）。
          </p>
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
