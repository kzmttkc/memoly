'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, Calculator as CalcIcon } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta } from '@/components/tools/client'
import { calcZangyodai, validateZangyodai, type ZangyodaiInput, type ZangyodaiResult } from './calc'

// ============================================================================
// 残業代セルフ点検ツール（クライアント計算・会社データ非保存）
//   入力（月給・所定労働時間・残業/休日/深夜の時間数・支払額）はすべてブラウザ内で
//   計算する。サーバには一切送信しない（fetch/API 呼び出しなし）。
//   計算仕様と一次情報の出典は ./calc.ts の冒頭コメントに集約（確認日 2026-07-09）。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=zangyodai_tool）
//
//   A5 結果保存CTA: 「この結果を自社の記録として保存(無料)」→ /signup に note を
//   持たせて遷移し、signup が nextDest(/company?note=…) へ持ち回る（hire-bridge
//   a84a8fc の流儀）。/company が会社作成時に「会社の記憶」へ保存する＝約束を実挙動に。
//
//   Phase1 厳守: 断定的な個別法的助言をしない。「未払い」「違反」と断定せず、
//   結果は「最低ラインの目安」「確認の出発点」であることを明示する。
// ============================================================================

const yen = (v: number) => v.toLocaleString('ja-JP')

// 数値パース: 空欄は null（任意項目は「点検しない」・必須項目は検証で弾く）。
function parseNum(v: string): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : (NaN as unknown as number)
}

