import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Brain,
  MessageSquareText,
  FileText,
  ShieldCheck,
  Lock,
  BadgeCheck,
  ArrowRight,
  ArrowDown,
  Check,
  X,
  Building2,
  Sparkles,
  Clock,
  Search,
  FileSignature,
  Bell,
  Database,
  KeyRound,
  Trash2,
} from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import TryDemo from './_components/TryDemo'
import { PLANS } from '@/lib/plans'

// ============================================================================
// /business — 番頭(Banto) 公開ランディングページ（認証不要・公開ルート）
//   ルート app/layout.tsx の <body> は消費者Memoly向けにダーク強制
//   (bg-gray-950 text-gray-100)。本ページはBtoB労務向けライト基調が要件のため、
//   最外要素に .company-light（globals.css 定義のライト再マップ + 白背景）を当てて
//   ダーク body を上書きする。/company 配下と同じ手法。middleware の
//   PROTECTED_PREFIXES は /chat /memory /company のみで /business は含まれない＝公開。
//
//   設計方針（2026-06-27 CMO 改稿）:
//     - 核の主張「汎用AIは毎回説明が要る／番頭は覚えている」は1回だけ強く言う。
//       各機能は「自社に合わせて」を連呼せず、もたらす成果で差別化する
//       （覚える=記憶の蓄積 / 答える=調べ物ゼロで即答 / つくる=下書きが数分 /
//        気づく=見逃し防止）。
//     - 企業の焦点は業務効率化。番頭は"便利"でなく総務1人分の説明・調べ物・
//       下書きを肩代わりする、という枠で語る（業務効率化セクション）。
//     - BtoB採用は"便利"より先に「機密の労務データを預けて大丈夫か」に答える
//       必要があるため、セキュリティ・プライバシーを独立セクションで明示する。
//     - 言葉だけに頼らず、製品の動きを CSS/HTML で様式化した UIプレビューで
//       「見て分かる」状態を作る。画像・写真・AI生成画像は使わない（全てコード描画）。
//
//   Phase1 コンプラ厳守:
//     - 「社労士監修 / AI社労士 / 法的精度○点」は使わない（資格保有の事実と
//       当事者性のみ訴求）。断定的な個別助言・数値保証の訴求をしない
//       （「〜の時間を減らせます」等の表現にとどめる）。
//     - 強調記号(**)・絵文字アイコンは使わない（機能アイコンは lucide）。
// ============================================================================

export const metadata: Metadata = {
  title: '番頭(Banto) — 会社を覚える労務AI',
  description:
    '会社のルール・規程をAIが覚えて、人事・労務の判断即答。汎用AIは毎回説明が必要。番頭は自社の規程を記憶。自社にパーソナライズしたAIを活用できます。',
}

// 機能4軸。「自社に合わせて」を繰り返さず、各軸がもたらす"成果"で差別化する。
const FEATURES = [
  {
    icon: Brain,
    title: '覚える',
    body:
      '会社のプロファイル（所定労働時間・休日・36協定の状況など）と相談データを蓄積。次からは前提を説明しなくても、自社の状況に合わせた最適解を提供します。',
  },
  {
    icon: MessageSquareText,
    title: '答える',
    body:
      'チャットで労務の疑問をそのまま投げるだけ。覚えたルールに沿って、一般論ではなく自社の前提条件に合わせた回答を返します。',
  },
  {
    icon: FileText,
    title: 'つくる',
    body:
      '就業規則や36協定の自社仕様ドラフトを下書き。既存の規程をレビューして、抜けや修正点を洗い出す使い方もできます。',
  },
  {
    icon: ShieldCheck,
    title: '気づく',
    body:
      '労務リスクをスコアで可視化。助成金や法改正の情報を、自社の状況に当てはめて「何を対応すべきか」を瞬時に確認できます。',
  },
]

