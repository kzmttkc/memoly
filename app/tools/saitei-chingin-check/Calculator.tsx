'use client'

import { useState, useEffect, useRef } from 'react'
import { CircleDollarSign, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { inputClass } from '@/components/ui/Input'
import { track } from '@/lib/analytics'
import { useToolOpen, LocalOnlyNote, ResultDisclaimer, ToolSignupCta, ToolSubmitButton, preHydrationValue } from '@/components/tools/client'

// ============================================================================
// 最低賃金セルフ点検ツール（クライアント計算・会社データ非保存）
//   都道府県を選び、自社の時給（時間額）を入れると、地域別最低賃金を下回っていないか、
//   下回っている場合はあと何円上げる必要があるかを、ブラウザ内だけで確認できる。
//   サーバには一切送信しない（fetch/API 呼び出しなし）。
//
//   数値（一次情報）: 令和7年度 地域別最低賃金 全国一覧（厚生労働省）。2026-07-24 確認。
//     出典 PDF: https://www.mhlw.go.jp/content/11200000/001571192.pdf
//     ※各都道府県の発効日はすべて経過済み（令和7年10月〜令和8年3月）＝現在の適用額。
//     ※令和8年度（2026年度）の改定は例年夏〜秋に決定・発効するため「最新は要確認」を明示する。
//
//   計測（lib/analytics の window.plausible 経由・CSPインラインJS不要）:
//     - tool_open       : 初回マウント（ページ表示）で1回
//     - tool_completed  : 「点検する」実行で発火（結果種別のみ・PIIなし）
//     - signup_cta_clicked : 結果末尾CTAクリック（location=saitei_chingin_tool）
//
//   Phase1 厳守: 断定的な個別法的助言をしない。結果は「確認の出発点」であり
//   合否・適法性の判定ではないことを明示する。
// ============================================================================

// CTA = 番頭 無料登録。既存signupのUTM受け皿(app/(auth)/signup)に合わせる。
const SIGNUP_HREF =
  '/signup?next=/company&utm_source=banto_tool&utm_campaign=saitei_chingin'

// 令和7年度 地域別最低賃金（時間額・円）。prev=改定前額（令和6年度）。effective=発効日。
//   厚生労働省「令和7年度地域別最低賃金全国一覧」2026-07-24 確認。表示順はPDFの掲載順（北→南）。
type Pref = { name: string; wage: number; prev: number; effective: string }
const PREFECTURES: Pref[] = [
  { name: '北海道', wage: 1075, prev: 1010, effective: '令和7年10月4日' },
  { name: '青森', wage: 1029, prev: 953, effective: '令和7年11月21日' },
  { name: '岩手', wage: 1031, prev: 952, effective: '令和7年12月1日' },
  { name: '宮城', wage: 1038, prev: 973, effective: '令和7年10月4日' },
  { name: '秋田', wage: 1031, prev: 951, effective: '令和8年3月31日' },
  { name: '山形', wage: 1032, prev: 955, effective: '令和7年12月23日' },
  { name: '福島', wage: 1033, prev: 955, effective: '令和8年1月1日' },
  { name: '茨城', wage: 1074, prev: 1005, effective: '令和7年10月12日' },
  { name: '栃木', wage: 1068, prev: 1004, effective: '令和7年10月1日' },
  { name: '群馬', wage: 1063, prev: 985, effective: '令和8年3月1日' },
  { name: '埼玉', wage: 1141, prev: 1078, effective: '令和7年11月1日' },
  { name: '千葉', wage: 1140, prev: 1076, effective: '令和7年10月3日' },
  { name: '東京', wage: 1226, prev: 1163, effective: '令和7年10月3日' },
  { name: '神奈川', wage: 1225, prev: 1162, effective: '令和7年10月4日' },
  { name: '新潟', wage: 1050, prev: 985, effective: '令和7年10月2日' },
  { name: '富山', wage: 1062, prev: 998, effective: '令和7年10月12日' },
  { name: '石川', wage: 1054, prev: 984, effective: '令和7年10月8日' },
  { name: '福井', wage: 1053, prev: 984, effective: '令和7年10月8日' },
  { name: '山梨', wage: 1052, prev: 988, effective: '令和7年12月1日' },
  { name: '長野', wage: 1061, prev: 998, effective: '令和7年10月3日' },
  { name: '岐阜', wage: 1065, prev: 1001, effective: '令和7年10月18日' },
  { name: '静岡', wage: 1097, prev: 1034, effective: '令和7年11月1日' },
  { name: '愛知', wage: 1140, prev: 1077, effective: '令和7年10月18日' },
  { name: '三重', wage: 1087, prev: 1023, effective: '令和7年11月21日' },
  { name: '滋賀', wage: 1080, prev: 1017, effective: '令和7年10月5日' },
  { name: '京都', wage: 1122, prev: 1058, effective: '令和7年11月21日' },
  { name: '大阪', wage: 1177, prev: 1114, effective: '令和7年10月16日' },
  { name: '兵庫', wage: 1116, prev: 1052, effective: '令和7年10月4日' },
  { name: '奈良', wage: 1051, prev: 986, effective: '令和7年11月16日' },
  { name: '和歌山', wage: 1045, prev: 980, effective: '令和7年11月1日' },
  { name: '鳥取', wage: 1030, prev: 957, effective: '令和7年10月4日' },
  { name: '島根', wage: 1033, prev: 962, effective: '令和7年11月17日' },
  { name: '岡山', wage: 1047, prev: 982, effective: '令和7年12月1日' },
  { name: '広島', wage: 1085, prev: 1020, effective: '令和7年11月1日' },
  { name: '山口', wage: 1043, prev: 979, effective: '令和7年10月16日' },
  { name: '徳島', wage: 1046, prev: 980, effective: '令和8年1月1日' },
  { name: '香川', wage: 1036, prev: 970, effective: '令和7年10月18日' },
  { name: '愛媛', wage: 1033, prev: 956, effective: '令和7年12月1日' },
  { name: '高知', wage: 1023, prev: 952, effective: '令和7年12月1日' },
  { name: '福岡', wage: 1057, prev: 992, effective: '令和7年11月16日' },
  { name: '佐賀', wage: 1030, prev: 956, effective: '令和7年11月21日' },
  { name: '長崎', wage: 1031, prev: 953, effective: '令和7年12月1日' },
  { name: '熊本', wage: 1034, prev: 952, effective: '令和8年1月1日' },
  { name: '大分', wage: 1035, prev: 954, effective: '令和8年1月1日' },
  { name: '宮崎', wage: 1023, prev: 952, effective: '令和7年11月16日' },
  { name: '鹿児島', wage: 1026, prev: 953, effective: '令和7年11月1日' },
  { name: '沖縄', wage: 1023, prev: 952, effective: '令和7年12月1日' },
]

type Result = {
  pref: Pref
  hourly: number
  /** 最低賃金を満たしているか（時給 >= 地域別最低賃金） */
  meets: boolean
  /** 不足額（下回っている場合の最低賃金 − 時給。満たしていれば0） */
  shortfall: number
  /** 余裕額（満たしている場合の 時給 − 最低賃金。下回っていれば0） */
  margin: number
}

export function Calculator() {
  const [prefName, setPrefName] = useState(() => preHydrationValue('pref'))
  const [hourly, setHourly] = useState(() => preHydrationValue('hourly'))
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  // 送信後、結果ブロックへ自動スクロール（結果はフォールド下に描画され「反応した？」と
  //   二度押し/離脱するのを防ぐ・既存ツールと同じ挙動）。結果が確定したときだけ発火。
  const resultRef = useRef<HTMLDivElement>(null)

  useToolOpen('saitei_chingin')

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [result])

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const pref = PREFECTURES.find(p => p.name === prefName)
    if (!pref) {
      setError('都道府県を選んでください。')
      return
    }
    const h = Number(hourly)
    if (!Number.isFinite(h) || h <= 0 || h > 100000) {
      setError('自社の時給（時間額）を正しい数字で入力してください。')
      return
    }

    const meets = h >= pref.wage
    const res: Result = {
      pref,
      hourly: h,
      meets,
      shortfall: meets ? 0 : pref.wage - h,
      margin: meets ? h - pref.wage : 0,
    }
    setResult(res)

    // 計測: 結果種別のみ（PII・入力値は送らない）。
    const status = meets ? 'meets' : 'below'
    track('tool_completed', { tool: 'saitei_chingin', status })
  }

  return (
    <div className="space-y-6">
      {/* ===== 入力フォーム ===== */}
      <Card>
        <form onSubmit={handleCheck} className="space-y-5">
          <div>
            <label
              htmlFor="pref"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              都道府県
            </label>
            <select
              id="pref"
              value={prefName}
              onChange={e => setPrefName(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              required
            >
              <option value="">選択してください</option>
              {PREFECTURES.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              最低賃金は勤務地（事業場のある都道府県）を基準に確認します。
            </p>
          </div>

          <div>
            <label
              htmlFor="hourly"
              className="mb-1.5 block text-sm font-medium text-neutral-800"
            >
              自社の時給（時間額・円）
            </label>
            <input
              id="hourly"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              value={hourly}
              onChange={e => setHourly(e.target.value)}
              placeholder="例：1050"
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              いちばん低い時給の方の金額で確認すると安全です。月給制の場合は、月額を1か月の所定労働時間で割った時間額に換算して入れてください。
            </p>
          </div>

          <ToolSubmitButton>最低賃金を下回っていないか点検する</ToolSubmitButton>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </form>

        <LocalOnlyNote />
      </Card>

      {/* ===== 結果 ===== */}
      {result && (
        <Card ref={resultRef} className="scroll-mt-4">
          {result.meets ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success-700" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    地域別最低賃金は満たせていそうです
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {result.pref.name}の地域別最低賃金は時間額{result.pref.wage.toLocaleString()}円（{result.pref.effective}発効）です。
                    入力された時給{result.hourly.toLocaleString()}円は、これを{result.margin.toLocaleString()}円上回っています。
                    通勤手当や精皆勤手当など、最低賃金の計算に算入しない賃金がある点や、月給制の場合の時間額換算にはご注意ください。
                  </p>
                </div>
              </div>
              <ResultWageDetail pref={result.pref} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning-700" aria-hidden />
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    地域別最低賃金を下回っている可能性があります
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {result.pref.name}の地域別最低賃金は時間額{result.pref.wage.toLocaleString()}円（{result.pref.effective}発効）です。
                    入力された時給{result.hourly.toLocaleString()}円は、これより{result.shortfall.toLocaleString()}円低くなっています。
                    最低賃金を満たすには、時間額を{result.pref.wage.toLocaleString()}円以上に見直すことが考えられます（あと{result.shortfall.toLocaleString()}円の引き上げが目安です）。
                    月給制の場合は時間額への換算方法によって結果が変わるため、実際の支給額と所定労働時間で改めてご確認ください。
                  </p>
                </div>
              </div>
              <ResultWageDetail pref={result.pref} />
            </div>
          )}

          <ResultDisclaimer detail="表示している最低賃金額は令和7年度の一次情報にもとづく目安です。最新の適用額・発効日や、最低賃金に算入する賃金の範囲は、厚生労働省の地域別最低賃金の全国一覧や、お近くの労働局・労働基準監督署でご確認ください。" />

          <SignupCta result={result} />
        </Card>
      )}
    </div>
  )
}

// 結果末尾の番頭登録CTA（既存ツールと同じ方式）。
//   計算結果の要約を note= で signup へ引き渡し → /company が会社作成時に「会社の記憶」へ
//   保存する（signup側の受け皿は既存・変更不要）。note には入力済みの数字の要約だけを載せる。
//   Phase1/景表法厳守: 「違反判定/解消」「社労士監修」は書かず、実挙動どおりの約束に留める。
function SignupCta({ result }: { result: Result }) {
  const status = result.meets ? 'meets' : 'below'
  const highPain = !result.meets

  const today = new Date()
  const dateJp = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const parts = [
    `最低賃金セルフ点検（${dateJp}・banto-roumu.com/tools/saitei-chingin-check）：`,
    `${result.pref.name}の地域別最低賃金 時間額${result.pref.wage.toLocaleString()}円（令和7年度）に対し、自社の時給${result.hourly.toLocaleString()}円`,
    result.meets ? `（${result.margin.toLocaleString()}円上回る）` : `（${result.shortfall.toLocaleString()}円下回る・要見直し）`,
    '。最新の適用額は要確認。',
  ]
  const note = parts.join('').slice(0, 400)
  const href = `${SIGNUP_HREF}&note=${encodeURIComponent(note)}`

  return (
    <ToolSignupCta
      href={href}
      location="saitei_chingin_tool"
      status={status}
      title={
        highPain
          ? 'この時給の見直しを、会社の記録に残すところから始める'
          : 'この点検結果を、会社の記録として残す'
      }
      body={
        highPain
          ? '最低賃金は毎年10月ごろに改定され、都道府県ごとに額も発効日も違います。番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。都道府県や社員ごとの時給を覚えさせれば、改定のたびに一から調べ直さずに、影響が出そうな人から一緒に確認できます。'
          : '番頭に無料登録して会社を作ると、いま画面に出ている点検結果がそのまま「会社の記憶」に保存されます。番頭は勤務地や時給の設定を覚えるので、毎年の最低賃金改定への確認を、前提を入れ直さずに続けられます。'
      }
      label="この結果を自社の記録として保存（無料）"
    />
  )
}

function ResultWageDetail({ pref }: { pref: Pref }) {
  return (
    <dl className="grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <CircleDollarSign className="mt-0.5 h-4 w-4 flex-none text-neutral-400" aria-hidden />
        <div>
          <dt className="text-xs text-neutral-500">令和7年度の地域別最低賃金</dt>
          <dd className="text-sm font-medium text-neutral-900">
            時間額 {pref.wage.toLocaleString()}円（{pref.effective}発効）
          </dd>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <CircleDollarSign className="mt-0.5 h-4 w-4 flex-none text-neutral-400" aria-hidden />
        <div>
          <dt className="text-xs text-neutral-500">改定前（令和6年度）</dt>
          <dd className="text-sm font-medium text-neutral-900">
            時間額 {pref.prev.toLocaleString()}円
          </dd>
        </div>
      </div>
    </dl>
  )
}
