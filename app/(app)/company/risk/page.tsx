'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
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
import { localizeError } from '../_components/errors'
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

// N7-①: 診断結果のクライアント保存（会社ごと）。結果は自社の目安スコアで、
//   保存先は利用者自身の端末（localStorage）のみ＝サーバ集合知テーブルは汚さない。
//   保存期間が延びると陳腐化するため、保存日時を併記し再診断で上書きできるようにする。
const RISK_CACHE_PREFIX = 'banto:risk-result:v1:'
interface CachedRisk {
  result: RiskResult
  savedAt: string // ISO
}
function readCachedRisk(companyId: string): CachedRisk | null {
  if (!companyId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RISK_CACHE_PREFIX + companyId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRisk
    if (!parsed?.result || typeof parsed.result.score !== 'number') return null
    return parsed
  } catch {
    return null
  }
}
function writeCachedRisk(companyId: string, result: RiskResult): void {
  if (!companyId || typeof window === 'undefined') return
  try {
    const payload: CachedRisk = { result, savedAt: new Date().toISOString() }
    window.localStorage.setItem(RISK_CACHE_PREFIX + companyId, JSON.stringify(payload))
  } catch {
    // localStorage 不可（プライベートモード等）は保存を諦める＝従来挙動へ劣化。
  }
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

// I1(2026-07-24): 診断が「リスク高」と名指しするのに期限の登録候補に無い項目を橋渡しする。
//   既存 suggestDeadlines は has_36kyotei===true のとき「36協定の更新」だけを出す。
//   一方、診断が36協定をリスク高にするのは未締結（has_36kyotei===false）のとき。
//   そのため未締結時は「診断は名指しするのに登録候補ゼロ」だった（監査 I1・P01）。
//   ここで未締結時に「36協定の締結・届出」を候補として補い、既存の年間カレンダーへ
//   合流させて、そのままワンクリックで期限登録できるようにする（新API・新機構は作らない）。
function riskDrivenDeadlines(
  attrs: { has_36kyotei?: boolean | null } | null,
): DeadlineSuggestion[] {
  if (!attrs) return []
  const out: DeadlineSuggestion[] = []
  if (attrs.has_36kyotei === false) {
    out.push({
      title: '36協定の締結・届出',
      timingLabel: '残業をさせる前に',
      hint: '時間外・休日労働をさせるには、36協定を締結し労働基準監督署へ届け出る必要があります。締結・届出の予定日を期限として登録できます。',
      recurrence: 'yearly',
    })
  }
  return out
}

// 無期転換の期限候補（I2・2026-07-24）: 通算5年を超えた有期契約社員は無期転換を申し込めるため、
//   契約更新のたびに通算期間を確認する予定を登録できるようにする。決定的属性（オンボ5問）には
//   「有期契約社員の有無」が無く suggestDeadlines では出せないため、診断が名指ししたときにだけ橋渡しする。
//   timingLabel は具体日を断定せず「契約更新のたび」（Phase1: 日付はユーザーが確定）。
const MUKI_TENKAN_DEADLINE: DeadlineSuggestion = {
  title: '有期契約の通算期間の確認（無期転換）',
  timingLabel: '契約更新のたび',
  hint: '有期労働契約が通算5年を超えると、労働者は無期転換を申し込めます（労働契約法18条）。契約更新のタイミングで通算期間を確認する予定を登録できます。',
  recurrence: 'yearly',
}

// I-P08/P01(2026-07-24): 診断の上位リスクカードから、その場で対応期限を登録するための
//   「リスク→期限」対応表。年間カレンダータブへ遷移させず、リスクを読んだ画面のまま
//   期日を選んで1タップ登録できるようにする（既存の DeadlineSuggestion / registerSuggestion を流用）。
//   現状は 36協定 未締結 と 無期転換（診断が名指しする代表ケース）に対応。
//   マッチしないリスクは null（＝カード内に期限登録UIを出さない）。
function deadlineForRisk(risk: TopRisk): DeadlineSuggestion | null {
  const is36 =
    risk.severity === 'high' &&
    (risk.title.includes('36協定') ||
      risk.title.includes('三六協定') ||
      risk.why.includes('36協定'))
  if (is36) {
    return riskDrivenDeadlines({ has_36kyotei: false })[0] ?? null
  }
  // I2(2026-07-24): 無期転換は「通算5年で自動発生する期日リスク」だが従来は診断本文で触れるのみ
  //   （期限候補に載らず prose 止まり）。診断が high/medium で名指ししたときに期限化する。
  const text = `${risk.title}${risk.why}`
  const isMukiTenkan =
    (risk.severity === 'high' || risk.severity === 'medium') &&
    (text.includes('無期転換') || (text.includes('有期') && text.includes('通算')))
  if (isMukiTenkan) {
    return MUKI_TENKAN_DEADLINE
  }
  return null
}

// 診断待ちの段階メッセージ（P01・2026-07-24）。LLM精査の約30秒を無反応の空白にしないため、
//   経過に応じて「今どこを見ているか」を穏当に進める（実処理の分割ではなく体感の可視化）。
//   断定しない中立文・Phase1準拠。数値は目安であることを崩さない。
const DIAGNOSIS_STEPS = [
  '登録された自社ルールを読み込んでいます',
  '労働時間・休日・36協定の状況を確認しています',
  '有給・社会保険・就業規則の観点を照らしています',
  '最新の法令に照らして結果をまとめています',
] as const

// 段階の進みは実処理と同期しない（LLM精査は不可分な単一呼び出しのため）。約30秒を4段階で
//   均すが、最終段だけは早く進めて「まとめ中で止まって見える」を避け、完了まで居座らせる。
function DiagnosisProgress() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    // 7秒ごとに次段へ。最終段に達したらそこで止める（完了＝result描画で本コンポは消える）。
    const id = setInterval(() => {
      setStep(s => (s < DIAGNOSIS_STEPS.length - 1 ? s + 1 : s))
    }, 7000)
    return () => clearInterval(id)
  }, [])

  return (
    <Card className="border-brand-200 bg-brand-50/50" aria-busy="true" aria-live="polite">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">セルフ診断を実行しています</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
            {DIAGNOSIS_STEPS[step]}
          </p>
          {/* 段階インジケータ（4分割バー）。現在段までを塗り、残りは薄く。数値割合は出さない
              （実処理と同期しないため％を出すと誤認になる）。 */}
          <div className="mt-3 flex gap-1" aria-hidden>
            {DIAGNOSIS_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-brand-500' : 'bg-brand-200/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      {/* 結果カードの骨組みスケルトン（到着イメージを先に見せて「固まった」印象を防ぐ）。 */}
      <div className="mt-4 space-y-2.5">
        <div className="h-8 w-2/3 animate-pulse rounded bg-neutral-200/70" />
        <div className="h-3 w-full animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
      </div>
    </Card>
  )
}

