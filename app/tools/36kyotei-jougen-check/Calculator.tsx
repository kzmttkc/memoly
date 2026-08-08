'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta, ToolSubmitButton, preHydrationValue } from '@/components/tools/client'

// ============================================================================
// 36協定 時間外・休日労働の上限セルフ点検ツール（クライアント計算・会社データ非保存）
//   入力（単月の時間外+休日の最大／年の時間外累計／複数月平均の最大／特別条項の適用月数）
//   はすべてブラウザ内で計算する。サーバには一切送信しない（fetch/API 呼び出しなし）。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=36kyotei_tool）
//
//   Phase1 厳守: 断定的な個別法的助言をしない。数値は厚労省の一般的枠組みに整合。
//   結果は「確認の出発点」であり合否判定ではないことを明示する。
//
//   上限ルール（厚労省一次情報・境界を厳密に実装する）:
//     原則        … 時間外は 1か月45時間以内・1年360時間以内。
//     特別条項でも超えられない線:
//       (a) 時間外は 年720時間以内           … 720 を超えると要確認（720は可・721以上でNG）
//       (b) 時間外+休日労働は 単月100時間"未満" … 100 以上で要確認（100ちょうども要確認）
//       (c) 2〜6か月のいずれの平均も 月80時間以内 … 80 を超えると要確認（80は可・80.01以上でNG）
//       (d) 原則の月45時間を超えられるのは 年6か月まで … 特別条項の適用は年6回まで（7回以上でNG）
//   → 「以内=以下」「未満」「超える」を取り違えないよう、比較演算子をルールに一対一で対応させる。
// ============================================================================

// CTA = 番頭 無料登録。既存signupのUTM受け皿(app/(auth)/signup)に合わせる。
const SIGNUP_HREF =
  '/signup?next=/company&utm_source=banto_tool&utm_campaign=36kyotei'

// しきい値（一次情報の数値。マジックナンバーを1か所に集約し境界の意図を明示する）
const LIMIT_MONTH_PRINCIPLE = 45 // 原則: 月45時間"以内"（超で原則超過）
const LIMIT_YEAR_PRINCIPLE = 360 // 原則: 年360時間"以内"
const LIMIT_YEAR_OVERTIME = 720 // 特別条項: 年720時間"以内"（超で要確認）
const LIMIT_SINGLE_MONTH_TOTAL = 100 // 特別条項: 時間外+休日は単月100時間"未満"（100以上で要確認）
const LIMIT_MULTI_MONTH_AVG = 80 // 特別条項: 2〜6か月平均は月80時間"以内"（超で要確認）
const LIMIT_SPECIAL_MONTHS = 6 // 特別条項: 月45時間超は年6か月まで（7か月以上で要確認）

type Flag = {
  /** この基準に照らして確認が要りそうか */
  flagged: boolean
  /** 見出し（基準名） */
  title: string
  /** 入力値を踏まえた非断定の説明 */
  detail: string
}

type Result = {
  flags: Flag[]
  /** 確認が要りそうな項目数 */
  flaggedCount: number
  /** 特別条項の入力があったか（無ければ原則のみで見る） */
  usedSpecial: boolean
  /** C08: 入力値の控え（note= で signup へ引き渡す要約の材料。null=未入力の観点） */
  inputs: {
    smTotal: number | null
    mmOt: number | null
    yrOt: number | null
    mmAvg: number | null
    spMonths: number | null
  }
}

// 数値パース: 空欄は「未入力＝この観点は点検しない」として null を返す。
function parseNum(v: string): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : NaN as unknown as number
}

