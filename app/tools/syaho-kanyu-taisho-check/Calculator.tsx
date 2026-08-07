'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta, ToolSubmitButton, preHydrationValue } from '@/components/tools/client'
import {
  calcSyahoKanyu,
  validateSyahoKanyu,
  type SyahoKanyuInput,
  type SyahoKanyuResult,
} from './calc'

// ============================================================================
// パート従業員 社会保険加入対象セルフ点検ツール（クライアント計算・会社データ非保存）
//   入力（点検したい時点・自社の被保険者数・週の所定労働時間・所定内賃金・雇用見込み・
//   学生かどうか）はすべてブラウザ内で計算する。サーバには一切送信しない。
//   計算仕様と一次情報の出典は ./calc.ts の冒頭コメントに集約（確認日 2026-07-09）。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=syaho_kanyu_tool）
//
//   Phase1 厳守: 断定的な個別法的助言をしない。「加入対象」「加入対象外」は5要件への
//   あてはめの整理であって、最終的な加入可否の断定ではないことを明示する。
// ============================================================================

const SIGNUP_HREF = '/signup?next=/company&utm_source=banto_tool&utm_campaign=syaho_kanyu'

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

export function Calculator() {
  const [assessDate, setAssessDate] = useState(() => preHydrationValue('assessDate')) // 点検したい時点（空欄なら今日として扱う）
  const [companySize, setCompanySize] = useState(() => preHydrationValue('companySize')) // 自社の厚生年金保険の被保険者数
  const [weeklyHours, setWeeklyHours] = useState(() => preHydrationValue('weeklyHours')) // 週の所定労働時間
  const [monthlyWage, setMonthlyWage] = useState(() => preHydrationValue('monthlyWage')) // 所定内賃金（月額）
  const [expectedOver2Months, setExpectedOver2Months] = useState<'yes' | 'no' | ''>('')
  const [isStudent, setIsStudent] = useState<'yes' | 'no' | ''>('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<SyahoKanyuResult | null>(null)
  // I5: 送信後、結果ブロックへ自動スクロール（結果はフォールド下・P02/P08）。
  const resultRef = useRef<HTMLDivElement>(null)
  // C08: note= 引き渡し用に、判定に使った入力の控えを結果とセットで保持する。
  const [lastInput, setLastInput] = useState<SyahoKanyuInput | null>(null)

  useToolOpen('syaho_kanyu')

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    if (expectedOver2Months === '' || isStudent === '') {
      setError('雇用の見込みと、学生かどうかを選択してください。')
      return
    }

    const inp: SyahoKanyuInput = {
      assessDate: assessDate === '' ? todayStr() : assessDate,
      companySize: parseNum(companySize),
      weeklyHours: parseNum(weeklyHours),
      monthlyWage: parseNum(monthlyWage),
      expectedOver2Months: expectedOver2Months === 'yes',
      isStudent: isStudent === 'yes',
    }

    const invalid = validateSyahoKanyu(inp)
    if (invalid) {
      setError(invalid)
      return
    }

    const res = calcSyahoKanyu(inp)
    setResult(res)
    setLastInput(inp)

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    track('tool_completed', { tool: 'syaho_kanyu', status: res.status })
  }

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card>
        <form onSubmit={handleCheck} className="space-y-5">
          {/* ===== ブロック1: いつの時点で点検するか ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                まず、点検したい時点を選ぶ
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                空欄なら今日の時点で判定します。2026年10月以降を指定すると、撤廃予定の賃金要件を外して判定します（あくまで予定にもとづく試算です）。
              </p>
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
            </div>
          </div>

          {/* ===== ブロック2: 自社の情報 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                自社の情報
              </p>
            </div>
            <div>
              <label htmlFor="companySize" className="mb-1.5 block text-sm font-medium text-neutral-800">
                自社の厚生年金保険の被保険者数（人）
              </label>
              <input
                id="companySize"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="例：40"
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                パート・アルバイトを含む、厚生年金保険に加入している従業員数の目安です。特定適用事業所に該当するかどうかの判定に使います。
              </p>
            </div>
          </div>

          {/* ===== ブロック3: 従業員の働き方 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                点検したい従業員の働き方
              </p>
            </div>

            <div>
              <label htmlFor="weeklyHours" className="mb-1.5 block text-sm font-medium text-neutral-800">
                週の所定労働時間（時間）
              </label>
              <input
                id="weeklyHours"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="例：25"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="monthlyWage" className="mb-1.5 block text-sm font-medium text-neutral-800">
                所定内賃金（月額・円）
              </label>
              <input
                id="monthlyWage"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={monthlyWage}
                onChange={(e) => setMonthlyWage(e.target.value)}
                placeholder="例：95000"
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                基本給と諸手当のうち、所定内に支払う賃金の月額です（残業代・賞与・通勤手当などは含めません）。賃金要件が撤廃された時点を選んでいる場合は判定に使いません。
              </p>
            </div>

            <YesNoField
              label="継続して2か月を超えて使用される見込みがある"
              name="expectedOver2Months"
              value={expectedOver2Months}
              onChange={setExpectedOver2Months}
            />

            <YesNoField
              label="学生である"
              name="isStudent"
              value={isStudent}
              onChange={setIsStudent}
              hint="卒業見込みで卒業後も継続勤務予定の人、休学中の人、夜間部・定時制・通信制の学生などは例外的に加入対象になりえます。このツールでは例外は判定していません。"
            />
          </div>

          <ToolSubmitButton>点検する</ToolSubmitButton>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <LocalOnlyNote />
      </Card>

      {/* ===== 結果 ===== */}
      {result && (
        <Card ref={resultRef} role="status" aria-live="polite" className="scroll-mt-4">
          {result.status === 'taisho' ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  5つの要件をすべて満たしており、社会保険の加入対象になりそうです
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した内容を5つの加入要件に照らすと、いずれも満たしていました。これは加入可否の断定ではなく、確認の出発点としての整理です。正確な判定は自社の勤怠・賃金台帳と、必要に応じて年金事務所・専門家でご確認ください。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  満たしていない要件があり、今回の時点では加入対象外になりそうです
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した内容を5つの加入要件に照らすと、下の一覧のとおり満たしていない要件がありました。これは加入可否の断定ではなく、確認の出発点としての整理です。働き方や制度の見直しで要件を満たすようになった場合は、あらためて確認が必要です。
                </p>
              </div>
            </div>
          )}

          {/* 5要件の内訳 */}
          <ul className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
            {result.criteria.map((c) => (
              <li key={c.key} className="flex items-start gap-2">
                {c.met ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success-700" aria-hidden />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning-700" aria-hidden />
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-900">{c.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-neutral-500">
            {result.wageRequirementApplies
              ? '選択した時点では、賃金要件（月額8.8万円以上）はまだ有効として判定しています。'
              : '選択した時点は賃金要件の撤廃予定日（2026年10月1日）以降のため、賃金要件は判定に使っていません。撤廃時期は予定であり、確認日時点で確定した施行期日ではありません。'}
          </p>

          <ResultDisclaimer detail="学生の例外的な取り扱いや、正社員の4分の3以上の労働時間・日数で働く場合の加入など、このツールで扱っていない論点もあります。正確な判定は自社の勤怠・賃金台帳と、必要に応じて年金事務所・専門家にご確認ください。" />

          {/* ===== 番頭 登録CTA（結果末尾に1本・高痛点/低痛点で出し分け） ===== */}
          <SignupCta result={result} input={lastInput} />
        </Card>
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
//   保存する（signup側の受け皿は既存・変更不要）。note には入力済みの数字の要約だけを
//   載せる（氏名は扱わない・ユーザー自身が保存を選んだ会社データ・400字上限はsignup側と同じ）。
//   文言は「この結果を会社に覚えさせて、同じ点検を続けられる」トーンに統一。
//   Phase1/景表法厳守: 「加入確定」等は書かず、実挙動どおり「〜になりそう」の整理に留める。
function SignupCta({ result, input }: { result: SyahoKanyuResult; input: SyahoKanyuInput | null }) {
  const highPain = result.status === 'taisho'

  // 保存する記録の要約（/companyで「会社の記憶」になる本文）。
  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const parts = input
    ? [
        `パート社会保険 加入対象セルフ点検（${dateJp}・banto-roumu.com/tools/syaho-kanyu-taisho-check）：`,
        `被保険者数${input.companySize}人、週の所定労働時間${input.weeklyHours}時間、所定内賃金 月${input.monthlyWage}円、`,
        `2か月超の雇用見込み${input.expectedOver2Months ? 'あり' : 'なし'}、学生${input.isStudent ? 'に該当' : 'ではない'}`,
        `。結果：${result.status === 'taisho' ? '5つの要件をすべて満たし、加入対象になりそう' : '満たしていない要件があり、今回の時点では対象外になりそう'}。`,
      ]
    : []
  const note = parts.join('').slice(0, 400)
  const href = note ? `${SIGNUP_HREF}&note=${encodeURIComponent(note)}` : SIGNUP_HREF

  return (
    <ToolSignupCta
      href={href}
      location="syaho_kanyu_tool"
      status={result.status}
      title={
        highPain
          ? '対象になりそうな人の確認を、記録を残すところから始める'
          : 'この点検結果を、会社の記録として残す'
      }
      body={
        highPain
          ? '加入対象になりそうな人が1人見つかったら、他のパート従業員にも同じ確認が要ります。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。自社の従業員数や勤務形態も覚えさせれば、賃金要件の撤廃（2026年10月予定）など制度が変わったときも、条件を入れ直さずに同じ点検を続けられます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は自社の従業員数や勤務形態を覚えるので、賃金要件の撤廃（2026年10月予定）や企業規模要件の縮小で前提が変わったときも、入れ直さずに同じ点検を続けられます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}
