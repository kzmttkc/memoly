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
import TryDemoLazy from './_components/TryDemoLazy'
import { TrackedCTA } from './_components/TrackedCTA'
import { HeroEyebrow, HeroHeadline, HeroSubcopy } from './_components/HeroCopy'
import { PLANS } from '@/lib/plans'
import { USECASE_LIST } from '@/lib/usecase'
import { TOOL_LIST } from '@/lib/tools'

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
//     - 「社労士監修 / AI社労士 / 法的精度○点」は使わない（「試験合格・未登録」の
//       事実と当事者性のみ訴求。「資格を持つ」等の名称使用制限に触れる表現は不可）。
//       断定的な個別助言・数値保証の訴求をしない
//       （「〜の時間を減らせます」等の表現にとどめる）。
//     - 強調記号(**)・絵文字アイコンは使わない（機能アイコンは lucide）。
// ============================================================================

export const metadata: Metadata = {
  title: '番頭｜会社の規程を覚える労務AI｜中小企業の総務・経営者向け',
  description:
    '会社の規程をAIが覚えて、労務の疑問に自社の前提で即答。汎用AIのように毎回前提を説明する必要がありません。中小企業の総務・経営者向けの労務AIです。',
  alternates: { canonical: '/business' },
  openGraph: {
    title: '番頭｜会社の規程を覚える労務AI｜中小企業の総務・経営者向け',
    description:
      '会社の規程をAIが覚えて、労務の疑問に自社の前提で即答。汎用AIのように毎回前提を説明する必要がありません。中小企業の総務・経営者向けの労務AIです。',
    url: 'https://banto-roumu.com/business',
    siteName: '番頭(Banto)',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: 'https://banto-roumu.com/og-image.png',
        width: 1200,
        height: 630,
        alt: '番頭｜会社の規程を覚える労務AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '番頭｜会社の規程を覚える労務AI｜中小企業の総務・経営者向け',
    description:
      '会社の規程をAIが覚えて、労務の疑問に自社の前提で即答。汎用AIのように毎回前提を説明する必要がありません。中小企業の総務・経営者向けの労務AIです。',
    images: ['https://banto-roumu.com/og-image.png'],
  },
}

// FAQ — 検索意図の長尾を本文で拾い、同内容を FAQPage 構造化データにも対にする。
//   Phase1 厳守: 就業規則の作成代行は不可・一般情報のみと明記。免責は答えに織り込む。
const FAQ = [
  {
    q: '料金はいくらですか',
    a: '予定価格は1社あたり月額¥3,980（Entryプラン）からです。EntryとStandardは会社単位の月額で、プランの上限人数（Entry 5名・Standard 20名）までは何人で使っても料金は変わりません。士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。現在は無料モニター期間のため、すべての機能を無料でご利用いただけます。',
  },
  {
    q: '無料で使えますか',
    a: '現在は無料モニター期間のため、会社の登録から相談・規程ドラフトの下書きまで、すべての機能を無料でご利用いただけます。二度目の相談が前回の続きから始まる体験も、そのままお試しいただけます。',
  },
  {
    q: '自社の労務データは安全に保管されますか',
    a: '企業ごとにデータを分離して保管する設計です。自社の規程や相談内容が他社と混ざることはありません。機密の労務データを預ける前提で設計しています。',
  },
  {
    q: '就業規則の作成代行を依頼できますか',
    a: '番頭が提供するのは一般的な情報提供と、自社の数値を入れた下書きの補助です。就業規則の作成代行や個別の法的助言ではありません。最終的な判断は、必要に応じて専門家にご確認ください。',
  },
  {
    q: '社労士資格との関係はどうなっていますか',
    a: '運営者は社会保険労務士試験に合格していますが、社会保険労務士会への登録は行っておらず、資格者としての個別相談・書類作成代行は提供していません。番頭は、自社の規程を覚えて一般的な情報を即答するツールであり、法的な最終判断が必要な場面では登録済みの専門家にご確認ください。',
  },
  {
    q: '社労士事務所でも使えますか',
    a: '士業プランで、複数の顧問先企業を切り替えて使えます。記憶とデータは企業ごとに分離され、顧問先ごとに覚えた前提で、切り替えてすぐ相談を続けられます。料金は事務所の利用メンバー数に応じた席単位の課金です。',
  },
  {
    q: '専任の労務担当がいなくても使えますか',
    a: '中小企業の総務担当や経営者が、社内規程の管理や日々の労務管理の調べ物を減らす用途を想定しています。専任の労務担当がいなくても、自社の前提に合わせた答えを得られます。',
  },
]