// 業務効率化の4つの成果。番頭が"肩代わり"する手間を具体に落とす。
const EFFICIENCY = [
  {
    icon: Clock,
    title: '前提説明の往復がゼロに',
    body:
      '汎用AIは毎回「うちは製造業・8名で」と説明が要ります。番頭は一度覚えれば説明不要。毎回の数分が積み上がりません。',
  },
  {
    icon: Search,
    title: '調べ物の時間を圧縮',
    body:
      '「この場合の残業上限は」を法令と自社規程に当てて即答。総務が条文を探し回る時間を減らせます。',
  },
  {
    icon: FileSignature,
    title: '書類のたたき台が数分',
    body:
      '就業規則や36協定のドラフトを、自社の数値を入れた状態で下書き。ゼロから書く時間や、依頼前の準備時間を圧縮できます。',
  },
  {
    icon: Bell,
    title: '見逃しを防ぐ',
    body:
      '助成金や法改正を「自社が対象か」で整理。制度を自分で追い、判断する手間と取りこぼしを減らせます。',
  },
]

// 表示名・価格は lib/plans.ts（SSOT）から引く。LP固有の訴求コピー（tagline/features/
// badge）だけをここで持つ。これにより「価格が LP と課金で食い違う」事故を構造的に防ぐ。
// price は SSOT の monthlyJpy をカンマ区切りに整形して使う。
const PLAN_COPY = [
  {
    name: PLANS.starter.displayName,
    price: PLANS.starter.monthlyJpy.toLocaleString(),
    tagline: 'まず使ってみる',
    badge: null,
    features: ['企業プロファイルの記憶', 'AIチャット相談', '労務リスク診断'],
    featured: false,
  },
  {
    name: PLANS.standard.displayName,
    price: PLANS.standard.monthlyJpy.toLocaleString(),
    tagline: '記憶フル・主力プラン',
    badge: '主力',
    features: [
      'Entry のすべて',
      '相談履歴のフル記憶で精度向上',
      '規程ドラフト作成・レビュー',
      '助成金・法改正の自分ごと通知',
    ],
    featured: true,
  },
  {
    name: PLANS.shigyo.displayName,
    price: PLANS.shigyo.monthlyJpy.toLocaleString(),
    tagline: '複数の顧問先を管理',
    badge: '士業向け',
    features: [
      'Standard のすべて',
      '複数企業（顧問先）の切り替え',
      '企業ごとに記憶・データを分離',
    ],
    featured: false,
  },
]