function RiskInner() {
  const params = useSearchParams()
  const router = useRouter()
  const companyId = params.get('companyId') ?? ''
  // オンボ直後の遷移なら、ボタンを押させず即診断を走らせる（TTV短縮の本体）。
  const fromOnboarding = params.get('from') === 'onboarding'
  const autoFired = useRef(false)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RiskResult | null>(null)
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    action?: { label: string; onClick: () => void }
  }>({ show: false, message: '' })
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
  // I1: 登録済みにした候補の title（診断由来の補完候補を登録後にリストから外すため）。
  const [registeredTitles, setRegisteredTitles] = useState<string[]>([])
  // S3: サンプル会社モード中か。true の間は fetch を一切行わず、シェア/AI相談/期限登録を
  //   無効化し、全表示面に「架空のサンプル会社」を明示する。
  const [sampleMode, setSampleMode] = useState(false)
  // オンボ直後の TTV 短縮: 実属性から決定的に算出した「速報（自動計算）」を先に描画し、
  //   裏で LLM 精査版へ差し替える。provisional=速報を表示中（AI精査待ち）。
  const [provisional, setProvisional] = useState(false)
  // 属性フェッチ結果を保持（速報の算出に使う。従来は充足判定だけで値を捨てていた）。
  const [companyAttrs, setCompanyAttrs] =
    useState<Parameters<typeof computeFallbackRiskAudit>[0] | null>(null)
  // N7-①: 直近の診断結果を localStorage に保存し、/company/risk 直接再訪で即表示する
  //   （従来は再訪で結果が消え30秒の再実行が必要だった）。復元中は保存日時を控えめに提示。
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  // onboarding の activation 計測(risk_audit_completed{source:onboarding})を1回に保つ。
  const onboardingFired = useRef(false)
  // sample_company_viewed をセッション1回だけ計測するためのフラグ。
  const sampleViewedRef = useRef(false)
  const showToast = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) =>
      setToast({ show: true, message, action }),
    [],
  )
  // 2026-07-24 成長施策: 日次上限(429・upgradeAvailable=true)を「プランを見る」トースト
  //   アクションに変換する共通ヘルパー（risk-audit専用route1本のみだが、documents/insights
  //   と挙動を揃えるため同名で用意）。
  const showRateLimitToast = useCallback(
    (data: { error?: string; upgradeAvailable?: boolean }) => {
      if (data.upgradeAvailable) {
        showToast(data.error ?? 'セルフ診断に失敗しました', {
          label: 'プランを見る',
          onClick: () => {
            track('risk_upgrade_prompt_click')
            router.push(`/company/billing?companyId=${companyId}`)
          },
        })
      } else {
        showToast(data.error ?? 'セルフ診断に失敗しました')
      }
    },
    [showToast, router, companyId],
  )

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
        showToast(localizeError(data.error, '登録に失敗しました'))
        return
      }
      showToast(`「${s.title}」を期限に登録しました`)
      // 登録済みは候補から外す（suggest=1 の再取得でも除外されるが、即時に反映する）。
      setSuggestions(prev => (prev ? prev.filter(x => x.title !== s.title) : prev))
      // 診断由来の補完候補（suggestions 状態に無い）も登録後に消えるよう title を控える。
      setRegisteredTitles(prev => (prev.includes(s.title) ? prev : [...prev, s.title]))
    } catch {
      showToast('登録に失敗しました。通信を確認してください。')
    } finally {
      setRegistering(null)
    }
  }

  // N7-①: マウント時、オンボ直後でなく結果が未表示なら、保存済みの直近診断を復元する。
  //   オンボ経由(from=onboarding)は新規に自動診断を走らせるため復元しない。
  useEffect(() => {
    if (fromOnboarding || !companyId || result) return
    const cached = readCachedRisk(companyId)
    if (cached) {
      setResult(cached.result)
      setRestoredAt(cached.savedAt)
    }
    // マウント時1回・companyId 確定後。result を依存に入れると復元直後に再評価されるが
    // if(result) return で二重復元は防止済み。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, fromOnboarding])

  // N7-①: 実データの確定診断（速報でもサンプルでもなく、復元表示中でもない）が出たら
  //   端末に保存する。復元中(restoredAt!=null)は保存日時を上書きしない（陳腐化検知のため）。
  useEffect(() => {
    if (result && !sampleMode && !provisional && !restoredAt) {
      writeCachedRisk(companyId, result)
    }
  }, [result, sampleMode, provisional, companyId, restoredAt])

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
    // 新規に診断を走らせるので、復元表示のラベルは解除する（この結果は保存し直される）。
    setRestoredAt(null)

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
        else if (res.status === 429) showRateLimitToast(data)
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
        //   fallback prop（H08）: LLM失敗→決定的フォールバックで返った診断かどうか。
        //   週次で fallback=true の比率＝診断フォールバック率として監視する。
        track('risk_audit_completed', {
          overall_band: band,
          source,
          fallback: Boolean((data as { fallback?: boolean }).fallback),
        })
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
    setRestoredAt(null)
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
      // 計測: 診断結果のシェア用テキストをコピーした（口コミ/拡散の一次シグナル）。PIIは載せない。
      track('risk_shared', { method: 'copy' })
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

  // I1: 診断由来の補完候補（未締結の36協定 等）を既存の年間カレンダー候補へ合流する。
  //   sampleMode ではサンプル属性、それ以外は自社属性を素に、既に suggestions/登録済みに
  //   あるものは重複させない。suggestions が未取得(null)の間は補完候補だけ先に見せる。
  //   ★構造化属性(has_36kyotei)だけでなく、診断結果(result.topRisks)がLLM由来で
  //     36協定未締結をリスク高と名指しした場合も候補を出す（監査 P01/P03: 構造化属性が
  //     未回答=null でも自由記述から36協定リスクを検知した会社で候補が欠落していた）。
  const risk36FromResult =
    !!result &&
    result.topRisks.some(
      r =>
        r.severity === 'high' &&
        (r.title.includes('36協定') || r.title.includes('三六協定') || r.why.includes('36協定')),
    )
  const attrExtra = riskDrivenDeadlines(sampleMode ? SAMPLE_COMPANY_ATTRIBUTES : companyAttrs)
  // 結果が36協定を高リスクにしているのに属性由来の候補に無ければ、確実に補う。
  const combinedExtra =
    risk36FromResult && !attrExtra.some(r => r.title === '36協定の締結・届出')
      ? [...attrExtra, ...riskDrivenDeadlines({ has_36kyotei: false })]
      : attrExtra
  const riskExtra = combinedExtra.filter(
    r => !registeredTitles.includes(r.title) && !(suggestions ?? []).some(s => s.title === r.title),
  )
  const mergedSuggestions: DeadlineSuggestion[] | null =
    suggestions === null ? (riskExtra.length > 0 ? riskExtra : null) : [...riskExtra, ...suggestions]

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
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              セルフ診断中...（30秒ほどかかります）
            </>
          ) : result
              ? sampleMode
                ? '自社の登録内容でセルフ診断する'
                : '最新の状態でもう一度セルフ診断する'
              : '労務リスクをセルフ診断する'}
        </Button>

        {/* ============ 診断待ちの進捗スケルトン（P01・2026-07-24） ============
            初回の手動診断は速報（provisional）が無く、LLM精査の約30秒が無反応の空白になり
            「固まった？」という離脱の芽になっていた。結果がまだ無い診断中だけ、段階メッセージ＋
            スケルトンを出して「今どこまで進んでいるか」を体感させる（実処理は変えない＝体感改善）。
            provisional 経路（オンボ直後）は result が即入るためここは出ない＝二重表示しない。 */}
        {loading && !result && <DiagnosisProgress />}

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

          {/* N7-①: 復元した保存済み結果であることを控えめに提示（陳腐化の可能性を正直に）。 */}
          {restoredAt && !sampleMode && !provisional && (
            <Card className="border-neutral-200 bg-neutral-50">
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    前回の診断結果を表示しています
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                    保存日時：
                    {new Date(restoredAt).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    。自社ルールを更新した場合は、上の「最新の状態でもう一度セルフ診断する」で診断し直せます。
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

            {/* N5: 速報（provisional）で指摘ゼロのとき、フォールバックのsummaryは
                「大きく気になる点は見つかりませんでした」と断定してしまう。約30秒後のAI精査で
                リスク高に一変することがあり、第一印象の"問題なし"は信用毀損になる。
                精査待ちの間だけ中立の文面に差し替える（指摘が既にある場合の件数サマリは残す）。 */}
            {provisional && !sampleMode && result.topRisks.length === 0 ? (
              <p className="mt-5 border-t border-neutral-200 pt-4 text-sm leading-relaxed text-neutral-700">
                現在、AIが登録内容を精査しています。詳細な確認結果が出るまで、もう少しお待ちください（精査後に数値や指摘が変わることがあります）。
              </p>
            ) : (
              result.summary && (
                <p className="mt-5 border-t border-neutral-200 pt-4 text-sm leading-relaxed text-neutral-700">
                  {result.summary}
                </p>
              )
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
              <Link
                href={consultHref(result)}
                onClick={() => track('risk_consult_clicked', { location: 'primary' })}
                className={buttonClass({ variant: 'primary' })}
              >
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
              provisional && !sampleMode ? (
                // N5: 速報段階では「問題なし」と断定しない（AI精査でリスク高に変わりうる）。
                <p className="flex items-center gap-2 text-sm text-neutral-600">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" aria-hidden />
                  AIが詳細を精査中です。確認結果が出るまでお待ちください（指摘が追加されることがあります）。
                </p>
              ) : (
                <p className="text-sm text-neutral-500">
                  大きく気になる点は見つかりませんでした。自社ルールを登録すると精度が上がります。
                </p>
              )
            ) : (
              <div className="space-y-3">
                {result.topRisks.map((r, i) => {
                  const sev = SEVERITY[r.severity]
                  // I-P08/P01: このリスクに対応する期限（あれば）。sampleMode/非admin/登録済みでは出さない。
                  const dl = deadlineForRisk(r)
                  const showDeadline =
                    !sampleMode &&
                    isAdmin &&
                    !!dl &&
                    !registeredTitles.includes(dl.title)
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
                      {/* C06: 指摘ごとのワンクリック相談。チャット側は ?q= を自動送信する
                          （chat/page.tsx の initialQ 自動送信）ため、押した瞬間に相談が始まる。
                          サンプル会社では出さない（架空の前提を実データのチャットに持ち込まない）。 */}
                      <div className="flex flex-wrap items-center gap-2">
                        {!sampleMode && (
                          <Link
                            href={`/company/chat?companyId=${companyId}&q=${encodeURIComponent(
                              `労務リスクのセルフ診断（目安）で「${r.title}」と出ました。自社の場合、まず何から確認すればよいか教えてください。`,
                            )}`}
                            onClick={() =>
                              track('risk_consult_clicked', { location: 'top_risk', rank: i + 1 })
                            }
                            className={buttonClass({ variant: 'secondary', size: 'sm' })}
                          >
                            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                            この1問を相談する
                          </Link>
                        )}
                      </div>

                      {/* I-P08/P01: 診断リスク → 対応期限を、この場で（年間カレンダータブへ
                          遷移させずに）登録する。期日はユーザーが確定してから押す＝日付を断定しない
                          （Phase1）。既存 dueInputs / registerSuggestion をそのまま流用する。 */}
                      {showDeadline && dl && (
                        <div className="mt-1 rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-3">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                            この項目を期限として登録できます（「{dl.title}」）
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="text-xs text-neutral-500">
                              期日を確定：
                              <input
                                type="date"
                                lang="ja"
                                value={dueInputs[dl.title] ?? ''}
                                onChange={e =>
                                  setDueInputs(prev => ({ ...prev, [dl.title]: e.target.value }))
                                }
                                aria-label={`${dl.title}の期日`}
                                className="ml-1 rounded-lg border border-neutral-500 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                              />
                            </label>
                            <Button
                              size="sm"
                              onClick={() => {
                                track('risk_deadline_registered', {
                                  location: 'top_risk',
                                  rank: i + 1,
                                })
                                registerSuggestion(dl)
                              }}
                              disabled={
                                registering === dl.title ||
                                !(dueInputs[dl.title] ?? '').trim()
                              }
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                              {registering === dl.title ? '登録中...' : 'この期限を登録'}
                            </Button>
                          </div>
                          {/* I-P08(2026-07-24): 空日付での無言no-opを塞ぐ。日付未確定の間は
                              登録ボタンを disabled にし、その理由を明示する（Phase1: 日付は
                              システムが断定せずユーザーが確定する設計のためプリフィルはしない）。 */}
                          {!(dueInputs[dl.title] ?? '').trim() && (
                            <p className="mt-1.5 text-xs text-neutral-500">
                              期日を選ぶと、この期限を登録できます。
                            </p>
                          )}
                        </div>
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
            {mergedSuggestions === null ? (
              <p className="text-sm text-neutral-500">カレンダーを読み込み中...</p>
            ) : mergedSuggestions.length === 0 ? (
              <Card className="bg-neutral-50">
                <p className="text-sm leading-relaxed text-neutral-600">
                  いま案内できる候補はすべて期限に登録済みです。登録済みの期限は
                  「すべての期限を管理」から確認できます。
                </p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {mergedSuggestions.map(s => (
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
                            lang="ja"
                            value={dueInputs[s.title] ?? ''}
                            onChange={e =>
                              setDueInputs(prev => ({ ...prev, [s.title]: e.target.value }))
                            }
                            aria-label={`${s.title}の期日`}
                            className="ml-1 rounded-lg border border-neutral-500 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                          />
                        </label>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => registerSuggestion(s)}
                          disabled={
                            registering === s.title || !(dueInputs[s.title] ?? '').trim()
                          }
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {registering === s.title ? '登録中...' : 'この期限を登録'}
                        </Button>
                        {/* I-P08: 空日付での無言no-opを塞ぐ（日付未確定の間は登録不可＋理由を明示）。 */}
                        {!(dueInputs[s.title] ?? '').trim() && (
                          <span className="basis-full text-xs text-neutral-500">
                            期日を選ぶと登録できます。
                          </span>
                        )}
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
        action={toast.action}
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