// 機能4軸。「自社に合わせて」を繰り返さず、各軸がもたらす"成果"で差別化する。
const FEATURES = [
  {
    icon: Brain,
    title: '覚える',
    body:
      '会社のプロファイル（所定労働時間・休日・36協定の状況など）と相談データを蓄積。二度目からは話が早く、自社の状況に合わせた答えがすぐ返ります。',
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
    title: '前提説明の往復をなくす',
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
    title: '見逃しを減らす',
    body:
      '助成金や法改正を「自社が対象か」で整理。制度を自分で追い、判断する手間と取りこぼしを減らせます。',
  },
]

// 表示名・価格・主役(featured)・年額は lib/plans.ts（SSOT）から引く。LP固有の訴求コピー
// （tagline/features/badge）だけをここで持つ。これにより「価格・主役が LP と課金で
// 食い違う」事故を構造的に防ぐ（2026-06-29 Takeshi承認: Entryが主役・年額¥39,800）。
// 課金単位の確定表記（SSOT: docs/BANTO_BILLING_GATE.md §4・§5）:
//   Entry/Standard = 会社単位の月額（プランの上限人数まで追加料金なし）。
//   士業のみ席（シート）単位 = 事務所の利用メンバー数に応じて課金。
//   利用回数・上限人数は lib/plans.ts の実装値から直接埋め込む（表示と実装の乖離を構造的に防ぐ）。
const PLAN_COPY = [
  {
    name: PLANS.starter.displayName,
    price: PLANS.starter.monthlyJpy.toLocaleString(),
    unit: `/月（1社あたり・${PLANS.starter.seatCap}名まで）`,
    yearly: PLANS.starter.yearlyJpy,
    tagline: 'まず使ってみる',
    badge: 'おすすめ',
    features: [
      '自社の規程・会社プロファイルの記憶',
      `AIチャット相談 1日${PLANS.starter.limits.chat}回まで`,
      `労務リスク・セルフ診断、規程ドラフトの下書き・レビュー 各1日${PLANS.starter.limits.risk_audit}回まで`,
      '助成金・法改正が自社に関係するかのチェック',
      `利用メンバー ${PLANS.starter.seatCap}名まで（追加料金なし）`,
    ],
    featured: PLANS.starter.featured,
  },
  {
    name: PLANS.standard.displayName,
    price: PLANS.standard.monthlyJpy.toLocaleString(),
    unit: `/月（1社あたり・${PLANS.standard.seatCap}名まで）`,
    yearly: PLANS.standard.yearlyJpy,
    tagline: 'チームでしっかり使う',
    badge: null,
    features: [
      'Entry のすべての機能',
      `AIチャット相談 1日${PLANS.standard.limits.chat}回まで（Entryの3倍）`,
      `診断・書類などの各機能も 1日${PLANS.standard.limits.risk_audit}回まで`,
      `利用メンバー ${PLANS.standard.seatCap}名まで（追加料金なし）`,
    ],
    featured: PLANS.standard.featured,
  },
  {
    name: PLANS.shigyo.displayName,
    price: PLANS.shigyo.monthlyJpy.toLocaleString(),
    unit: '/月（1席あたり）',
    yearly: PLANS.shigyo.yearlyJpy,
    tagline: '複数の顧問先を管理',
    badge: '士業向け',
    features: [
      `Standard のすべて（AIチャット相談 1日${PLANS.shigyo.limits.chat}回まで）`,
      '複数企業（顧問先）の切り替え',
      '企業ごとに記憶・データを分離',
      '顧問先ごとに覚えた前提で、切り替えてすぐ相談を続けられます',
      '席単位の課金。事務所の利用メンバー数に応じて席を追加',
    ],
    featured: PLANS.shigyo.featured,
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
        覚えているぶん、説明に使う時間が増えていきません。
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
        <span className="text-xs font-semibold text-neutral-700">労務リスク・セルフ診断</span>
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
            <TrackedCTA
              location="header"
              className={buttonClass({ variant: 'primary', size: 'sm' })}
            >
              無料で始める
            </TrackedCTA>
          </nav>
        </div>
      </header>

      {/* ===== 冒頭サマリー（GEO対策・2026-07-22追加） =====
          AI検索・要約エンジンが本文全体を読まずに1段落で製品を要約できるよう、
          ヒーロー(A/B変種スロット)より前に、常に同一の平文サマリーを静的描画する。
          文面は public/llms.txt の冒頭要約と一致させ、複数面での一貫性を保つ。
          A/B実験(HeroEyebrow/HeroHeadline/HeroSubcopy)には触れない・独立した帯。 */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <p className="text-center text-sm leading-relaxed text-neutral-600 sm:text-left">
            番頭(Banto)は、中小企業の総務・経営者向けの労務記憶AIです。就業規則・36協定・有給休暇管理などの自社規程をAIに覚えさせておき、労務の疑問に自社の前提で即答します。汎用AIのように、聞くたびに社内規程や過去の運用を説明し直す必要がありません。企業ごとにデータを分離して保管し、無料で試せます。
          </p>
        </div>
      </section>

      {/* ===== ヒーロー（above the fold） =====
          左：価値ステートメント1つ + 支える一行 + 主要CTA1つ
          右：製品の動きを示す様式化UIプレビュー（見て分かる） */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* 左：言葉 */}
          <div className="text-center lg:text-left">
            {/* アイブロー＝A/B第1実験の変種化スロット（HeroEyebrow）。
                A=役割ラベル / B=note読者の到着文脈(痛み)起点。詳細は _components/HeroCopy.tsx。 */}
            <HeroEyebrow />
            {/* 2026-07-11 CMO改稿: アイブロー=役割 / H1=最強フレーズ / 直下の段落=
                「覚えている」の説明、と役割を分けて同義反復を解消。意味単位の
                inline-block で語中改行を防ぐ。
                2026-07-13 CPO第2実験: H1本体を A/B 変種化スロット(HeroHeadline)へ。
                A=現行メタファーで完全据え置き / B=初見客向けの具体的価値提案。
                CTA・レイアウトは A/B 共通のまま。 */}
            <HeroHeadline />
            {/* H1直上サブコピー＝A/B第1実験の変種化スロット（HeroSubcopy）。 */}
            <HeroSubcopy />
            {/* 主CTA=デモ体験（登録不要）へページ内スクロール。冷たい初見客に
                会社登録を先に迫らず、まず数秒でアハに届ける。純粋な内部アンカー
                なので SSR/metadata は無傷。signup は下の従CTAに降格。 */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#demo"
                className={buttonClass({ variant: 'primary', size: 'lg' })}
              >
                サンプルで答え方を見てみる（登録不要）
                <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
              <TrackedCTA
                location="hero"
                className={buttonClass({ variant: 'ghost', size: 'lg' })}
              >
                会社を登録して始める
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TrackedCTA>
            </div>
            <p className="mt-3 text-center text-xs text-neutral-500 lg:text-left">
              サンプル会社で答え方を体験できます。登録は後からで大丈夫です。
            </p>
          </div>

          {/* 右：見て分かる */}
          <div className="lg:pl-4">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ===== 体験デモ（FV直下：初見客が数秒でアハに届く導線） =====
          ヒーロー主CTA「まず無料で試す（登録不要）」の着地点。scroll-mt でスティッキー
          ヘッダ(h-16)ぶんのオフセットを確保。スクリプト型デモ＝本物のAPIは叩かず用意済み
          回答をタイプ表示するクライアントコンポーネント。デモ内の signup 転換CTA
          (location="trydemo")は維持。詳細は _components/TryDemo.tsx を参照。 */}
      <div id="demo" className="scroll-mt-20">
        <TryDemoLazy />
      </div>

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
                  '答えは一般論止まり',
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
                  '過去の相談を覚えていて、続きから話せる',
                  '自社の前提に沿った回答',
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

      {/* ===== micro-CV（LeadCapture）は一時非表示（2026-07-11 CMO判断） =====
          配布資料（就業規則の点検資料）が未完成のため、「受け取れる」と見せて
          直後に「準備中」と明かす構造ごと外した。一等地から不確実要素を消し、
          資料が完成したら _components/LeadCapture.tsx を再掲載する（コンポーネントは温存）。 */}

      {/* ===== 業務効率化（企業ニーズ起点：何がどれだけ楽になるか） ===== */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">業務効率化</p>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            AIへの前提説明・調べ物・下書きを肩代わり
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            機能を増やすためではなく、総務が毎回費やしていた時間を減らすために設計しています。
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
              覚える・答える・つくる・気づく
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              自社の前提を覚えた番頭が、4つの軸でチームの労務を日常から支えます。
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
            労務データは会社の機密です。番頭は「便利さ」より先に、『預けて大丈夫か』にまず答えます。
          </p>
        </div>
        {/* 会社ごとデータ分離の図解：RLSの安心を一目で */}
        <Card className="mb-8">
          <DataIsolationDiagram />
          <p className="mt-6 text-center text-sm leading-relaxed text-neutral-600">
            会社ごとに記憶もデータも分離。会社のデータは他社と混ざりません。
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
                自社のデータは、他社からは仕組みの上で見えない設計です。アクセスできるのは自社だけです（データベースの行レベルで分離しています）。
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
                やり取りは暗号化された通信（HTTPS/TLS）で守られます。データの保管も、暗号化に対応した管理されたクラウド基盤（Supabase）で行います。
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
                  社会保険労務士試験に合格した作り手が、自分の会社運営で実際に使うために開発しています。
                  現場で必要だったものを、そのまま形にしました。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <KeyRound className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">合わなければ、データを残さずやめられる</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  アカウント削除と同時に、お預かりしたデータはすべて削除します。
                  まず無料で試して、自社に合うかどうかでご判断ください。
                </p>
              </div>
            </div>
            {/* 名前の由来（作り手ストーリーの隣・1段落）。押し付けず、名前と製品の一致だけを静かに語る。 */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">名前は、商家の「番頭」から</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  かつての商家で、帳場のことをすべて覚えて主人を支えたのが番頭でした。
                  取引の経緯も、店ごとの決めごとも、聞けばすぐ答えが返ってくる。
                  会社のことを覚えて労務を支えるこのAIに、その名前を借りています。
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
                  <span className="text-sm text-neutral-500">{p.unit}</span>
                </p>
                {p.yearly && (
                  <p className="mt-1 text-xs text-neutral-500 tabular-nums">
                    年額 &yen;{p.yearly.toLocaleString()}（2ヶ月分お得）
                  </p>
                )}
                <ul className="mt-5 space-y-2.5">
                  {p.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
                <TrackedCTA
                  location={`pricing_${p.name}`}
                  className={buttonClass({
                    variant: p.featured ? 'primary' : 'secondary',
                    className: 'mt-6 w-full',
                  })}
                >
                  無料で試す
                </TrackedCTA>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
            EntryとStandardは1社あたりの月額です。プランの上限人数までは、何人で使っても料金は変わりません。
            士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。
          </p>
        </div>
      </section>

      {/* ===== よくある質問（FAQ）===== */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              よくある質問
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
              中小企業の総務・経営者からよく寄せられる質問をまとめました。
            </p>
          </div>
          <dl className="space-y-4">
            {FAQ.map(item => (
              <div
                key={item.q}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <dt className="text-base font-semibold text-neutral-900">
                  {item.q}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ===== 構造化データ（rich results 適格化）=====
          FAQPage は上の可視FAQと対。Organization=Kizuna Creation。
          BreadcrumbList=トップ > 番頭（業務効率化）。aggregateRating は捏造しない。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map(item => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Kizuna Creation',
            url: 'https://banto-roumu.com/business',
            logo: 'https://banto-roumu.com/og-image.png',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'トップ',
                item: 'https://banto-roumu.com/business',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: '番頭（会社を覚える労務AI）',
                item: 'https://banto-roumu.com/business',
              },
            ],
          }),
        }}
      />

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
            会社を登録して、最初の相談を投げてみてください。今日話したことを、番頭は明日も覚えています。
          </p>
          <div className="mt-7 flex justify-center">
            <TrackedCTA
              location="final"
              className={buttonClass({
                variant: 'secondary',
                size: 'lg',
              })}
            >
              無料で会社を登録して試す
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
        </Card>
      </section>

      {/* ===== 検索意図別の使い方（関連LPへの内部リンク・クラスタ） ===== */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-400">
          目的別の使い方を見る
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {USECASE_LIST.map((u) => (
            <Link
              key={u.slug}
              href={`/roumu/${u.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {u.ogCategory}
            </Link>
          ))}
          <Link
            href="/roumu"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300"
          >
            使い方の一覧を見る
          </Link>
        </div>
      </section>

      {/* ===== 無料セルフ点検ツールへの内部リンク（クラスタ・ハブへ接続） =====
          /tools 一覧（ハブ）と各ツールへ /business から直接リンクし、
          クロール経路を確立する（未インデックスの /tools/* を拾わせる）。 */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <p className="mb-1 text-center text-xs font-medium text-neutral-400">
          自社の数字で確かめる無料ツール
        </p>
        <p className="mb-4 text-center text-xs text-neutral-400">
          登録不要・会社データは保存しません
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {TOOL_LIST.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            >
              {t.label}
            </Link>
          ))}
          <Link
            href="/tools"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300"
          >
            ツール一覧を見る
          </Link>
        </div>
      </section>

      {/* ===== ブログ・FAQへの内部リンク（2026-07-22追加・/blog /faq クラスタへ接続） ===== */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/blog"
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300"
          >
            規程管理・組織の記憶ブログを読む
          </Link>
          <Link
            href="/faq"
            className="rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            よくある質問を見る
          </Link>
        </div>
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
              <Link href="/blog" className="hover:text-brand-700">
                ブログ
              </Link>
              <Link href="/faq" className="hover:text-brand-700">
                よくある質問
              </Link>
              <Link href="/login?next=/company" className="hover:text-brand-700">
                ログイン
              </Link>
              <TrackedCTA location="footer" className="hover:text-brand-700">
                無料で始める
              </TrackedCTA>
              <Link href="/terms" className="hover:text-brand-700">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-brand-700">
                プライバシー
              </Link>
              <Link href="/tokushoho" className="hover:text-brand-700">
                特定商取引法に基づく表記
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            番頭(Banto) が提供する情報は一般的な情報提供であり、個別の法的助言や書類作成代行ではありません。
            最終的な判断は、必要に応じて専門家にご確認ください。
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            © {new Date().getFullYear()} 番頭(Banto)（Kizuna Creation）
          </p>
        </div>
      </footer>
    </div>
  )
}
