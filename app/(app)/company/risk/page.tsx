'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Share2,
  MessageSquareText,
  ClipboardList,
  CalendarClock,
  Plus,
  FlaskConical,
  Loader2,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { RiskMeterHero, RiskMeterBar } from '@/components/ui/RiskMeter'
import { CompanyGuard } from '../_components/CompanyGuard'
import { AttributesForm } from '../_components/AttributesForm'
import { track } from '@/lib/analytics'
import {
  computeFallbackRiskAudit,
  RISK_AUDIT_DISCLAIMER,
  type RiskFallbackAttributes,
} from '@/lib/risk-fallback'
import { suggestDeadlines } from '@/lib/deadlines'
import type { CompanyAttributesValues } from '@/lib/company'

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

// 年間手続きカレンダー（S1）: /api/company/deadlines?suggest=1 が返す候補の型
//   （lib/deadlines.ts DeadlineSuggestion と同形。決定的ルール・LLM非依存）。
interface DeadlineSuggestion {
  title: string
  timingLabel: string
  hint?: string
  recurrence: 'none' | 'yearly'
}

/**
 * timingLabel の時期順に並べるための序数（表示順のみ・判定ロジックではない）。
 *   「毎年6〜7月ごろ」→6 のように月が読めるものは月順、
 *   月が読めないもの（「有効期間の満了前」等）は末尾に元の順序のまま置く（安定ソート）。
 */
function timingOrder(label: string): number {
  const m = label.match(/毎年(\d{1,2})[〜~]?\d{0,2}月/)
  return m ? Number(m[1]) : 99
}

// ============================================================================
// S3 サンプル会社モード（BANTO_DAY0_SPEC §S3）
//   onboarding をスキップした直後の「空アカウントの受け皿」。純関数
//   computeFallbackRiskAudit() と suggestDeadlines() をクライアントで直接呼び、
//   S1 の診断＋カレンダー合体画面と同じ見た目で即時描画する。
//     - API・LLM・DB書込みゼロ（company_risk_scores に書かない＝集合知を汚さない）
//     - 属性は LP 体験デモ（TryDemo）と同一の固定値。架空であり実在企業ではない
//     - 「架空のサンプル会社」バナー常時表示・シェア/AI相談は無効化
// ============================================================================
const SAMPLE_COMPANY_LABEL = '製造業・8名'
const SAMPLE_COMPANY_ATTRIBUTES: RiskFallbackAttributes & CompanyAttributesValues = {
  industry_major: 'E', // 製造業（JSIC 大分類）
  employee_band: '5-9', // 8名相当のバンド
  has_36kyotei: false, // 36協定なし（デモの主指摘ポイント）
  has_work_rules: true, // 就業規則あり
  has_fixed_ot: false, // 固定残業なし
}

const SEVERITY: Record<TopRisk['severity'], { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: '高', tone: 'danger' },
  medium: { label: '中', tone: 'warning' },
  low: { label: '低', tone: 'neutral' },
}

