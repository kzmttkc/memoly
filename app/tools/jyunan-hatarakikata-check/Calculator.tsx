'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta, ToolSubmitButton, preHydrationValue } from '@/components/tools/client'
import {
  calcMeasureCheck,
  validateMeasureInput,
  calcChildCheck,
  validateChildInput,
  type MeasureInput,
  type MeasureCheckResult,
  type ChildInput,
  type ChildCheckResult,
} from './calc'

// ============================================================================
// 柔軟な働き方を実現するための措置 セルフ点検ツール（クライアント計算・会社データ非保存）
//   (A) 自社が講じている5つの措置の入力から、2つ以上の義務を満たしているかを判定する。
//   (B) 子の生年月日から、今その子について何が必要か（対象年齢か、個別周知・意向確認
//   を行うべき時期か）を判定する。いずれもブラウザ内で計算し、サーバには送信しない。
//   計算仕様と一次情報の出典は ./calc.ts の冒頭コメントに集約（確認日 2026-07-09）。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=jyunan_hatarakikata_tool）
//
//   Phase1 厳守: 断定的な個別法的助言をしない。「義務違反」と断定せず、結果は
//   「確認の出発点」であることを明示する。
// ============================================================================

const SIGNUP_HREF = '/signup?next=/company&utm_source=banto_tool&utm_campaign=jyunan_hatarakikata'

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function parseNum(v: string): number {
  const n = Number(v.trim())
  return v.trim() === '' ? NaN : n
}

