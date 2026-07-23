'use client'

import { useState, useEffect, useRef } from 'react'
import { CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta, ToolSubmitButton } from '@/components/tools/client'

// ============================================================================
// 年5日 有給取得義務 セルフ点検ツール（クライアント計算・会社データ非保存）
//   入力（基準日・付与日数・取得済み日数）はすべてブラウザ内で計算する。
//   サーバには一切送信しない（fetch/API 呼び出しなし）。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=yukyu_tool）
//
//   Phase1 厳守: 断定的な個別法的助言をしない。数値は厚労省の一般的枠組み
//   （2019/4施行・年10日以上付与の労働者が対象・基準日から1年以内に5日）に整合。
//   結果は「確認の出発点」であり合否判定ではないことを明示する。
// ============================================================================

// CTA = 番頭 無料登録。既存signupのUTM受け皿(app/(auth)/signup)に合わせる。
const SIGNUP_HREF =
  '/signup?next=/company&utm_source=banto_tool&utm_campaign=yukyu_5nichi'

type Result = {
  /** 義務対象か（年10日以上付与） */
  eligible: boolean
  /** 付与日数（対象判定の根拠表示用） */
  granted: number
  /** すでに取得した日数（5日にカウントできる分として入力された値） */
  taken: number
  /** あと何日取得させる必要があるか（0以上） */
  remaining: number
  /** 期限（基準日+1年） */
  deadline: Date
  /** 期限までの残り日数（負なら期限超過） */
  daysToDeadline: number
  /** 次の基準日（基準日+1年） */
  nextKijunbi: Date
}

function parseDateOnly(v: string): Date | null {
  // <input type="date"> は 'YYYY-MM-DD'。ローカル正午で構築し timezone ずれを避ける。
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function addOneYear(d: Date): Date {
  // 基準日から1年後（同月同日）。2/29など存在しない日付は月末側へ自然に丸められる。
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

function formatJp(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const MS_PER_DAY = 86_400_000

export function Calculator() {
  const [kijunbi, setKijunbi] = useState('')
  const [granted, setGranted] = useState('')
  const [taken, setTaken] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  // I5: 送信後、結果ブロックへ自動スクロール（結果はフォールド下に描画され「反応した？」と
  //   二度押し/離脱するのを防ぐ・P02/P08）。結果が確定したときだけ発火。
  const resultRef = useRef<HTMLDivElement>(null)

  useToolOpen('yukyu_5nichi')

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const base = parseDateOnly(kijunbi)
    if (!base) {
      setError('基準日（年休が付与された日）を入力してください。')
      return
    }
    const g = Number(granted)
    const t = Number(taken)
    if (!Number.isFinite(g) || g < 0 || g > 40) {
      setError('付与日数は0〜40の範囲で入力してください。')
      return
    }
    if (!Number.isFinite(t) || t < 0 || t > 40) {
      setError('取得済みの日数は0〜40の範囲で入力してください。')
      return
    }

    const eligible = g >= 10
    const deadline = addOneYear(base)
    const nextKijunbi = addOneYear(base)
    // 「本日」もローカル正午に正規化して日数差を安定させる。
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)
    const daysToDeadline = Math.round((deadline.getTime() - today.getTime()) / MS_PER_DAY)
    const remaining = eligible ? Math.max(0, 5 - Math.min(t, 5)) : 0

    const res: Result = {
      eligible,
      granted: g,
      taken: t,
      remaining,
      deadline,
      daysToDeadline,
      nextKijunbi,
    }
    setResult(res)

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    const status = !eligible
      ? 'not_eligible'
      : remaining === 0
        ? 'met'
        : daysToDeadline < 0
          ? 'overdue'
          : 'shortfall'
    track('tool_completed', { tool: 'yukyu_5nichi', status })
  }

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card>
        <form onSubmit={handleCheck} className="space-y-5">
          <div>
            <label
              htmlFor="kijunbi"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              年休が付与された日（基準日）
            </label>
            <input
              id="kijunbi"
              type="date"
              lang="ja"
              value={kijunbi}
              onChange={(e) => setKijunbi(e.target.value)}
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              その社員に年次有給休暇が付与された日を入れてください。入社日ではなく付与日です。
            </p>
          </div>

          <div>
            <label
              htmlFor="granted"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              この基準日に付与された日数
            </label>
            <input
              id="granted"
              type="number"
              inputMode="numeric"
              min={0}
              max={40}
              step={1}
              value={granted}
              onChange={(e) => setGranted(e.target.value)}
              placeholder="例：10"
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              年10日以上付与される社員が、年5日の取得義務の対象です。
            </p>
          </div>

          <div>
            <label
              htmlFor="taken"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              これまでに取得した日数
            </label>
            <input
              id="taken"
              type="number"
              inputMode="decimal"
              min={0}
              max={40}
              step={0.5}
              value={taken}
              onChange={(e) => setTaken(e.target.value)}
              placeholder="例：2"
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              本人が請求して取得した日数と、計画的付与で取得した日数を合わせて入れてください（半日単位は0.5で入力できます）。
            </p>
          </div>

          <ToolSubmitButton>点検する</ToolSubmitButton>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <LocalOnlyNote />
      </Card>

      {/* ===== 結果 ===== */}
      {result && (
        <Card ref={resultRef} className="scroll-mt-4">
          {!result.eligible ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-neutral-400" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    年5日の取得義務の対象ではなさそうです
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    入力された付与日数は{result.granted}日でした。年5日を取らせる義務は、年10日以上の年次有給休暇が付与される社員が対象です。
                    付与日数が10日に満たない場合は、この点検の対象外になります。付与日数の数え方に不安がある場合は、自社の就業規則や年次有給休暇管理簿でご確認ください。
                  </p>
                </div>
              </div>
            </div>
          ) : result.remaining === 0 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    年5日の取得は満たせていそうです
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    取得済みが{result.taken}日で、年5日の目安に届いています。念のため、取得した時季・日数・基準日が年次有給休暇管理簿に記録されているかも確認しておくと安心です。
                  </p>
                </div>
              </div>
              <ResultDates result={result} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    あと{result.remaining}日、取得させる必要がありそうです
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    取得済みが{result.taken}日のため、年5日まで{result.remaining}日足りていません。
                    足りない分は、本人の意見を聴いたうえで会社が取得する時季を指定して取らせる方法があります。
                    {result.daysToDeadline < 0
                      ? '入力した基準日から1年の期限は、すでに過ぎています。取得状況と管理簿を早めにご確認ください。'
                      : `期限（基準日から1年）まで残り約${result.daysToDeadline}日です。`}
                  </p>
                </div>
              </div>
              <ResultDates result={result} />
            </div>
          )}

          <ResultDisclaimer detail="正確な取得状況や個別の判断は、自社の就業規則・年次有給休暇管理簿でご確認いただき、必要に応じて専門家にご相談ください。" />

          {/* ===== 番頭 登録CTA（結果末尾に1本のみ・痛点別に出し分け） ===== */}
          {result.eligible && <SignupCta result={result} />}
        </Card>
      )}
    </div>
  )
}