function RiskInner() {
  const params = useSearchParams()
  const companyId = params.get('companyId') ?? ''
  // オンボ直後の遷移なら、ボタンを押させず即診断を走らせる（TTV短縮の本体）。
  const fromOnboarding = params.get('from') === 'onboarding'
  const autoFired = useRef(false)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [toast, setToast] = useState({ show: false, message: '' })
  // 診断前の「未回答属性の差し込み」（#5集合知の正規化属性 company_attributes）。
  //   業種 or 規模 が未回答なら、診断ボタンの前にミニフォームを出して登録を促す。
  //   登録は精度向上のため（任意・スキップ可）。集計の素も同時に貯まる。
  const [needAttrs, setNeedAttrs] = useState(false)
  const [attrsChecked, setAttrsChecked] = useState(false)
  // 年間手続きカレンダー（S1）: 診断結果の直下に suggest 候補を合体表示する。
  //   null=未取得（読み込み中表示）。候補は登録済み title を API 側が除外して返す。
  const [suggestions, setSuggestions] = useState<DeadlineSuggestion[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // 各候補行の期日入力値（title→YYYY-MM-DD）。日付はユーザーが確定する（Phase1: 断定しない）。
  const [dueInputs, setDueInputs] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState<string | null>(null)
  // S3: サンプル会社モード中か。true の間は fetch を一切行わず、シェア/AI相談/期限登録を
  //   無効化し、全表示面に「架空のサンプル会社」を明示する。
  const [sampleMode, setSampleMode] = useState(false)
  // オンボ直後の TTV 短縮: 実属性から決定的に算出した「速報（自動計算）」を先に描画し、
  //   裏で LLM 精査版へ差し替える。provisional=速報を表示中（AI精査待ち）。
  const [provisional, setProvisional] = useState(false)
  // 属性フェッチ結果を保持（速報の算出に使う。従来は充足判定だけで値を捨てていた）。
  const [companyAttrs, setCompanyAttrs] =
    useState<Parameters<typeof computeFallbackRiskAudit>[0] | null>(null)
  // onboarding の activation 計測(risk_audit_completed{source:onboarding})を1回に保つ。
  const onboardingFired = useRef(false)
  // sample_company_viewed をセッション1回だけ計測するためのフラグ。
  const sampleViewedRef = useRef(false)
  const showToast = useCallback((message: string) => setToast({ show: true, message }), [])

  // 診断結果が出たら、既存 suggest API から年間手続きの候補を取得（新ロジック無し・読取りのみ）。
  //   ★サンプル会社モード中は取得しない（候補は runSample が純関数で同期生成済み。
  //     ネットワーク往復ゼロを保つ）。
  useEffect(() => {
    if (!result || !companyId || sampleMode) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/company/deadlines?companyId=${companyId}&suggest=1`)
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (r.ok) {
          const list = (d.suggestions ?? []) as DeadlineSuggestion[]
          // timingLabel の時期順（月が読めるもの→月順、読めないもの→末尾・元順）。
          setSuggestions([...list].sort((a, b) => timingOrder(a.timingLabel) - timingOrder(b.timingLabel)))
          setIsAdmin(Boolean(d.isAdmin))
        } else {
          setSuggestions([])
        }
      } catch {
        if (!cancelled) setSuggestions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [result, companyId, sampleMode])

  // 候補をワンクリックで登録（既存 POST /api/company/deadlines へ）。
  //   期日は行内の date 入力でユーザーが確定してから押す＝システムは日付を断定しない。
  async function registerSuggestion(s: DeadlineSuggestion) {
    const due = dueInputs[s.title] ?? ''
    if (!due) {
      showToast('期日を選んでから登録してください')
      return
    }
    if (registering) return
    setRegistering(s.title)
    try {
      const res = await fetch('/api/company/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: s.title,
          due_on: due,
          recurrence: s.recurrence,
          source: 'suggested',
          note: s.hint,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? '登録に失敗しました')
        return
      }
      showToast(`「${s.title}」を期限に登録しました`)
      // 登録済みは候補から外す（suggest=1 の再取得でも除外されるが、即時に反映する）。
      setSuggestions(prev => (prev ? prev.filter(x => x.title !== s.title) : prev))
    } catch {
      showToast('登録に失敗しました。通信を確認してください。')
    } finally {
      setRegistering(null)
    }
  }

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
          if (a) setCompanyAttrs(a)
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

  // オンボ直後（from=onboarding）は属性確認が済み次第、自動で1回だけ診断を実行。
  //   登録した内容がそのまま「自社のリスク結果」になり、空状態を渡さない。
  //   ★needAttrs（業種/規模が未回答）の間は保留する: フォーム入力中に自動診断が走ると
  //     結果表示でフォームが unmount され入力が消える競合になるため。フォーム保存完了
  //     （onSaved → needAttrs=false）を待ってから発火する。スキップして手動診断も可。
  useEffect(() => {
    if (!fromOnboarding || !attrsChecked || needAttrs || autoFired.current || !companyId) return
    autoFired.current = true
    track('onboarding_to_risk')
    run('onboarding')
    // run は安定参照不要（autoFired で単発保証）。companyId/attrsChecked/needAttrs 確定後に発火。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromOnboarding, attrsChecked, needAttrs, companyId])

  // source: 診断の発火元（計測 prop）。オンボ直後の自動実行= onboarding／ボタン= manual。
  //   （sample は runSample 側で送る。sample は KPI 分母に入れない）
  async function run(source: 'onboarding' | 'manual' = 'manual') {
    if (loading) return

    // オンボ直後（from=onboarding）は LLM 完了(≈30秒)を待たず、実属性から決定的な
    //   純関数で「速報（自動計算）」を即描画し、価値提供の瞬間に activation を計測する。
    //   その後、裏で LLM 精査版に差し替える（＝TTV 30秒→即時）。属性未取得時は従来どおり
    //   LLM を待つ（graceful）。source='manual' は従来挙動を維持（1変数）。
    const useProvisional = source === 'onboarding' && !!companyAttrs
    if (useProvisional && companyAttrs) {
      const fb = computeFallbackRiskAudit(companyAttrs)
      setSampleMode(false)
      setResult({ ...fb, disclaimer: RISK_AUDIT_DISCLAIMER })
      setProvisional(true)
      if (!onboardingFired.current) {
        onboardingFired.current = true
        const b = fb.score < 40 ? '0-40' : fb.score < 70 ? '40-70' : '70-100'
        // 価値提供の瞬間＝速報の初回描画で発火（BANTO_DAY0_SPEC §2 の分子）。
        //   精査版への差し替えでは再発火しない＝session あたり1回のまま。
        track('risk_audit_completed', { overall_band: b, source: 'onboarding' })
      }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/company/risk-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 速報を出せている場合は致命でない（速報を最終の目安として残す）。
        if (useProvisional) setProvisional(false)
        else showToast(data.error ?? 'セルフ診断に失敗しました')
        return
      }
      // 実データの結果に切り替える。サンプル表示中だった場合はサンプルの候補も破棄し、
      // suggest API から自社の候補を取り直す（下の useEffect が発火する）。
      setSampleMode(false)
      setSuggestions(null)
      setResult(data as RiskResult)
      setProvisional(false)
      // 計測: リスク診断完了。スコアは帯（0-40/40-70/70-100）に丸めて非PII化して送る。
      //   onboarding は速報描画時に発火済み → 二重計上しない。manual のみここで発火。
      if (source === 'manual') {
        const score = typeof data.score === 'number' ? data.score : null
        const band =
          score === null ? 'unknown' : score < 40 ? '0-40' : score < 70 ? '40-70' : '70-100'
        // source prop（BANTO_DAY0_SPEC §2）: 北極星KPI「登録→初回診断到達率」の分子は
        //   risk_audit_completed(source=onboarding) ÷ signup_completed で読む。
        track('risk_audit_completed', { overall_band: band, source })
      }
    } catch {
      if (useProvisional) setProvisional(false)
      else showToast('セルフ診断に失敗しました。通信を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  // S3 サンプル会社モード: 純関数を直接呼んで即時描画する。
  //   fetch を一切しない＝API・LLM・DB書込みゼロ。結果は保存しない
  //   （company_risk_scores に書かない＝集合知テーブルを汚さない）。
  //   免責（RISK_AUDIT_DISCLAIMER）はサンプル経路でもコード強制付与を維持する。
  function runSample() {
    const fb = computeFallbackRiskAudit(SAMPLE_COMPANY_ATTRIBUTES)
    setSampleMode(true)
    setResult({ ...fb, disclaimer: RISK_AUDIT_DISCLAIMER })
    // カレンダー候補も純関数から同期生成（S1 と同じ timingLabel 時期順で表示）。
    setSuggestions(
      [...suggestDeadlines(SAMPLE_COMPANY_ATTRIBUTES)].sort(
        (a, b) => timingOrder(a.timingLabel) - timingOrder(b.timingLabel),
      ),
    )
    // 計測（BANTO_DAY0_SPEC §2）: sample_company_viewed はセッション1回。
    // risk_audit_completed は source='sample' で送り、北極星KPIの分母/分子に入れない。
    if (!sampleViewedRef.current) {
      sampleViewedRef.current = true
      track('sample_company_viewed')
    }
    const band = fb.score < 40 ? '0-40' : fb.score < 70 ? '40-70' : '70-100'
    track('risk_audit_completed', { overall_band: band, source: 'sample' })
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
    lines.push('会社を覚える労務AIで無料セルフ診断 → banto-roumu.com/business')
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
      ? `労務リスクのセルフ診断（目安）の結果、「${top.title}」が気になっています。具体的に何をどう見直せばよいか教えてください。`
      : '労務リスクのセルフ診断（目安）の結果について、優先的に見直すとよい点を教えてください。'
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

      <div className="mb-8 space-y-3">
        <Button size="lg" onClick={() => run('manual')} disabled={loading} className="w-full">
          {loading
            ? 'セルフ診断中...（30秒ほどかかります）'
            : result
              ? sampleMode
                ? '自社の登録内容でセルフ診断する'
                : '最新の状態でもう一度セルフ診断する'
              : '労務リスクをセルフ診断する'}
        </Button>

        {/* ============ S3: サンプル会社モードの入口 ============
            まだ結果がない（onboarding スキップ直後の空アカウント等）ときだけ表示。
            クリックで純関数の結果を即時描画する（登録・通信なし）。 */}
        {!result && !loading && (
          <>
            <Button variant="secondary" onClick={runSample} className="w-full">
              <FlaskConical className="h-4 w-4" aria-hidden />
              サンプル会社で結果を見る
            </Button>
            <p className="text-center text-xs leading-relaxed text-neutral-500">
              まだ情報を入れていなくても、架空のサンプル会社（{SAMPLE_COMPANY_LABEL}
              ）でどんな結果が出るかをすぐに確認できます。
            </p>
          </>
        )}
      </div>

      {result && (
        <div className="space-y-8">
          {/* ============ 速報（自動計算）バナー: オンボ直後のTTV短縮。LLM精査待ちの間だけ表示。 ============
              入力内容から即時に算出した目安を先に見せ、AIが精査したら数値を差し替える。
              景表法: 「目安・精査中で数値が変わることがある」と正直表示（実挙動どおり）。 */}
          {provisional && !sampleMode && (
            <Card className="border-brand-200 bg-brand-50/60">
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    まず自動計算の速報を表示しています
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                    登録内容から即時に算出した目安です。AIがさらに精査しており、数値が変わることがあります。
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ============ S3: 架空のサンプル会社バナー（常時表示・切替導線つき） ============ */}
          {sampleMode && (
            <Card className="border-warning-500/40 bg-warning-50">
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    これは架空のサンプル会社（{SAMPLE_COMPANY_LABEL}）の結果です
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                    実在の会社ではありません。基本情報を登録すると、この同じ画面が自社の結果になります。
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href={`/company/onboarding?companyId=${companyId}`}
                  className={buttonClass({ variant: 'primary' })}
                  onClick={() => track('signup_cta_clicked', { location: 'sample_result' })}
                >
                  自社の情報で診断する（1分・5問）
                </Link>
              </div>
            </Card>
          )}

          {/* ============ 結果カード（screenshotしたくなる体裁） ============ */}
          <Card id="risk-result-card">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">
                {sampleMode
                  ? '番頭 ・ 労務セルフ診断（架空のサンプル会社）'
                  : '番頭 ・ 労務セルフ診断'}
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

          {/* ============ アクション導線 ============
              S3: サンプル会社の結果ではシェア（架空の数字の拡散防止）とAI相談
              （実データのチャットにサンプル前提を持ち込まない）を無効化する。 */}
          {sampleMode ? (
            <p className="text-xs leading-relaxed text-neutral-500">
              サンプル会社の結果のため、シェアとAIへの相談はお使いいただけません。
              自社の情報で診断すると、この場所からそのままAIに相談できます。
            </p>
          ) : (
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
          )}

          {/* ============ 上位ポイント ============ */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">いま気になる上位ポイント</h2>
            <p className="mb-4 text-xs leading-relaxed text-neutral-500">
              {sampleMode
                ? `架空のサンプル会社（${SAMPLE_COMPANY_LABEL}）の属性から、優先的に確認するとよいと考えられる点です。`
                : '自社の属性から、優先的に確認するとよいと考えられる点です。'}
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

          {/* ============ 年間手続きカレンダー（S1: 診断と同一画面で合体表示） ============
              既存 suggest API の候補を timingLabel の時期順に並べるだけ（新ロジック無し）。
              期日は各行の date 入力でユーザーが確定してから登録する（日付を断定しない）。 */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">
              {sampleMode
                ? 'サンプル会社の年間手続きカレンダー（目安）'
                : '自社の年間手続きカレンダー（目安）'}
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-neutral-500">
              {sampleMode
                ? `架空のサンプル会社（${SAMPLE_COMPANY_LABEL}）の場合に、1年のうちに巡ってくる代表的な労務手続きの目安です。自社の情報で診断すると、自社に合わせた候補が並び、期限として登録できます。`
                : '登録された基本情報から、1年のうちに巡ってくる代表的な労務手続きの目安を並べています。期日はご自身で確定してください。登録すると、近づいたときにメールでお知らせします。'}
            </p>
            {suggestions === null ? (
              <p className="text-sm text-neutral-500">カレンダーを読み込み中...</p>
            ) : suggestions.length === 0 ? (
              <Card className="bg-neutral-50">
                <p className="text-sm leading-relaxed text-neutral-600">
                  いま案内できる候補はすべて期限に登録済みです。登録済みの期限は
                  「すべての期限を管理」から確認できます。
                </p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {suggestions.map(s => (
                  <li
                    key={s.title}
                    className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                          <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                          {s.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          時期の目安：{s.timingLabel}
                          {s.recurrence === 'yearly' && '・毎年'}
                        </span>
                        {s.hint && (
                          <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                            {s.hint}
                          </span>
                        )}
                      </span>
                    </div>
                    {/* S3: サンプル表示では登録UIを出さない（架空属性由来の候補を
                        実データの期限に書き込ませない＝DB書込みゼロを保つ）。 */}
                    {!sampleMode && isAdmin && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-xs text-neutral-500">
                          期日を確定：
                          <input
                            type="date"
                            value={dueInputs[s.title] ?? ''}
                            onChange={e =>
                              setDueInputs(prev => ({ ...prev, [s.title]: e.target.value }))
                            }
                            aria-label={`${s.title}の期日`}
                            className="ml-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                          />
                        </label>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => registerSuggestion(s)}
                          disabled={registering === s.title}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {registering === s.title ? '登録中...' : 'この期限を登録'}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* S3: サンプル表示では期限管理への導線を出さない（実データ画面との混同防止。
                切替はバナーの「自社の情報で診断する」に一本化）。 */}
            {!sampleMode && (
              <div className="mt-4">
                <Link
                  href={`/company/deadlines?companyId=${companyId}`}
                  className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  すべての期限を管理 →
                </Link>
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
