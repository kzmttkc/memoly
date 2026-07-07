'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { track } from '@/lib/analytics'

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

  useEffect(() => {
    track('tool_open', { tool: 'yukyu_5nichi' })
  }, [])

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

          <button type="submit" className={buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' })}>
            点検する
          </button>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
          入力した内容はこのブラウザの中だけで計算します。会社や社員のデータをサーバーに送ることはありません。
        </p>
      </Card>

      {/* ===== 結果 ===== */}
      {result && (
        <Card>
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

          <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-relaxed text-neutral-500">
            この点検は、入力内容をもとにした一般的な目安の整理で、合否や適法性を判定するものではありません。
            正確な取得状況や個別の判断は、自社の就業規則・年次有給休暇管理簿でご確認いただき、必要に応じて専門家にご相談ください。
          </p>

          {/* ===== 番頭 登録CTA（結果末尾に1本のみ） ===== */}
          {result.eligible && (
            <div className="mt-5 rounded-2xl bg-brand-50 p-5">
              <p className="text-sm font-semibold text-neutral-900">
                この点検を、会社が覚えて毎年自動でやる
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                番頭に社員ごとの基準日と付与ルールを覚えさせておくと、次からは基準日を入れ直さずに、期限が近い社員や取得が足りていなさそうな社員を一緒に整理できます。
              </p>
              <Link
                href={SIGNUP_HREF}
                onClick={() => track('signup_cta_clicked', { location: 'yukyu_tool' })}
                className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-4' })}
              >
                番頭に無料登録する
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </Card>
      )}
    </div>
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