function formatJp(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function Calculator() {
  // ---- ブロックA: 自社が講じている措置 ----
  const [startTime, setStartTime] = useState<'yes' | 'no' | ''>('')
  const [telework, setTelework] = useState<'yes' | 'no' | ''>('')
  const [teleworkDays, setTeleworkDays] = useState(() => preHydrationValue('teleworkDays'))
  const [childcareFacility, setChildcareFacility] = useState<'yes' | 'no' | ''>('')
  const [leave, setLeave] = useState<'yes' | 'no' | ''>('')
  const [leaveDays, setLeaveDays] = useState(() => preHydrationValue('leaveDays'))
  const [shortHours, setShortHours] = useState<'yes' | 'no' | ''>('')
  const [shortHoursIncludes6h, setShortHoursIncludes6h] = useState<'yes' | 'no' | ''>('')
  const [heardUnionOpinion, setHeardUnionOpinion] = useState<'yes' | 'no' | ''>('')

  // ---- ブロックB: 子の生年月日 ----
  const [birthDate, setBirthDate] = useState(() => preHydrationValue('birthDate'))
  const [assessDate, setAssessDate] = useState(() => preHydrationValue('assessDate')) // 空欄なら今日

  const [error, setError] = useState('')
  const [measureResult, setMeasureResult] = useState<MeasureCheckResult | null>(null)
  const [childResult, setChildResult] = useState<ChildCheckResult | null>(null)
  // I5: 送信後、結果ブロックへ自動スクロール（結果はフォールド下・P02/P08）。
  const resultRef = useRef<HTMLDivElement>(null)

  useToolOpen('jyunan_hatarakikata')

  useEffect(() => {
    if (measureResult && childResult) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [measureResult, childResult])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMeasureResult(null)
    setChildResult(null)

    if (
      startTime === '' ||
      telework === '' ||
      childcareFacility === '' ||
      leave === '' ||
      shortHours === '' ||
      heardUnionOpinion === ''
    ) {
      setError('自社が講じている措置について、5つすべてに「はい/いいえ」で答えてください。')
      return
    }
    if (telework === 'yes' && teleworkDays.trim() === '') {
      setError('テレワーク等を月に何日利用できるか入力してください。')
      return
    }
    if (leave === 'yes' && leaveDays.trim() === '') {
      setError('養育両立支援休暇を年に何日付与しているか入力してください。')
      return
    }
    if (shortHours === 'yes' && shortHoursIncludes6h === '') {
      setError('短時間勤務制度が1日6時間の措置を含むか選択してください。')
      return
    }
    if (birthDate === '') {
      setError('子の生年月日を選択してください。')
      return
    }

    const mInput: MeasureInput = {
      startTime: startTime === 'yes',
      telework: telework === 'yes',
      teleworkDaysPerMonth: telework === 'yes' ? parseNum(teleworkDays) : 0,
      childcareFacility: childcareFacility === 'yes',
      leave: leave === 'yes',
      leaveDaysPerYear: leave === 'yes' ? parseNum(leaveDays) : 0,
      shortHours: shortHours === 'yes',
      shortHoursIncludes6h: shortHours === 'yes' && shortHoursIncludes6h === 'yes',
      heardUnionOpinion: heardUnionOpinion === 'yes',
    }
    const mInvalid = validateMeasureInput(mInput)
    if (mInvalid) {
      setError(mInvalid)
      return
    }

    const cInput: ChildInput = {
      birthDate,
      assessDate: assessDate === '' ? todayStr() : assessDate,
    }
    const cInvalid = validateChildInput(cInput)
    if (cInvalid) {
      setError(cInvalid)
      return
    }

    const mRes = calcMeasureCheck(mInput)
    const cRes = calcChildCheck(cInput)
    setMeasureResult(mRes)
    setChildResult(cRes)

    const actionNeeded =
      !mRes.meetsObligation ||
      (cRes.ageBand === 'under3' &&
        (cRes.notificationWindow.status === 'within' || cRes.notificationWindow.status === 'missed'))

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    track('tool_completed', { tool: 'jyunan_hatarakikata', status: actionNeeded ? 'action_needed' : 'on_track' })
  }

  const actionNeeded =
    measureResult && childResult
      ? !measureResult.meetsObligation ||
        (childResult.ageBand === 'under3' &&
          (childResult.notificationWindow.status === 'within' || childResult.notificationWindow.status === 'missed'))
      : false

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card>
        <form onSubmit={handleCheck} className="space-y-5">
          {/* ===== ブロック1: 自社が講じている措置 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                自社が講じている措置（5つのうち、当てはまるものを選ぶ）
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                2025年10月1日から、3歳〜小学校就学前の子を養育する労働者向けに、次の5つのうち2つ以上を選んで講じることが全企業に義務づけられています。
              </p>
            </div>

            <YesNoField
              label="①始業時刻等の変更（フレックスタイム制または時差出勤の制度）"
              name="startTime"
              value={startTime}
              onChange={setStartTime}
            />

            <div>
              <YesNoField label="②テレワーク等" name="telework" value={telework} onChange={setTelework} />
              {telework === 'yes' && (
                <div className="mt-2 pl-1">
                  <label htmlFor="teleworkDays" className="mb-1 block text-xs font-medium text-neutral-700">
                    月に何日以上、利用できますか（義務の基準は月10日以上）
                  </label>
                  <input
                    id="teleworkDays"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={teleworkDays}
                    onChange={(e) => setTeleworkDays(e.target.value)}
                    placeholder="例：10"
                    className={cn(inputClass, 'max-w-[10rem]')}
                  />
                </div>
              )}
            </div>

            <YesNoField
              label="③保育施設の設置運営等（ベビーシッターの手配・費用負担なども含む）"
              name="childcareFacility"
              value={childcareFacility}
              onChange={setChildcareFacility}
            />

            <div>
              <YesNoField
                label="④養育両立支援休暇の付与（就業しつつ子を養育するための休暇）"
                name="leave"
                value={leave}
                onChange={setLeave}
              />
              {leave === 'yes' && (
                <div className="mt-2 pl-1">
                  <label htmlFor="leaveDays" className="mb-1 block text-xs font-medium text-neutral-700">
                    年に何日以上、取得できますか（義務の基準は年10日以上）
                  </label>
                  <input
                    id="leaveDays"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(e.target.value)}
                    placeholder="例：10"
                    className={cn(inputClass, 'max-w-[10rem]')}
                  />
                </div>
              )}
            </div>

            <div>
              <YesNoField
                label="⑤短時間勤務制度"
                name="shortHours"
                value={shortHours}
                onChange={setShortHours}
              />
              {shortHours === 'yes' && (
                <div className="mt-2 pl-1">
                  <YesNoField
                    label="うち、1日の所定労働時間を原則6時間とする措置を含みますか"
                    name="shortHoursIncludes6h"
                    value={shortHoursIncludes6h}
                    onChange={setShortHoursIncludes6h}
                  />
                </div>
              )}
            </div>

            <YesNoField
              label="措置を選ぶ際に、過半数組合等（労働者の過半数代表）から意見を聴きましたか"
              name="heardUnionOpinion"
              value={heardUnionOpinion}
              onChange={setHeardUnionOpinion}
              hint="事業主が講ずる措置を選択・変更する際は、過半数組合等からの意見聴取の機会を設ける義務があります。"
            />
          </div>

          {/* ===== ブロック2: 子の生年月日 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">対象の従業員の、子の生年月日</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                子の年齢によって、対象年齢かどうか、個別周知・意向確認を行うべき時期かどうかが変わります。
              </p>
            </div>
            <div>
              <label htmlFor="birthDate" className="mb-1.5 block text-sm font-medium text-neutral-800">
                子の生年月日
              </label>
              <input
                id="birthDate"
                type="date"
                lang="ja"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="assessDate" className="mb-1.5 block text-sm font-medium text-neutral-800">
                点検したい時点（空欄可）
              </label>
              <input
                id="assessDate"
                type="date"
                lang="ja"
                value={assessDate}
                onChange={(e) => setAssessDate(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">空欄なら今日の時点で判定します。</p>
            </div>
          </div>

          <ToolSubmitButton>点検する</ToolSubmitButton>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <LocalOnlyNote />
      </Card>

      {/* ===== 結果 ===== */}
      {measureResult && childResult && (
        <>
          {/* ---- 結果1: 自社の措置は義務(2つ以上)を満たしているか ---- */}
          <Card ref={resultRef} className="scroll-mt-4">
            <div className="flex items-start gap-2">
              {measureResult.meetsObligation ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
              )}
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  {measureResult.meetsObligation
                    ? `要件を満たす措置を${measureResult.qualifyingCount}つ講じており、2つ以上の義務を満たしていそうです`
                    : `要件を満たす措置が${measureResult.qualifyingCount}つで、2つ以上の義務に届いていない可能性があります`}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  自社が2025年10月1日からの「柔軟な働き方を実現するための措置」の義務を満たしているかを、5つの選択肢への該当状況から整理したものです。断定の判定ではなく、確認の出発点です。
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
              {measureResult.criteria.map((c) => (
                <li key={c.key} className="flex items-start gap-2">
                  {c.qualifies ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success-700" aria-hidden />
                  ) : c.offered ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning-700" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 flex-none text-neutral-300" aria-hidden />
                  )}
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{c.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            {!measureResult.heardUnionOpinion && (
              <p className="mt-4 rounded-xl border border-warning-200 bg-warning-50/60 px-3.5 py-3 text-xs leading-relaxed text-neutral-700">
                措置を選ぶ際の過半数組合等からの意見聴取も義務の一部です。まだ行っていない場合は、あわせて対応が必要です。
              </p>
            )}

            <ResultDisclaimer detail="措置の内容が指針・省令の細かな要件（時間単位取得の可否など）を満たしているかまでは、このツールでは踏み込んで判定していません。正確な充足状況は自社の就業規則と、必要に応じて専門家にご確認ください。" />
          </Card>

          {/* ---- 結果2: この子について、今必要な対応 ---- */}
          <Card>
            <p className="text-base font-semibold text-neutral-900">この子について、今必要な対応</p>

            {childResult.ageBand === 'schoolAgeOrOlder' && (
              <div className="mt-3 flex items-start gap-2">
                <Circle className="mt-0.5 h-4 w-4 flex-none text-neutral-300" aria-hidden />
                <p className="text-sm leading-relaxed text-neutral-600">
                  入力した時点では、この子はすでに小学校就学の始期（{formatJp(childResult.schoolEntryThresholdDate)}の翌日）に達しており、「柔軟な働き方を実現するための措置」の対象年齢外です。
                </p>
              </div>
            )}

            {childResult.ageBand === 'threeToSchoolAge' && (
              <div className="mt-3 flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success-700" aria-hidden />
                <p className="text-sm leading-relaxed text-neutral-600">
                  入力した時点で、この子は3歳〜小学校就学前の対象年齢です（
                  {formatJp(childResult.schoolEntryThresholdDate)}まで対象）。上の結果で自社の措置が2つ以上の要件を満たしていれば、対象の従業員はその中から1つを選んで利用できます。
                </p>
              </div>
            )}

            {childResult.ageBand === 'under3' && (
              <div className="mt-3 space-y-2">
                {childResult.notificationWindow.status === 'before' && (
                  <div className="flex items-start gap-2">
                    <Circle className="mt-0.5 h-4 w-4 flex-none text-neutral-300" aria-hidden />
                    <p className="text-sm leading-relaxed text-neutral-600">
                      個別周知・意向確認を行うべき時期はまだ先です。「3歳になるまでの適切な時期」（
                      {formatJp(childResult.notificationWindow.start)}〜{formatJp(childResult.notificationWindow.end)}）になったら、対象措置の内容・申出先などを個別に周知し、利用意向を確認する必要があります。
                    </p>
                  </div>
                )}
                {childResult.notificationWindow.status === 'within' && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning-700" aria-hidden />
                    <p className="text-sm leading-relaxed text-neutral-600">
                      今が「3歳になるまでの適切な時期」（{formatJp(childResult.notificationWindow.start)}〜
                      {formatJp(childResult.notificationWindow.end)}）にあたります。まだ行っていなければ、対象措置（2つ以上）の内容・申出先・残業免除等の関連制度を、この従業員に個別に周知し、利用意向を確認してください。
                    </p>
                  </div>
                )}
                {childResult.notificationWindow.status === 'missed' && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning-700" aria-hidden />
                    <p className="text-sm leading-relaxed text-neutral-600">
                      「3歳になるまでの適切な時期」（{formatJp(childResult.notificationWindow.start)}〜
                      {formatJp(childResult.notificationWindow.end)}）をすでに過ぎています。まだ個別周知・意向確認を行っていなければ、早めの対応をおすすめします。
                    </p>
                  </div>
                )}
              </div>
            )}

            <ResultDisclaimer detail="日付の計算は生年月日の入力にもとづく機械的な整理で、労使協定による適用除外（継続雇用1年未満・週所定労働日数2日以下等）は反映していません。個別の対象可否は自社の労務担当・専門家にご確認ください。" />

            {/* ===== 番頭 登録CTA（結果末尾に1本・高痛点/低痛点で出し分け） ===== */}
            <SignupCta actionNeeded={actionNeeded} measure={measureResult} child={childResult} />
          </Card>
        </>
      )}
    </div>
  )
}