export function Calculator() {
  const [wage, setWage] = useState('') // 月給のうち算入対象額（円）
  const [avgHours, setAvgHours] = useState('') // 1か月平均所定労働時間
  const [hOt, setHOt] = useState('') // 法定時間外（法定休日を除く）
  const [hOtNight, setHOtNight] = useState('') // うち深夜
  const [hHol, setHHol] = useState('') // 法定休日労働
  const [hHolNight, setHHolNight] = useState('') // うち深夜
  const [hLegalIn, setHLegalIn] = useState('') // 法定内残業（任意）
  const [paid, setPaid] = useState('') // 実際に支払った額（任意）
  const [error, setError] = useState('')
  const [result, setResult] = useState<ZangyodaiResult | null>(null)
  const [input, setInput] = useState<ZangyodaiInput | null>(null)
  // I5: 送信後、結果ブロックへ自動スクロール（結果はフォールド下・P02/P08）。
  const resultRef = useRef<HTMLDivElement>(null)

  useToolOpen('zangyodai')

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setInput(null)

    const inp: ZangyodaiInput = {
      monthlyWage: parseNum(wage) ?? 0,
      avgMonthlyHours: parseNum(avgHours) ?? 0,
      hOvertime: parseNum(hOt) ?? 0,
      hOvertimeNight: parseNum(hOtNight) ?? 0,
      hHoliday: parseNum(hHol) ?? 0,
      hHolidayNight: parseNum(hHolNight) ?? 0,
      hLegalInside: parseNum(hLegalIn),
      paid: parseNum(paid),
    }

    const invalid = validateZangyodai(inp)
    if (invalid) {
      setError(invalid)
      return
    }
    if (inp.hOvertime === 0 && inp.hHoliday === 0 && (inp.hLegalInside ?? 0) === 0) {
      setError('残業や休日労働の時間数を、いずれかの欄に入力してください。')
      return
    }

    const res = calcZangyodai(inp)
    setResult(res)
    setInput(inp)

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    track('tool_completed', { tool: 'zangyodai', status: res.status })
  }

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card>
        <form onSubmit={handleCheck} className="space-y-5">
          {/* ===== ブロック1: 1時間あたりの賃金（基礎単価） ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                まず1時間あたりの賃金を出す（月給制）
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                割増賃金の単価は「月給 ÷ 1年間における1か月平均所定労働時間」で計算します。
              </p>
            </div>

            <div>
              <label htmlFor="wage" className="mb-1.5 block text-sm font-medium text-neutral-800">
                月給のうち算入対象の額（円）
              </label>
              <input
                id="wage"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                placeholder="例：243000"
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                基本給に諸手当を足し、家族手当・通勤手当・別居手当・子女教育手当・住宅手当・臨時の賃金・1か月を超えるごとに支払われる賃金（賞与など）を除いた額です。名称でなく実質で判断し、一律支給の手当は含めます。
              </p>
            </div>

            <div>
              <label htmlFor="avgHours" className="mb-1.5 block text-sm font-medium text-neutral-800">
                1か月平均所定労働時間（時間）
              </label>
              <input
                id="avgHours"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={avgHours}
                onChange={(e) => setAvgHours(e.target.value)}
                placeholder="例：162"
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                （365日 − 年間所定休日）× 1日の所定労働時間 ÷ 12 で計算します。年間所定休日122日・1日8時間なら162時間です。
              </p>
            </div>
          </div>

          {/* ===== ブロック2: その月の残業・休日労働 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                次に、その月の残業・休日労働の時間を入れる
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                点検したい月の実績を入れてください。「うち深夜」と任意の欄は、該当がなければ空欄のままで構いません。
              </p>
            </div>

            <div>
              <label htmlFor="hOt" className="mb-1.5 block text-sm font-medium text-neutral-800">
                法定時間外労働の時間数（法定休日労働を除く・時間）
              </label>
              <input
                id="hOt"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={hOt}
                onChange={(e) => setHOt(e.target.value)}
                placeholder="例：45"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                1日8時間・週40時間を超えた分の合計です。法定外休日（週休2日制のもう1日など）の労働で週40時間を超えた分もここに含めます。月60時間を超える部分は、自動で50%の率に切り替えて計算します。
              </p>
            </div>

            <div>
              <label htmlFor="hOtNight" className="mb-1.5 block text-sm font-medium text-neutral-800">
                うち深夜（22時〜5時）に重なった時間（時間・任意）
              </label>
              <input
                id="hOtNight"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={hOtNight}
                onChange={(e) => setHOtNight(e.target.value)}
                placeholder="例：0"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="hHol" className="mb-1.5 block text-sm font-medium text-neutral-800">
                法定休日労働の時間数（時間・任意）
              </label>
              <input
                id="hHol"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={hHol}
                onChange={(e) => setHHol(e.target.value)}
                placeholder="例：0"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                週1日（または4週4日）の法定休日に働いた時間です。あらかじめ振替休日にした場合は休日労働にはなりません。
              </p>
            </div>

            <div>
              <label htmlFor="hHolNight" className="mb-1.5 block text-sm font-medium text-neutral-800">
                うち深夜（22時〜5時）に重なった時間（時間・任意）
              </label>
              <input
                id="hHolNight"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={hHolNight}
                onChange={(e) => setHHolNight(e.target.value)}
                placeholder="例：0"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="hLegalIn" className="mb-1.5 block text-sm font-medium text-neutral-800">
                法定内残業の時間数（時間・任意）
              </label>
              <input
                id="hLegalIn"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={hLegalIn}
                onChange={(e) => setHLegalIn(e.target.value)}
                placeholder="例：0"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                所定労働時間（例：1日7時間）は超えるが、1日8時間・週40時間には収まる残業です。法律上の割増は不要ですが、1.00倍分の支払いは必要です。所定が1日8時間なら空欄のままで構いません。
              </p>
            </div>
          </div>

          {/* ===== ブロック3: 実際の支払額との突き合わせ（任意） ===== */}
          <div>
            <label htmlFor="paid" className="mb-1.5 block text-sm font-medium text-neutral-800">
              その月に残業代等として支払った合計額（円・任意）
            </label>
            <input
              id="paid"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="例：120000"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              時間外手当・休日手当・深夜手当（法定内残業分の支払いも含む）の合計です。入力すると、目安との差額を表示します。空欄なら目安の金額だけを表示します。
            </p>
          </div>

          <button type="submit" className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            点検する
          </button>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <LocalOnlyNote />
      </Card>

      {/* ===== 結果 ===== */}
      {result && input && (
        <Card ref={resultRef} className="scroll-mt-4">
          {result.status === 'shortfall_risk' ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  支払額が目安を{yen(Math.abs(result.diff ?? 0))}円 下回っている可能性があります
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した時間数から計算した最低ラインの目安は{yen(result.total)}円で、支払額{yen(input.paid ?? 0)}円との差は{yen(Math.abs(result.diff ?? 0))}円でした。時間数の集計方法や、月給のうち算入する手当の範囲によって結果は変わります。まずは賃金規程と勤怠記録で、集計と単価の前提をご確認ください。
                </p>
              </div>
            </div>
          ) : result.status === 'covered' ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  支払額は目安を下回っていなさそうです
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した時間数から計算した最低ラインの目安は{yen(result.total)}円で、支払額{yen(input.paid ?? 0)}円はこれを{yen(result.diff ?? 0)}円 上回っていました。ただし、これは入力した数字だけを見た整理です。時間数の集計や算入する手当の範囲が変わると結果も変わります。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <CalcIcon className="mt-0.5 h-5 w-5 flex-none text-brand-600" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  この月の支払いの最低ラインの目安は{yen(result.total)}円です
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  法律で決められた割増率で計算した、下回れない側の目安です。就業規則でこれより高い割増率を定めている場合は、その率が優先されます。実際の支払額と突き合わせる場合は、支払額の欄に入れて再度点検してください。
                </p>
              </div>
            </div>
          )}

          {/* 内訳（0円の行は出さない・単価は常に出す） */}
          <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
            <BreakdownRow label="1時間あたりの基礎単価" value={`${yen(result.hourlyRate)}円`} />
            {result.payOvertimeUpTo60 > 0 && (
              <BreakdownRow
                label={`時間外労働 ${result.hUpTo60}時間 × 1.25`}
                value={`${yen(result.payOvertimeUpTo60)}円`}
              />
            )}
            {result.payOvertimeOver60 > 0 && (
              <BreakdownRow
                label={`時間外労働の月60時間を超える部分 ${result.hOver60}時間 × 1.50`}
                value={`${yen(result.payOvertimeOver60)}円`}
              />
            )}
            {result.payOvertimeNight > 0 && (
              <BreakdownRow
                label={`時間外×深夜の加算 ${input.hOvertimeNight}時間 × 0.25`}
                value={`${yen(result.payOvertimeNight)}円`}
              />
            )}
            {result.payHoliday > 0 && (
              <BreakdownRow
                label={`法定休日労働 ${input.hHoliday}時間 × 1.35`}
                value={`${yen(result.payHoliday)}円`}
              />
            )}
            {result.payHolidayNight > 0 && (
              <BreakdownRow
                label={`休日×深夜の加算 ${input.hHolidayNight}時間 × 0.25`}
                value={`${yen(result.payHolidayNight)}円`}
              />
            )}
            {result.payLegalInside > 0 && (
              <BreakdownRow
                label={`法定内残業 ${input.hLegalInside}時間 × 1.00（割増なし）`}
                value={`${yen(result.payLegalInside)}円`}
              />
            )}
            <BreakdownRow label="合計（最低ラインの目安）" value={`${yen(result.total)}円`} strong />
          </dl>

          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            円未満の端数は、通達で認められる「50銭未満切捨て・50銭以上切上げ」で処理しています。月60時間の算定には法定休日労働を含めていません（法定外休日の時間外は含めます）。
          </p>

          <ResultDisclaimer detail="実際の支払額は、就業規則で法定を上回る割増率を定めている場合や、変形労働時間制・固定残業代の運用によって変わります。正確な計算は自社の賃金規程・勤怠記録でご確認いただき、必要に応じて専門家にご相談ください。" />

          {/* ===== A5 結果保存CTA（結果末尾に1本・痛点別に出し分け） ===== */}
          <SaveResultCta result={result} input={input} />
          <p className="mt-2 text-xs text-neutral-400">
            登録・会社作成・この保存は、すべて無料です。
          </p>
        </Card>
      )}
    </div>
  )
}

function BreakdownRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold text-neutral-900' : 'text-neutral-600'}>{label}</dt>
      <dd className={strong ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-900'}>{value}</dd>
    </div>
  )
}

// A5: 結果保存CTA。
//   「この結果を自社の記録として保存(無料)」→ /signup?note=… → signup が
//   nextDest(/company?note=…) へ持ち回り → /company が会社作成時に「会社の記憶」へ
//   保存する。保存無料 = 実挙動（無料登録・会社作成・記憶保存はすべて無料）と一致。
//   note には入力済みの数字の要約だけを載せる（ユーザー自身が保存を選んだ会社データ）。
function SaveResultCta({ result, input }: { result: ZangyodaiResult; input: ZangyodaiInput }) {
  const highPain = result.status === 'shortfall_risk'

  // 保存する記録の要約（/companyで「会社の記憶」になる本文）。400字上限はsignup側と同じ。
  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const parts = [
    `残業代セルフ点検（${dateJp}・banto-roumu.com/tools/zangyodai-check）：`,
    `基礎単価${yen(result.hourlyRate)}円/時（月給${yen(input.monthlyWage)}円÷月平均所定${input.avgMonthlyHours}時間）、`,
    `法定時間外${input.hOvertime}時間（うち深夜${input.hOvertimeNight}時間）、法定休日${input.hHoliday}時間（うち深夜${input.hHolidayNight}時間）`,
    input.hLegalInside !== null ? `、法定内残業${input.hLegalInside}時間` : '',
    `。法定の最低ライン目安 合計${yen(result.total)}円`,
    input.paid !== null ? `、実支払${yen(input.paid)}円（差 ${result.diff !== null && result.diff >= 0 ? '+' : ''}${yen(result.diff ?? 0)}円）` : '',
    '。',
  ]
  const note = parts.join('').slice(0, 400)
  const href = `/signup?next=/company&utm_source=banto_tool&utm_campaign=zangyodai&note=${encodeURIComponent(note)}`

  return (
    <ToolSignupCta
      href={href}
      location="zangyodai_tool"
      status={result.status}
      title={highPain ? 'この差額の確認を、記録を残すところから始める' : 'この点検結果を、会社の記録として残す'}
      body={
        highPain
          ? '目安を下回っている可能性が見つかったら、来月も同じ点検が要ります。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存され、自社の手当や所定労働時間を覚えた番頭と、次からの確認を一緒に整理できます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は自社の手当や所定労働時間を覚えるので、次からは前提を入れ直さずに点検の続きを相談できます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}