// ---------------------------------------------------------------------------
// 様式化UIプレビュー — 製品の動きをコードだけで再現する小コンポーネント。
//   「会社プロファイルを覚えている → 自社前提で質問 → 番頭が自社前提で即答」
//   実スクショ・画像は使わず、面と吹き出しで動きを表現する。
// ---------------------------------------------------------------------------
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* 装飾の淡いグロー（背面） */}
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-brand-100/50 blur-2xl"
      />
      <Card className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60">
        {/* ウィンドウバー */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
            <Brain className="h-3 w-3" aria-hidden />
          </span>
          <span className="text-xs font-semibold text-neutral-700">番頭</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden />
            記憶あり
          </span>
        </div>

        <div className="space-y-3 px-4 py-4">
          {/* 覚えている会社プロファイル */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              覚えている自社プロファイル
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['製造業', '従業員 8名', '所定 8h / 週40h', '36協定 未締結'].map(
                tag => (
                  <span
                    key={tag}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 tabular-nums"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* ユーザーの質問（右寄せ吹き出し） */}
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-[13px] leading-relaxed text-white">
              来週、残業させても大丈夫?
            </p>
          </div>

          {/* 番頭の回答（左寄せ・会社前提を踏まえる） */}
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Brain className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
              自社は
              <span className="font-semibold text-neutral-900">36協定が未締結</span>
              なので、まず時間外労働の上限と締結手続きの確認から。前提を説明し直す必要はありません。
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataIsolationDiagram — 「会社ごとにデータが分離される」をコードだけで図解。
//   中央に番頭マーク。周囲に自社A/B/Cの独立した箱（各に錠前）。箱は点線で
//   区切られ、データが交差しないこと（混ざらない）を視覚化する。RLSの安心を一目で。
//   装飾図のため aria-hidden。隣のキャプションがテキストで意味を担保する。
// ---------------------------------------------------------------------------
function DataIsolationDiagram() {
  const companies = ['自社A', '自社B', '自社C']
  return (
    <div
      aria-hidden
      className="grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]"
    >
      {/* 左：自社A */}
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-neutral-200">
            <Lock className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-neutral-800">{companies[0]}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className="block h-2 w-full rounded-full bg-brand-200/70" />
          <span className="block h-2 w-4/5 rounded-full bg-brand-200/50" />
          <span className="block h-2 w-3/5 rounded-full bg-brand-200/40" />
        </div>
      </div>

      {/* 中央：番頭マーク（接続線は引かず、独立を強調） */}
      <div className="flex justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
          <Brain className="h-6 w-6" />
        </span>
      </div>

      {/* 右：自社B / 自社C を縦に積む（各々独立した点線の箱） */}
      <div className="space-y-4">
        {[companies[1], companies[2]].map((name, i) => (
          <div
            key={name}
            className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-700 ring-1 ring-neutral-200">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-neutral-800">{name}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <span className="block h-2 w-full rounded-full bg-brand-200/70" />
              <span
                className={`block h-2 rounded-full bg-brand-200/50 ${i === 0 ? 'w-3/5' : 'w-4/5'}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimeComparisonBars — 「前提説明の往復が消える」を概念バーで視覚化。
//   汎用AI＝毎回の前提説明（長い薄色帯）＋回答 / 番頭＝回答だけ（短い帯）。
//   断定的な時間数値は書かない。ラベルは「説明」「回答」のみ。
//   バーの長短は概念図であり、色だけに意味を載せないようテキストラベルを併記する。
// ---------------------------------------------------------------------------
function TimeComparisonBars() {
  return (
    <div className="space-y-5">
      {/* 汎用AI */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-500">
          <MessageSquareText className="h-4 w-4" aria-hidden />
          汎用AI
        </p>
        <div
          className="flex h-9 w-full overflow-hidden rounded-lg"
          role="img"
          aria-label="汎用AIは毎回の前提説明に時間がかかり、その後に回答が返る"
        >
          <span className="flex flex-[7] items-center justify-center bg-brand-100 text-xs font-medium text-brand-700">
            前提説明
          </span>
          <span className="flex flex-[3] items-center justify-center bg-brand-600 text-xs font-medium text-white">
            回答
          </span>
        </div>
      </div>

      {/* 番頭 */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-800">
          <Brain className="h-4 w-4" aria-hidden />
          番頭
        </p>
        <div
          className="flex h-9 w-full overflow-hidden rounded-lg"
          role="img"
          aria-label="番頭は前提を覚えているため、説明なしで回答だけが返る"
        >
          <span className="flex flex-[3] items-center justify-center rounded-l-lg bg-brand-600 text-xs font-medium text-white">
            回答
          </span>
          <span className="flex-[7] bg-neutral-100" aria-hidden />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        覚えているぶん、毎回の前提説明が積み上がりません。
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RiskScorePreview — 「気づく」を表す様式化UI。労務リスクのスコアカード。
//   SVGの円ゲージ＋帯＋上位リスク。実スコアを断定せず製品の出力イメージを再現。
//   ゲージはaria-hidden、意味はテキスト（要注意・各リスク行）で担保する。
// ---------------------------------------------------------------------------
function RiskScorePreview() {
  const R = 30
  const C = 2 * Math.PI * R
  const ratio = 0.62 // 概念図の充填率（断定値ではない）
  return (
    <Card className="overflow-hidden p-0 shadow-md ring-1 ring-neutral-200/60">
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
          <ShieldCheck className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-xs font-semibold text-neutral-700">労務リスク診断</span>
      </div>

      <div className="flex items-center gap-4 px-4 py-4">
        {/* SVG 円ゲージ */}
        <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0" aria-hidden>
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="var(--color-neutral-200)"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="var(--color-warning-500)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            transform="rotate(-90 40 40)"
          />
          <text
            x="40"
            y="44"
            textAnchor="middle"
            className="fill-neutral-900 text-[14px] font-bold"
          >
            要注意
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
            <Bell className="h-3 w-3" aria-hidden />
            対応をおすすめする項目
          </span>
          <ul className="mt-2.5 space-y-1.5">
            {['36協定が未締結のまま', '就業規則の改定が未反映'].map(item => (
              <li
                key={item}
                className="flex items-start gap-1.5 text-[13px] leading-snug text-neutral-700"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-500"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

export default function BusinessLandingPage() {
  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Brain className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              番頭
              <span className="ml-1 text-sm font-medium text-neutral-400">Banto</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login?next=/company"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              無料で始める
            </Link>
          </nav>
        </div>
      </header>

      {/* ===== ヒーロー（above the fold） =====
          左：価値ステートメント1つ + 支える一行 + 主要CTA1つ
          右：製品の動きを示す様式化UIプレビュー（見て分かる） */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* 左：言葉 */}
          <div className="text-center lg:text-left">
            <Badge tone="brand" className="mb-6">
              会社を覚える労務AI
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl">
              自社のことを覚えている、
              <br className="hidden sm:block" />
              労務のAI相談役
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
              所定労働時間も、休日のルールも、過去の相談も番頭が覚えています。
              前提を説明し直さずに、自社の状況に合わせた答えがすぐ返ります。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/signup"
                className={buttonClass({ variant: 'primary', size: 'lg' })}
              >
                無料で会社を登録して試す
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* 右：見て分かる */}
          <div className="lg:pl-4">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ===== 核の主張：汎用AI vs 番頭（左右対比・ここで一度だけ強く言う） ===== */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              汎用AIとの違いは「覚えているか」
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              同じ質問でも、前提を毎回説明するか、自社の前提から答えるかで体験が変わります。
            </p>
          </div>

          <div className="grid items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr]">
            {/* 汎用AI 側 */}
            <Card className="flex flex-col border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                  <MessageSquareText className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-semibold text-neutral-700">汎用AI</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                毎回ゼロから会社の前提を説明する必要があります。
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  '所定労働時間や休日を毎回入力',
                  '過去の相談は覚えていない',
                  '答えは一般論で精度が低い',
                ].map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-neutral-600"
                  >
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* 中央の矢印（縦/横で切替） */}
            <div className="flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-sm">
                <ArrowRight className="hidden h-5 w-5 sm:block" aria-hidden />
                <ArrowDown className="h-5 w-5 sm:hidden" aria-hidden />
              </span>
            </div>

            {/* 番頭 側 */}
            <Card className="flex flex-col border-brand-300 ring-1 ring-brand-200">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <Brain className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-semibold text-neutral-900">番頭</h3>
                <Badge tone="brand" className="ml-auto">
                  覚えている
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                自社の規程と相談履歴を覚えているので、前提から答えます。
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  '会社プロファイルを一度登録すれば再入力不要',
                  '自社の前提に合わせた精度の高い回答',
                  '低コストで企業社労士のように活用できる',
                ].map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-neutral-800"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ===== 体験デモ（早めに体験させる：サンプル会社でアハを安全に） =====
          スクリプト型デモ。本物のAPIは叩かず、用意済みの回答をタイプ表示する
          クライアントコンポーネント。詳細は _components/TryDemo.tsx を参照。 */}
      <TryDemo />

      {/* ===== 業務効率化（企業ニーズ起点：何がどれだけ楽になるか） ===== */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">業務効率化</p>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            総務の説明・調べ物・下書きを肩代わり
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            番頭の価値は"便利"よりも、毎回かかっていた手間そのものを減らすことです。
          </p>
        </div>
        {/* 前提説明の往復が消える：概念バーで一目に */}
        <Card className="mb-8">
          <TimeComparisonBars />
        </Card>
        <div className="grid gap-5 sm:grid-cols-2">
          {EFFICIENCY.map(e => {
            const Icon = e.icon
            return (
              <Card key={e.title} interactive className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-neutral-900">{e.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{e.body}</p>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ===== 機能（覚える・答える・つくる・気づく：成果で差別化） ===== */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              企業がパーソナルAIを持つ時代に
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              覚える・答える・つくる・気づく。4つの軸で、チームの労務を日常から支えます。
            </p>
          </div>
          {/* 「気づく」の出力イメージ：労務リスクのスコアカード */}
          <div className="mx-auto mb-8 w-full max-w-md">
            <RiskScorePreview />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map(f => {
              const Icon = f.icon
              return (
                <Card key={f.title} interactive>
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold text-neutral-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== セキュリティ・プライバシー（機密の労務データを預けて大丈夫か、に答える） ===== */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            機密の労務データを、安心して預けられる設計
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            労務データは会社の機密です。番頭は「便利さ」より先に、預けて大丈夫かに答えます。
          </p>
        </div>
        {/* 会社ごとデータ分離の図解：RLSの安心を一目で */}
        <Card className="mb-8">
          <DataIsolationDiagram />
          <p className="mt-6 text-center text-sm leading-relaxed text-neutral-600">
            会社ごとに記憶もデータも分離。顧問先が増えても混ざりません。
          </p>
        </Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">会社ごとに完全分離</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                行レベルセキュリティ（RLS）で、自社のデータには自社しかアクセスできません。
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">通信・保管の暗号化</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                通信はHTTPS/TLSで暗号化しています。データは、管理されたクラウド（Supabase）で保管します。
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Database className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">AIの学習には使いません</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                入力した相談内容や自社データを、AIモデルの学習には使用しません
                （Anthropic APIは既定で入力を学習に用いません）。
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Trash2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-neutral-900">削除はあなたの権利</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                アカウント削除と同時に全データを削除します。開示・訂正・削除のご請求にも対応します。
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ===== 信頼シグナル（作り手の当事者性） ===== */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">作り手が自分の会社で使うために作った</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  社会保険労務士の資格を持つ作り手が、自分の会社運営で実際に使うために開発しています。
                  現場で必要だったものを、そのまま形にしました。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <KeyRound className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">企業ごとにデータを完全分離</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  行レベルのアクセス制御（RLS）で会社ごとにデータを隔離しています。
                  自社の情報が他社と混ざることはありません。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 料金 ===== */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">料金</h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              現在は無料モニター期間です。すべての機能を無料でお試しいただけます。
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              下記は今後の予定価格です。現時点で課金は行いません。
            </p>
          </div>
          <div className="grid items-start gap-5 sm:grid-cols-3">
            {PLAN_COPY.map(p => (
              <Card
                key={p.name}
                className={
                  p.featured
                    ? 'border-brand-300 shadow-md ring-1 ring-brand-200'
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
                  {p.badge && (
                    <Badge tone={p.featured ? 'brand' : 'neutral'}>{p.badge}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{p.tagline}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                    &yen;{p.price}
                  </span>
                  <span className="text-sm text-neutral-500">/月</span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={buttonClass({
                    variant: p.featured ? 'primary' : 'secondary',
                    className: 'mt-6 w-full',
                  })}
                >
                  無料で試す
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 末尾CTA ===== */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Card className="bg-brand-600 text-center">
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            自社を覚えるAIを、今日から
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録して、最初の相談を投げてみてください。前提を説明し直さない労務相談を体験できます。
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/signup"
              className={buttonClass({
                variant: 'secondary',
                size: 'lg',
              })}
            >
              無料で会社を登録して試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      </section>

      {/* ===== フッタ ===== */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
                <Brain className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="font-semibold text-neutral-900">番頭(Banto)</span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
              <Link href="/login?next=/company" className="hover:text-brand-700">
                ログイン
              </Link>
              <Link href="/signup" className="hover:text-brand-700">
                無料で始める
              </Link>
              <Link href="/terms" className="hover:text-brand-700">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-brand-700">
                プライバシー
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            運営：Kizuna Creation
          </p>
        </div>
      </footer>
    </div>
  )
}