export function Calculator() {
  const [singleMonthTotal, setSingleMonthTotal] = useState(() => preHydrationValue('smTotal')) // 単月の時間外+休日の合計（最大の月）
  const [maxMonthOvertime, setMaxMonthOvertime] = useState(() => preHydrationValue('mmOt')) // 最も多い月の時間外のみ（原則45との比較）
  const [yearOvertime, setYearOvertime] = useState(() => preHydrationValue('yrOt')) // 年間の時間外の累計
  const [multiMonthAvg, setMultiMonthAvg] = useState(() => preHydrationValue('mmAvg')) // 2〜6か月平均の最大値
  const [specialMonths, setSpecialMonths] = useState(() => preHydrationValue('spMonths')) // 原則45時間を超えた月数（特別条項の適用月数）
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  // I5: 送信後、結果ブロックへ自動スクロール（結果はフォールド下・P02/P08）。
  const resultRef = useRef<HTMLDivElement>(null)

  useToolOpen('36kyotei')

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const smTotal = parseNum(singleMonthTotal)
    const mmOt = parseNum(maxMonthOvertime)
    const yrOt = parseNum(yearOvertime)
    const mmAvg = parseNum(multiMonthAvg)
    const spMonths = parseNum(specialMonths)

    // 明らかな不正値（負・非数値）を弾く。null（空欄）は「その観点は点検しない」として許容。
    const invalid = [smTotal, mmOt, yrOt, mmAvg, spMonths].some(
      (n) => n !== null && (!Number.isFinite(n) || n < 0),
    )
    if (invalid) {
      setError('各項目は0以上の数値で入力してください（分からない欄は空欄のままで構いません）。')
      return
    }
    // 上限ぶれ防止の緩い妥当性（1か月の時間は744時間が上限。桁ミスを弾く）。
    if (
      (smTotal !== null && smTotal > 744) ||
      (mmOt !== null && mmOt > 744) ||
      (mmAvg !== null && mmAvg > 744) ||
      (yrOt !== null && yrOt > 8784) ||
      (spMonths !== null && spMonths > 12)
    ) {
      setError('入力値が大きすぎるようです。単位が時間・月になっているかご確認ください。')
      return
    }
    // 何も入力が無ければ点検できない。
    if ([smTotal, mmOt, yrOt, mmAvg, spMonths].every((n) => n === null)) {
      setError('分かる範囲で、いずれかの項目を入力してください。')
      return
    }

    const flags: Flag[] = []

    // (原則) 最も多い月の時間外が45時間"以内"か。超えていれば特別条項の要否の話になる。
    if (mmOt !== null) {
      flags.push({
        flagged: mmOt > LIMIT_MONTH_PRINCIPLE,
        title: '原則：1か月45時間以内',
        detail:
          mmOt > LIMIT_MONTH_PRINCIPLE
            ? `最も多い月の時間外が${mmOt}時間で、原則の月45時間を超えています。この月は特別条項の適用が前提になり、下の特別条項の各基準に照らして確認が要りそうです。`
            : `最も多い月の時間外は${mmOt}時間で、原則の月45時間以内に収まっています。`,
      })
    }

    // (原則) 年間の時間外が360時間"以内"か。
    if (yrOt !== null) {
      const overYear720 = yrOt > LIMIT_YEAR_OVERTIME
      const overYear360 = yrOt > LIMIT_YEAR_PRINCIPLE
      flags.push({
        flagged: overYear360,
        title: overYear720 ? '特別条項：年720時間以内' : '原則：1年360時間以内',
        detail: overYear720
          ? `年間の時間外の累計が${yrOt}時間で、特別条項でも超えられない年720時間を超えています。集計期間と数え方をあらためて確認しておくと安心です。`
          : overYear360
            ? `年間の時間外の累計が${yrOt}時間で、原則の年360時間を超えています。特別条項の範囲（年720時間以内）に収まっているかも含めて確認が要りそうです。`
            : `年間の時間外の累計は${yrOt}時間で、原則の年360時間以内に収まっています。`,
      })
    }

    // (特別条項a) 時間外+休日の合計が単月100時間"未満"か。100以上で要確認。
    if (smTotal !== null) {
      flags.push({
        flagged: smTotal >= LIMIT_SINGLE_MONTH_TOTAL,
        title: '特別条項：単月の時間外+休日は100時間未満',
        detail:
          smTotal >= LIMIT_SINGLE_MONTH_TOTAL
            ? `最も多い月の時間外+休日労働の合計が${smTotal}時間です。この合計は単月で100時間未満に収める必要があり、100時間に達しているため確認が要りそうです。`
            : `最も多い月の時間外+休日労働の合計は${smTotal}時間で、単月100時間未満に収まっています。`,
      })
    }

    // (特別条項b) 2〜6か月のいずれの平均も月80時間"以内"か。超で要確認。
    if (mmAvg !== null) {
      flags.push({
        flagged: mmAvg > LIMIT_MULTI_MONTH_AVG,
        title: '特別条項：2〜6か月平均は月80時間以内',
        detail:
          mmAvg > LIMIT_MULTI_MONTH_AVG
            ? `複数月の平均（時間外+休日）の最大が${mmAvg}時間です。2〜6か月のいずれの平均も月80時間以内に収める必要があり、80時間を超えているため確認が要りそうです。`
            : `複数月の平均（時間外+休日）の最大は${mmAvg}時間で、月80時間以内に収まっています。`,
      })
    }

    // (特別条項c) 原則の月45時間を超えられるのは年6か月まで。7か月以上で要確認。
    if (spMonths !== null) {
      flags.push({
        flagged: spMonths > LIMIT_SPECIAL_MONTHS,
        title: '特別条項：月45時間超は年6か月まで',
        detail:
          spMonths > LIMIT_SPECIAL_MONTHS
            ? `原則の月45時間を超えた月が年間で${spMonths}か月ありました。特別条項で月45時間を超えられるのは年6か月までのため、確認が要りそうです。`
            : `原則の月45時間を超えた月は年間で${spMonths}か月で、年6か月の範囲に収まっています。`,
      })
    }

    const flaggedCount = flags.filter((f) => f.flagged).length
    const usedSpecial =
      (smTotal !== null && smTotal > LIMIT_MONTH_PRINCIPLE) ||
      (mmOt !== null && mmOt > LIMIT_MONTH_PRINCIPLE) ||
      (yrOt !== null && yrOt > LIMIT_YEAR_PRINCIPLE) ||
      (mmAvg !== null) ||
      (spMonths !== null)

    setResult({ flags, flaggedCount, usedSpecial, inputs: { smTotal, mmOt, yrOt, mmAvg, spMonths } })

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    const status = flaggedCount === 0 ? 'within' : flaggedCount === 1 ? 'one_flag' : 'multi_flag'
    track('tool_completed', { tool: '36kyotei', status })
  }

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card className="flex flex-col">
        {/* 2026-07-28 CTO修正（L1監査#6）: 「36協定」「特別条項」の意味そのものの解説が
            フォームより下（ページ下部）にしかなく、入力前に読める位置になかった
            （ペルソナ1/5指摘）。フォーム冒頭に平易な一言解説を追加する。
            2026-07-30 UX監査 #7: **モバイルのみ** order でフォームの下へ回す
            （DOM順・文面は不変。sm以上は従来どおりフォームの前に出る）。 */}
        <p className="order-2 mt-5 border-t border-neutral-100 pt-5 text-sm leading-relaxed text-neutral-600 sm:order-1 sm:mt-0 sm:mb-5 sm:border-t-0 sm:pt-0">
          「36協定（サブロク協定）」は、残業や休日出勤をさせる前に会社と労働者代表が結んで届け出る約束ごとです。
          これが無いと、残業させること自体が法律違反になりえます。「特別条項」は、繁忙期など特に忙しい時期だけ、
          原則の上限（月45時間・年360時間）を超えて残業できるようにする追加の取り決めです。
        </p>
        <form onSubmit={handleCheck} className="order-1 space-y-5 sm:order-2">
          <p className="text-sm leading-relaxed text-neutral-600">
            分かる範囲で入力してください。分からない欄は空欄のままで構いません。入力した項目だけを、それぞれの上限の目安に照らして整理します。
          </p>

          {/* ===== ブロック1: 原則の上限 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                まず原則の上限を見る（月45時間・年360時間）
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                36協定の基本の上限に照らして確認します。ここでは休日労働を含めない、時間外労働だけの時間を入れてください。
              </p>
            </div>

            <div>
              <label htmlFor="mmOt" className="mb-1.5 block text-sm font-medium text-neutral-800">
                最も多い月の時間外労働（休日労働を除く・時間）
              </label>
              <input
                id="mmOt"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={maxMonthOvertime}
                onChange={(e) => setMaxMonthOvertime(e.target.value)}
                placeholder="例：50"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                直近1年で時間外労働が最も多かった月の、時間外だけの合計時間です。原則の月45時間の目安に照らします。
              </p>
            </div>

            <div>
              <label htmlFor="yrOt" className="mb-1.5 block text-sm font-medium text-neutral-800">
                1年間の時間外労働の累計（時間）
              </label>
              <input
                id="yrOt"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={yearOvertime}
                onChange={(e) => setYearOvertime(e.target.value)}
                placeholder="例：700"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                1年間の時間外労働（休日労働を除く）の累計時間です。原則の年360時間・特別条項の年720時間の目安に照らします。
              </p>
            </div>
          </div>

          {/* ===== ブロック2: 特別条項でも超えられない上限 ===== */}
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                次に特別条項の上限を見る（年720・単月100・平均80・年6か月）
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                特別条項を結んでいる場合に超えられない線に照らして確認します。ここでは時間外労働と休日労働を合わせた時間を入れてください。
              </p>
            </div>

            <div>
              <label htmlFor="smTotal" className="mb-1.5 block text-sm font-medium text-neutral-800">
                最も多い月の時間外+休日労働の合計（時間）
              </label>
              <input
                id="smTotal"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={singleMonthTotal}
                onChange={(e) => setSingleMonthTotal(e.target.value)}
                placeholder="例：95"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                最も多かった月の、時間外労働と休日労働を合わせた合計時間です。単月100時間未満の目安に照らします。
              </p>
            </div>

            <div>
              <label htmlFor="mmAvg" className="mb-1.5 block text-sm font-medium text-neutral-800">
                複数月平均（時間外+休日）の最大（時間・任意）
              </label>
              <input
                id="mmAvg"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={multiMonthAvg}
                onChange={(e) => setMultiMonthAvg(e.target.value)}
                placeholder="例：78"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                連続する2〜6か月の平均（時間外+休日）のうち、最も大きい値です。いずれの平均も月80時間以内の目安に照らします。分からなければ空欄で構いません。番頭に登録すると、勤怠から自動で計算します。
              </p>
            </div>

            <div>
              <label htmlFor="spMonths" className="mb-1.5 block text-sm font-medium text-neutral-800">
                原則の月45時間を超えた月数（年・任意）
              </label>
              <input
                id="spMonths"
                type="number"
                inputMode="numeric"
                min={0}
                max={12}
                step={1}
                value={specialMonths}
                onChange={(e) => setSpecialMonths(e.target.value)}
                placeholder="例：5"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-500">
                直近1年で、時間外労働が原則の月45時間を超えた月の数です。特別条項で超えられるのは年6か月までの目安に照らします。
              </p>
            </div>
          </div>

          <ToolSubmitButton>点検する</ToolSubmitButton>

          {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
        </form>

        {/* order 指定（UX監査 #7）: 兄弟に order を付けた以上、末尾の注記も明示しないと
            既定の order-0 で先頭へ回ってしまう。 */}
        <div className="order-3">
          <LocalOnlyNote />
        </div>
      </Card>

      {/* ===== 結果 ===== */}
      {result && (
        <Card ref={resultRef} role="status" aria-live="polite" className="scroll-mt-4">
          {result.flaggedCount === 0 ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  入力した範囲では、上限の目安に収まっていそうです
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した項目は、いずれも一般的な上限の目安の範囲に収まっていました。ただし、これは入力した数字だけを見た整理です。集計期間や数え方（休日労働の扱い・複数月平均の取り方）によって見え方は変わります。正確な状況は年ごと・月ごとの実績と36協定の内容でご確認ください。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
              <div>
                <p className="text-base font-semibold text-neutral-900">
                  確認が要りそうな箇所が{result.flaggedCount}件ありました
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  入力した数字を一般的な上限の目安に照らすと、下の項目で確認しておきたい点がありました。これは違反の判定ではなく、確認の出発点としての整理です。実際の集計期間・数え方・36協定の内容によって見え方は変わります。
                </p>
              </div>
            </div>
          )}

          {/* 各基準の内訳 */}
          <ul className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
            {result.flags.map((f) => (
              <li key={f.title} className="flex items-start gap-2">
                {f.flagged ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning-700" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success-700" aria-hidden />
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-900">{f.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <ResultDisclaimer detail="時間外・休日労働の集計方法や特別条項の運用は自社の36協定・勤怠記録でご確認いただき、必要に応じて専門家にご相談ください。" />

          {/* ===== 番頭 登録CTA（結果末尾に1本のみ・痛点別に出し分け） ===== */}
          <SignupCta result={result} />
        </Card>
      )}
    </div>
  )
}

// 結果末尾の番頭登録CTA（C08: zangyodai方式の横展開）。
//   計算結果の要約を note= で signup へ引き渡し → /company が会社作成時に「会社の記憶」へ
//   保存する（signup側の受け皿は既存・変更不要）。note には入力済みの数字の要約だけを
//   載せる（ユーザー自身が保存を選んだ会社データ・400字上限はsignup側と同じ）。
//   文言は「この結果を会社に覚えさせて、毎月同じ点検を自動化」トーンに統一。
//   Phase1/景表法厳守: 「違反判定/解消」「社労士監修」は書かず、実挙動どおりの約束に留める
//   （保存無料 = 無料登録・会社作成・記憶保存はすべて無料、の実挙動と一致）。
function SignupCta({ result }: { result: Result }) {
  // status は tool_completed と同じ分岐キー（高痛点コホートの登録CTR比較用）。
  const status =
    result.flaggedCount === 0 ? 'within' : result.flaggedCount === 1 ? 'one_flag' : 'multi_flag'
  const highPain = result.flaggedCount > 0

  // 保存する記録の要約（/companyで「会社の記憶」になる本文）。入力済みの観点だけを載せる。
  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const { smTotal, mmOt, yrOt, mmAvg, spMonths } = result.inputs
  const parts = [
    `36協定 上限セルフ点検（${dateJp}・banto-roumu.com/tools/36kyotei-jougen-check）：`,
    mmOt !== null ? `最も多い月の時間外${mmOt}時間、` : '',
    yrOt !== null ? `年間の時間外累計${yrOt}時間、` : '',
    smTotal !== null ? `最も多い月の時間外+休日合計${smTotal}時間、` : '',
    mmAvg !== null ? `複数月平均（時間外+休日）の最大${mmAvg}時間、` : '',
    spMonths !== null ? `月45時間超は年${spMonths}か月、` : '',
    `確認が要りそうな項目 ${result.flaggedCount}件。`,
  ]
  const note = parts.join('').slice(0, 400)
  const href = `${SIGNUP_HREF}&note=${encodeURIComponent(note)}`

  return (
    <ToolSignupCta
      href={href}
      location="36kyotei_tool"
      status={status}
      title={
        highPain
          ? '上限に近い月の確認を、記録を残すところから始める'
          : 'この点検結果を、会社の記録として残す'
      }
      body={
        highPain
          ? '確認が要りそうな箇所が見つかったら、来月も再来月も同じ点検が要ります。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。自社の36協定の内容や勤務形態も覚えさせれば、月45時間や単月100時間などの上限の点検を、次からは数字の前提を入れ直さずに毎月続けられます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は自社の36協定の内容や勤務形態を覚えるので、毎月の同じ点検を、前提を入れ直さずに続けられます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}