// 「はい/いいえ」選択（ラジオボタン2択）。共通シャーシに無いため本ツールで導入する。
function YesNoField({
  label,
  name,
  value,
  onChange,
  hint,
}: {
  label: string
  name: string
  value: 'yes' | 'no' | ''
  onChange: (v: 'yes' | 'no') => void
  hint?: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-800">{label}</p>
      <div className="flex gap-2">
        {(['yes', 'no'] as const).map((opt) => (
          <label
            key={opt}
            className={cn(
              'flex-1 cursor-pointer rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-colors',
              value === opt
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            {opt === 'yes' ? 'はい' : 'いいえ'}
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}

// 結果末尾の番頭登録CTA（C08: zangyodai方式の横展開）。
//   計算結果の要約を note= で signup へ引き渡し → /company が会社作成時に「会社の記憶」へ
//   保存する（signup側の受け皿は既存・変更不要）。note には点検結果の要約だけを載せる
//   （氏名は扱わない・ユーザー自身が保存を選んだ会社データ・400字上限はsignup側と同じ）。
//   文言は「この結果を会社に覚えさせて、同じ点検を続けられる」トーンに統一。
//   Phase1/景表法厳守: 「義務違反」等は書かず、実挙動どおり「〜可能性」の整理に留める。
function SignupCta({
  actionNeeded,
  measure,
  child,
}: {
  actionNeeded: boolean
  measure: MeasureCheckResult
  child: ChildCheckResult
}) {
  // 保存する記録の要約（/companyで「会社の記憶」になる本文）。
  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const childPart =
    child.ageBand === 'schoolAgeOrOlder'
      ? '子は対象年齢外（小学校就学の始期に到達）'
      : child.ageBand === 'threeToSchoolAge'
        ? `子は対象年齢（${formatJp(child.schoolEntryThresholdDate)}まで対象）`
        : child.notificationWindow.status === 'before'
          ? `個別周知・意向確認は${formatJp(child.notificationWindow.start)}〜${formatJp(child.notificationWindow.end)}に実施`
          : child.notificationWindow.status === 'within'
            ? `いま個別周知・意向確認の時期（${formatJp(child.notificationWindow.start)}〜${formatJp(child.notificationWindow.end)}）`
            : `個別周知・意向確認の時期（〜${formatJp(child.notificationWindow.end)}）を経過`
  const parts = [
    `柔軟な働き方措置セルフ点検（${dateJp}・banto-roumu.com/tools/jyunan-hatarakikata-check）：`,
    `要件を満たす措置${measure.qualifyingCount}つ（義務は2つ以上${measure.meetsObligation ? '・満たしていそう' : '・届いていない可能性'}）、`,
    `過半数組合等への意見聴取${measure.heardUnionOpinion ? '実施済み' : '未実施'}`,
    `。${childPart}。`,
  ]
  const note = parts.join('').slice(0, 400)
  const href = `${SIGNUP_HREF}&note=${encodeURIComponent(note)}`

  return (
    <ToolSignupCta
      href={href}
      location="jyunan_hatarakikata_tool"
      status={actionNeeded ? 'action_needed' : 'on_track'}
      title={
        actionNeeded
          ? '必要な対応の確認を、記録を残すところから始める'
          : 'この点検結果を、会社の記録として残す'
      }
      body={
        actionNeeded
          ? '措置の追加や個別周知・意向確認は、対象になる従業員ごとに時期が異なります。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。自社が講じている措置や対象になりそうな従業員も覚えさせれば、時期が来るたびに条件を入れ直さずに、同じ点検を続けられます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は自社の措置や対象の従業員を覚えるので、子の年齢が上がって対応の時期が来ても、前提を説明し直さずに同じ点検を続けられます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}