// 結果末尾の番頭登録CTA（C08: zangyodai方式の横展開）。
//   計算結果の要約を note= で signup へ引き渡し → /company が会社作成時に「会社の記憶」へ
//   保存する（signup側の受け皿は既存・変更不要）。note には入力済みの数字の要約だけを
//   載せる（氏名は扱わない・ユーザー自身が保存を選んだ会社データ・400字上限はsignup側と同じ）。
//   文言は「この結果を会社に覚えさせて、毎年同じ点検を続けられる」トーンに統一。
//   Phase1/景表法厳守: 「違反判定/解消」「社労士監修」は書かず、実挙動どおりの約束に留める。
function SignupCta({ result }: { result: Result }) {
  // status は tool_completed と同じ分岐キー（高痛点コホートの登録CTR比較用）。
  const status = result.remaining === 0 ? 'met' : result.daysToDeadline < 0 ? 'overdue' : 'shortfall'
  const highPain = result.remaining > 0

  // 保存する記録の要約（/companyで「会社の記憶」になる本文）。
  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const parts = [
    `年5日有給取得セルフ点検（${dateJp}・banto-roumu.com/tools/yukyu-5nichi-check）：`,
    `付与${result.granted}日・取得済み${result.taken}日、年5日まであと${result.remaining}日`,
    `。取得期限の目安 ${formatJp(result.deadline)}`,
    result.daysToDeadline < 0 ? '（期限を経過している可能性）' : `（残り約${result.daysToDeadline}日）`,
    '。',
  ]
  const note = parts.join('').slice(0, 400)
  const href = `${SIGNUP_HREF}&note=${encodeURIComponent(note)}`

  return (
    <ToolSignupCta
      href={href}
      location="yukyu_tool"
      status={status}
      title={
        highPain
          ? `あと${result.remaining}日の管理を、記録を残すところから始める`
          : 'この点検結果を、会社の記録として残す'
      }
      body={
        highPain
          ? 'あと何日足りないかは、社員ごとに基準日も期限も違います。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。社員ごとの基準日と取得状況も覚えさせれば、次からは1人ずつ入れ直さずに、足りていなさそうな人から一緒に確認できます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は社員ごとの基準日や付与ルールを覚えるので、毎年の同じ点検を、前提を入れ直さずに続けられます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}

function ResultDates({ result }: { result: Result }) {
  return (
    <dl className="grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 flex-none text-neutral-400" aria-hidden />
        <div>
          <dt className="text-xs text-neutral-500">年5日を取らせる期限</dt>
          <dd className="text-sm font-medium text-neutral-900">{formatJp(result.deadline)}</dd>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 flex-none text-neutral-400" aria-hidden />
        <div>
          <dt className="text-xs text-neutral-500">次の基準日</dt>
          <dd className="text-sm font-medium text-neutral-900">{formatJp(result.nextKijunbi)}</dd>
        </div>
      </div>
    </dl>
  )
}
