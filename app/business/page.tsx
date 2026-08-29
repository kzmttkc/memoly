import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { MessageSquareText, FileText, ShieldCheck, Lock, BadgeCheck, ArrowRight, Check, X, Building2, Sparkles, Database, KeyRound, Trash2, ChevronDown, UserCog, Copy, ClipboardList, Globe } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Disclosure } from '@/components/ui/Disclosure'
import TryDemoLazy from './_components/TryDemoLazy'
import { TrackedCTA } from './_components/TrackedCTA'
import { HeroEyebrow, HeroHeadline, HeroSubcopy } from './_components/HeroCopy'
import { HeaderCta } from './_components/HeaderCta'
import { MobileNav } from './_components/MobileNav'
import IndustryHeroPreview from './_components/IndustryHeroPreview'
import CompareToggle from './_components/CompareToggle'
import ScenarioSection from './_components/ScenarioSection'
import ScrollProgress from './_components/ScrollProgress'
import BackToTop from '@/components/ui/BackToTop'
import ForcePaidVariant from './_components/ForcePaidVariant'
import LeadCapture from './_components/LeadCapture'
import { VARIANT_HEADER, type LpVariant } from './_lib/variant-shared'
import { JARGON_TERMS } from '@/lib/faq'
import { PLANS, billingEnabled } from '@/lib/plans'
import { PLAN_COPY, PLAN_FILE_FIRST } from '@/app/pricing/_lib/plan-copy'
import { USECASE_LIST } from '@/lib/usecase'
import { TOOL_LIST } from '@/lib/tools'
import { PublicFooter } from '@/components/ui/PublicFooter'

// ============================================================================
// /business — 就業規則AI 公開ランディングページ（認証不要・公開ルート）
//   ルート app/layout.tsx の <body> は消費者Memoly向けにダーク強制
//   (bg-gray-950 text-gray-100)。本ページはBtoB労務向けライト基調が要件のため、
//   最外要素に .company-light（globals.css 定義のライト再マップ + 白背景）を当てて
//   ダーク body を上書きする。/company 配下と同じ手法。middleware の
//   PROTECTED_PREFIXES は /chat /memory /company のみで /business は含まれない＝公開。
//
//   設計方針（2026-06-27 CMO 改稿）:
//     - 核の主張「汎用AIは毎回説明が要る／就業規則AIは覚えている」は1回だけ強く言う。
//       各機能は「自社に合わせて」を連呼せず、もたらす成果で差別化する
//       （覚える=記憶の蓄積 / 答える=調べ物ゼロで即答 / つくる=下書きが数分 /
//        気づく=見逃し防止）。
//     - 企業の焦点は業務効率化。就業規則AIは"便利"でなく総務1人分の説明・調べ物・
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
  title: '就業規則AI｜就業規則のファイルを置くと、ずれが1枚になります',
  description:
    '就業規則のPDF・Wordを置くと、書いてあることと書いてないことが1枚になります。登録はそのあとです。中小企業の総務・経営者向けです。',
  // 2026-07-30 PMF修理#3: 日英の対応関係(hreflang)がサイト全体で0件だった。
  //   英語版 /business/en は本文・titleとも英語で配信されているのに、日本語版との
  //   関係を検索エンジンに一切伝えていない＝英語圏の検索結果に出る根拠が無い状態。
  //   languages を宣言すると Next が <link rel="alternate" hreflang="..."> を出力する。
  alternates: {
    canonical: '/business',
    languages: {
      ja: '/business',
      en: '/business/en',
      'x-default': '/business',
    },
  },
  openGraph: {
    title: '就業規則AI｜就業規則のファイルを置くと、ずれが1枚になります',
    description:
      '就業規則のPDF・Wordを置くと、書いてあることと書いてないことが1枚になります。登録はそのあとです。中小企業の総務・経営者向けです。',
    url: 'https://banto-roumu.com/business',
    siteName: '就業規則AI',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: 'https://banto-roumu.com/og-banto-main.png',
        width: 1200,
        height: 630,
        alt: '就業規則AI｜就業規則のファイルを置く',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '就業規則AI｜就業規則のファイルを置くと、ずれが1枚になります',
    description:
      '就業規則のPDF・Wordを置くと、書いてあることと書いてないことが1枚になります。登録はそのあとです。中小企業の総務・経営者向けです。',
    images: ['https://banto-roumu.com/og-banto-main.png'],
  },
}

// FAQ — 検索意図の長尾を本文で拾い、同内容を FAQPage 構造化データにも対にする。
//   Phase1 厳守: 就業規則の作成代行は不可・一般情報のみと明記。免責は答えに織り込む。
const FAQ = [
  {
    q: '料金はいくらですか',
    a: '月額料金は1社あたり¥3,980（Entryプラン）からです。EntryとStandardは会社単位の月額で、プランの上限人数（Entry 5名・Standard 20名）までは何人で使っても料金は変わりません。士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。年払い（Entryのみ）は¥39,800/年で、月払い2ヶ月分お得になります。登録するとまず無料プランでお使いいただけ、有料プランへの切り替えはご自身の操作で申し込んだときのみ課金されます。',
  },
  {
    q: '無料で使えますか',
    a: '会社の登録と、相談・規程ドラフトの下書きは無料プランの範囲でお試しいただけます（1日あたりの利用回数に上限があります）。二度目の相談が前回の続きから始まる体験もそのままご確認いただけます。より多く使いたくなったときは、有料プラン（Entry ¥3,980/月〜）にいつでも切り替えられます。',
  },
  {
    q: '自社の労務データは安全に保管されますか',
    a: '企業ごとにデータを分離して保管する設計です。自社の規程や相談内容が他社と混ざることはありません。機密の労務データを預ける前提で設計しています。',
  },
  {
    q: '就業規則の作成代行を依頼できますか',
    a: '就業規則AIが提供するのは一般的な情報提供と、自社の数値を入れた下書きの補助です。就業規則の作成代行や個別の法的助言ではありません。最終的な判断は、必要に応じて専門家にご確認ください。',
  },
  {
    q: '就業規則のファイルを置けますか',
    a: '登録の前に、PDF・Word（.docx）・テキストを置けます。ファイルが無いときは、入口で本文を貼れます。スキャン画像など本文が取れないページは未読として残します。ずれの1枚のあとで登録し、相談では自社の条文を引いて答えます。',
  },
  {
    q: 'SmartHRやfreeeなど既存のツールを使っています。乗り換えや全項目の入れ直しが必要ですか',
    a: '就業規則AIは既存の手続きシステムを置き換えるものではなく、併用を前提にしています。SmartHR・freee・オフィスステーションなどは手続き・データ管理を、就業規則AIは自社ルールの相談を担う役割分担です。従業員情報や規程のすべてを入れ直す必要はありません。就業規則のファイルを置けば、その1枚を前提に相談できます。',
  },
  {
    // 2026-07-28 CTO修正（L2監査#3）: 顧問先の登録上限（50社）が非公開で、
    // 検討者（士業）が実際の運用可否を判断できなかった（ペルソナ2・10で独立に指摘）。
    q: '社労士事務所でも使えますか',
    // 2026-07-29 CTO修正（UX監査Round5#4・軽）: 顧問先の社数上限（50社）は開示済みだったが、
    // 事務所の利用メンバー数（席）自体の上限（50席・lib/plans.ts shigyo.seatCap）が
    // /tokushoho にしか記載されておらず、料金の全体像を判断できなかった（Round5指摘）。
    a: `士業プランで、複数の顧問先企業を切り替えて使えます（顧問先は最大${PLANS.shigyo.maxCompanies}社まで登録できます）。書類とデータは企業ごとに分離され、顧問先ごとに残した規程で、切り替えて相談できます。料金は事務所の利用メンバー数に応じた席単位の課金で、これとは別に席数の上限が事務所あたり最大${PLANS.shigyo.seatCap}席あります（顧問先数と席数は別々の上限です）。`,
  },
  {
    // 2026-07-28 CTO修正（L2監査#2）: 複数店舗・複数拠点の運用方法がLP/FAQの
    // どこにも説明されておらず、小売5店舗のエリアマネージャーが離脱していた
    // （構造課題として確定）。
    q: '複数の店舗・拠点があります。1つの契約でまとめて使えますか',
    a: 'まとめて使えます。EntryとStandardは1社（1契約）の中で、店舗名を添えて要点を登録すれば、店舗ごとに違う勤務条件やシフトを踏まえた回答になります。就業規則や36協定が店舗（事業場）ごとに全く別に存在し、記憶そのものを完全に分けて管理したい場合は、士業プランの複数会社管理機能（社会保険労務士資格は不要です）を使うと、店舗ごとに独立した記憶を切り替えて使えます。',
  },
  {
    // 2026-07-28 CTO修正（L1監査#5）: 士業プランの案内が社労士事務所のみに読め、
    // 複数クライアントの労務まわりを扱うフリーランスのバックオフィス代行者が
    // 「自分が申し込んでよいか」を判断できなかった（ペルソナ9）。資格の有無ではなく
    // 「複数社を切り替えて使うか」で選べることを明記する。
    // 2026-07-28 追記（L2監査#3）: 顧問先の登録上限（50社）を開示する。
    q: '社労士資格がなくても、複数のクライアント企業を1つの契約で管理できますか',
    // 2026-07-29 CTO修正（UX監査Round5#4・軽）: 席数の上限（50席）をあわせて開示する。
    a: `できます。士業プランは社会保険労務士に限定していません。記帳代行・バックオフィス代行など、複数のクライアント企業の労務まわりを切り替えて管理したい方であればご利用いただけます。会社ごとに記憶とデータが分離されるため、クライアントの情報が混ざる心配はありません（顧問先は最大${PLANS.shigyo.maxCompanies}社まで登録できます）。料金は事務所・ご自身の利用メンバー数に応じた席単位の課金で、これとは別に席数の上限が事務所あたり最大${PLANS.shigyo.seatCap}席あります（顧問先数と席数は別々の上限です）。`,
  },
  {
    q: '専任の労務担当がいなくても使えますか',
    a: '中小企業の総務担当や経営者が、社内規程の管理や日々の労務管理の調べ物を減らす用途を想定しています。専任の労務担当がいなくても、自社の前提に合わせた答えを得られます。',
  },
]

// 「今日やることは、3つだけ」セクション（下部・オンボーディング手順）と
//   HowTo構造化データで共用するSSOT（2026-08-09 SEO/AEO監査で追加。可視本文と
//   JSON-LDの内容を必ず一致させる＝他の構造化データと同じ方針）。
const ONBOARDING_STEPS = [
  { step: '1', title: '就業規則のファイルを置く', body: 'PDF・Word・テキストを置きます。登録の前に、ずれが1枚になります。' },
  { step: '2', title: '1枚を確認する', body: '書いてあることと書いてないことが並びます。この画面で保存もできます。' },
  { step: '3', title: '残すときに登録する', body: '会社の書類に残すときだけ、メールで登録します。チャットはまだ開きません。' },
]

// 専門用語の簡潔な補足（2026-07-29 CTO・L3監査#7）: FAQ・体験デモ・比較表などの
//   本文中に前提知識として出てくる労務用語を、初めて読む方（学生インターン等）
//   向けに1箇所にまとめて簡潔に補足する。個々の本文（FAQ回答・デモの回答文言）は
//   Phase1レビュー済みの言い回しのため書き換えず、独立した用語集として追加する。
// 2026-07-29 CTO修正（UX監査Round4#9）: lib/faq.ts の JARGON_TERMS（SSOT）へ移設。
//   /faq 独立ページとの複製配置のため、このページ側は再エクスポートせずimportで参照する。
const JARGON = JARGON_TERMS

// 機能4軸（2026-07-23 B01+I01: 旧「業務効率化」4カードと旧「機能」4カードを
// 1セクション4カードへ統合し、中盤を約50%短縮。各カードは「機能名＝何をするか」と
// 「肩代わりする手間＝何が減るか」を1枚で言い切る）。
const FEATURES = [
  {
    icon: BantoMark,
    title: '1枚にする',
    body:
      '就業規則のPDF・Word（.docx）・テキストを置くと、書いてあることと書いてないことが1枚になります。スキャン画像など本文が取れないページは未読として残します。残す操作のあと、相談では自社の条文を引いて答えます。',
  },
  {
    icon: MessageSquareText,
    title: '答える',
    body:
      '労務の疑問をそのまま投げるだけで、法令と自社の規程に当てて即答。総務が条文やサイトを探し回る調べ物の時間を減らせます。',
  },
  {
    icon: FileText,
    title: 'つくる',
    body:
      '就業規則や36協定のドラフトを、自社の数値が入った状態で下書き。ゼロから書く時間も、専門家へ依頼する前の準備時間も圧縮できます。',
  },
  {
    icon: ShieldCheck,
    title: '気づく',
    body:
      '労務リスクをスコアで可視化し、助成金や法改正を「自社が対象か」で整理。制度を自分で追いかける手間と見逃しを減らせます。',
  },
]

// Before/After の具体シーン（2026-07-23 B04）。「貼り付け回数」「調べ物の分数」を
// 場面で見せる。数字はあくまで作業イメージの例示であり、効果の保証値ではない
// （直下のキャプションで明示する）。
const BEFORE_SCENES = [
  '同じ就業規則を、今週も3回チャットに貼り付けて前提を説明',
  '残業上限の調べ物で、条文と解説サイトを行き来して25分',
  '前回どう判断したか、過去のチャット履歴を10分さかのぼる',
]
const AFTER_SCENES = [
  'ファイルを一度置けば、同じ規程を何度も貼らない',
  '「来週、残業できる？」と聞くだけで、自社前提の答え',
  '前回の判断は、1枚のあとの続きから話せる',
]

// 比較表（2026-07-23 B18）。「正直な土俵」原則:
//   - 相手の強み（手続きの電子化・帳票・汎用性）は強みとして明記する。
//   - 就業規則AIの弱み（電子申請・給与計算は非対応）も同じ表の中で明記する。
//   - 各社の記載は2026年7月時点の公開情報にもとづく一般的な整理に留め、
//     優劣の断定・誹謗・優良誤認になりうる表現（「〜はできない」等の断定）を避ける。
//   - 出所と「併用できる」事実は表の直下に注記する。
// 2026-07-24 P03(freee併用の比較検討者): 併用例示が SmartHR 固定で freee が名指し
//   されず、比較モードの確信が一拍遅れていた。freee人事労務（国内2大労務SaaSの一角）を
//   独立列として追加し、各社の得意分野も正直に認める（優劣の断定・誹謗・優良誤認は避ける）。
const COMPARISON_HEADERS = ['就業規則AI', 'SmartHR', 'freee人事労務', 'オフィスステーション', '汎用AIチャット']
const COMPARISON_ROWS: { label: string; cells: { text: string; strong?: boolean }[] }[] = [
  {
    label: '主な役割',
    cells: [
      { text: '就業規則のファイルからずれを1枚にし、そのあと自社前提で相談に答える', strong: true },
      { text: '人事・労務手続きの電子化と従業員データベース' },
      { text: '給与計算・勤怠・人事労務手続きと従業員データの管理' },
      { text: '労務手続き書類の作成・電子申請' },
      { text: '分野を問わない汎用のAIチャット' },
    ],
  },
  {
    label: '置いたファイルを前提にした回答',
    cells: [
      { text: '中心。ファイルの1枚と相談の経緯を残して回答', strong: true },
      { text: '主目的ではありません' },
      { text: '主目的ではありません' },
      { text: '主目的ではありません' },
      { text: '汎用の記憶機能はあるものの、規程や期限に特化した管理ではありません' },
    ],
  },
  // 導入までの時間（2026-07-23 W3.5d G-f）。就業規則AIは登録直後から相談でき初回回答
  // まで数分が目安（TTV設計はC03/C06で充足済みの事実）。他社は導入形態が会社ごとに
  // 異なるため「〜できない/〜かかる」の断定を避けた中立表現に留める（正直な土俵）。
  // ※「データ分離」行は競合のセキュリティ体制を当社が断定できず優良誤認リスクの
  //   ため追加しない（2026-07-23 CTO裁定・自社セキュリティ節で語る）。
  {
    label: '導入までの時間',
    cells: [
      { text: 'ファイルを置くと数分で1枚。登録はそのあとです', strong: true },
      { text: '初期設定・従業員情報の登録を経て利用を開始する流れです（会社の規模により異なります）' },
      { text: '初期設定・従業員情報の登録を経て利用を開始する流れです（会社の規模により異なります）' },
      { text: '初期設定を経て利用を開始する流れです（会社の規模により異なります）' },
      { text: 'すぐに使い始められます（自社の前提の説明は毎回必要です）', strong: true },
    ],
  },
  {
    label: '手続きの電子申請・給与関連',
    cells: [
      { text: '対応していません（書類の下書き支援まで）' },
      { text: '得意分野です', strong: true },
      { text: '得意分野です', strong: true },
      { text: '得意分野です', strong: true },
      { text: '対応していません' },
    ],
  },
  {
    label: '日々の労務の調べ物',
    cells: [
      { text: '自社の前提に沿って即答', strong: true },
      { text: '手続き・データ管理が中心です' },
      { text: '手続き・給与計算が中心です' },
      { text: '手続き・帳票が中心です' },
      { text: '一般論として回答（会社の前提説明が毎回必要）' },
    ],
  },
]

// 料金カードの訴求コピーは /pricing と共有する（2026-07-30 PMF修理#1で
// app/pricing/_lib/plan-copy.ts へ移設。金額・席数は従来どおり lib/plans.ts が正本）。

// ---------------------------------------------------------------------------
// DataIsolationDiagram — 「会社ごとにデータが分離される」をコードだけで図解。
//   中央に就業規則AIマーク。周囲に自社A/B/Cの独立した箱（各に錠前）。箱は点線で
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

      {/* 中央：就業規則AIマーク（接続線は引かず、独立を強調） */}
      <div className="flex justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
          <BantoMark className="h-6 w-6" />
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

// 広告経由と判定する utm_medium の値（I11）。低カーディナリティな既知値のみ。
const PAID_MEDIA = ['paid', 'cpc', 'ppc', 'paid_social', 'paidsocial', 'display', 'ads', 'sem']

export default async function BusinessLandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // A/B 変種は middleware が cookie で確定し、内部ヘッダで渡してくる（A02: SSR段階で
  // 変種を焼き込む。従来の「SSR常にA・Bはhydration後差し替え」の計測バイアスを解消）。
  // headers() を読むためこのルートは動的レンダリングになる（Vercel上でSSR）。
  // ヘッダ欠落時（middleware未経由の万一）は A にフォールバック＝安全側。
  //
  // 2026-07-23 I11: 広告着地（utm_medium=paid/cpc等・広告クリックIDあり）は
  // H1変種を勝者候補の B に固定する。middleware には触れない（作業境界）ため、
  // ここで searchParams から判定して SSR 描画を上書きし、cookie/計測の同期は
  // ForcePaidVariant（クライアント）が行う。オーガニック来訪の70/30配信は不変。
  const [h, sp] = await Promise.all([headers(), searchParams])
  const hv = h.get(VARIANT_HEADER)
  const mediumRaw = sp.utm_medium
  const medium = (typeof mediumRaw === 'string' ? mediumRaw : '').toLowerCase()
  const isPaidLanding =
    PAID_MEDIA.includes(medium) || 'gclid' in sp || 'msclkid' in sp || 'yclid' in sp
  const variant: LpVariant = isPaidLanding ? 'B' : hv === 'B' ? 'B' : 'A'
  // 2026-07-29 CTO修正（L3監査#6）: 料金セクションの課金状況文言を、特商法ページ
  //   (/tokushoho) と同じ billingEnabled() から導出する（詳細は同ページの同日コメント参照）。
  const paidSignupOpen = billingEnabled()
  return (
    <div className="company-light min-h-[100dvh] bg-white font-sans text-neutral-900">
      {/* B19: 読了位置プログレスバー（装飾・compositor安全） */}
      <ScrollProgress />
      {/* 2026-08-11 UI監査#2: 375pxで21,296px（約26画面分）ある長尺LPの戻る手段。
          一定量スクロールしてから出現し、prefers-reduced-motion を尊重する。 */}
      <BackToTop />
      {/* I11: 広告着地時のみ、cookie/計測の変種を SSR 表示（B固定）と同期 */}
      {isPaidLanding && <ForcePaidVariant />}
      {/* ===== ヘッダ ===== */}
      {/* 2026-08-19 UXペルソナ監査 I-3: 独自ヘッダを維持する理由を確認した（2026-08-12
          コミット e27705b の記述）——このヘッダはページ内アンカー・EN切替・ハンバーガー
          （ページ内目次を含む）・A12動的CTAという単一ページ専用要素を5つ持つため、
          PublicHeaderへの統合は見送られている。5機能を壊さないためリンク構成・
          表示条件（sm:hidden等）には触れず、見た目の差異のうち安全なものだけ揃える:
          背景の不透明度を PublicHeader と同じ bg-white/80 に統一（従来 /90）。
          高さ(min-h-16)は200%ズーム対応の意図的な設計（2026-07-29 CTO修正）のため維持。
          モバイルでの「料金」非表示は、同じくモバイル唯一のナビ入口であるハンバーガーの
          ページ内目次（#pricing）から既に到達可能（2026-07-28 L1監査#5）なので機能追加はしない。 */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
        {/* 2026-07-29 CTO修正（L3監査#4・200%ズーム対応）: この行が固定高さ h-16 だと、
            極端に狭い実効幅で右側nav（flex-wrap）が2行に折り返したとき、はみ出した
            2行目がボックスの外側（＝直下のサブナビ帯＝冒頭サマリー欄）に重なって見えた
            （近藤氏・ペルソナ4が200%ズームで再現）。h-16 を min-h-16 に変え、折り返しが
            発生したときはヘッダ自体の高さが伸びて後続セクションを押し下げる（＝重ならない）
            ようにする。通常倍率では1行に収まるため見た目は不変。 */}
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-x-2 px-6 py-2">
          {/* 2026-08-11 UI監査#5: ロゴ寸法を PublicHeader / 他ページ（h-6 w-6 rounded-md +
              text-base）と統一（本ページだけ h-7/text-lg で揺れていた）。
              2026-08-11 UI監査#1: 副題「就業規則AI」は sm 未満で畳む（PublicHeaderの「(就業規則AI)」を
              畳む既存作法と同じ）。375px でナビが2行に折り返しヘッダが113pxを常時占有して
              いたため、ロゴ側を縮めて1行に収める（文言・リンクは不変）。 */}
          {/* 2026-08-11 UI監査#2: id="page-top" は BackToTop がクリック後にフォーカスを
              戻す先（キーボード利用者のタブ順をページ先頭へ連れ戻す）。文言・リンク不変。 */}
          <Link
            id="page-top"
            href="/business"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white">
              <BantoMark className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight text-neutral-900">
              就業規則AI
            </span>
          </Link>
          {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: 極端に狭い実効幅（高倍率
              ズーム時）でナビ項目(ハンバーガー/ログイン/CTA)が1行に収まりきらず、
              ページ全体の横スクロールに寄与していた。flex-wrap で折り返し可能にする
              （通常倍率では1行に収まるため見た目は不変）。 */}
          {/* 2026-08-11 UI監査#1: モバイルは gap-1 に詰めて1行維持（sm以上は従来の gap-2）。
              flex-wrap 自体は200%ズーム安全網として残す。 */}
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            {/* 2026-07-24 P02(発見性): モバイル(sm未満)はデスクトップの
                無料ツール/労務記事リンクが hidden sm:inline-flex で畳まれ、ヘッダから
                主要導線へ届かなかった。ハンバーガーでその2導線だけを補う（sm以上では
                自身が hidden＝デスクトップ導線を壊さない）。 */}
            <MobileNav />
            {/* 2026-07-24 L1(発見性): 無料ツール・労務記事への上部導線。従来はページ
                最下部にしか無く、モバイル客・記事目的の来訪者が辿れなかった。
                ヘッダは狭いモバイルでは畳み、モバイルは上記ハンバーガーとFV圏内の
                別導線（下記ヒーロー内リンク行）で担保する。内部Linkのみ。 */}
            <Link
              href="/tools"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              無料ツール
            </Link>
            <Link
              href="/roumu"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              労務の記事
            </Link>
            {/* 2026-07-28 CTO修正（L1監査#5）: ヘッダから料金への直接導線が無く、
                料金を比較検討したい来訪者（複数クライアント運用者等）が本文末尾まで
                スクロールしないと料金に辿り着けなかった。ページ内アンカー(#pricing)で
                即到達させる（専用ページの新設は本文と二重管理になるため見送り）。 */}
            <Link
              href="/offer"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              無料と有料
            </Link>
            <Link
              href="#pricing"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              料金
            </Link>
            {/* 2026-07-28 CTO修正（L1監査#3）: EN/JPトグル。英語ネイティブ来訪者向けの
                要約LP(/business/en)への導線。ヒーロー下の"Ask in English"の1文だけでは
                発見されにくく、ヘッダに常設する（デスクトップのみ・モバイルは
                MobileNavから辿れるツール/記事導線を優先しここでは省略）。 */}
            <Link
              href="/business/en"
              className={buttonClass({ variant: 'ghost', size: 'sm', className: 'hidden sm:inline-flex' })}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden />
              EN
            </Link>
            <Link
              href="/login?next=/company"
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              ログイン
            </Link>
            {/* 主CTAは最後まで「無料で始める」。スクロールで文言を変えない。 */}
            {/* 2026-07-28 CTO修正（L1監査#2）: whitespace-normal で極端に狭い実効幅でも
                折り返せるようにする（通常倍率では1行に収まるため見た目は不変）。 */}
            <HeaderCta className={buttonClass({ variant: 'primary', size: 'sm', className: 'whitespace-normal text-center' })} />
          </nav>
        </div>
      </header>

      {/* ===== 冒頭サマリー（GEO対策・2026-07-22追加 / 2026-07-23 A03で折りたたみ化） =====
          AI検索・要約エンジンが本文全体を読まずに1段落で製品を要約できるよう、
          ヒーロー(A/B変種スロット)より前に、常に同一の平文サマリーを保持する。
          文面は public/llms.txt の冒頭要約と一致させ、複数面での一貫性を保つ。
          A03: 人間の初見客には帯がFVを圧迫しH1到達を遅らせるため折りたたむ。
          本文テキストは閉じていても DOM 上に常に存在するため、クローラ・
          要約エンジンは従来どおり全文を読める（GEO効果は維持）。
          2026-07-29 CTO修正（UX監査Round6#1）: ネイティブ<details>から
          Disclosureコンポーネントへ統一（詳細は同コンポーネントのコメント参照）。 */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-2.5">
          {/* 2026-08-11 UI監査#6: このDisclosureだけ開閉インジケータ（chevron）が無く、
              開けることに気づけなかった。他のDisclosureと同じChevronDownを付ける。 */}
          <Disclosure
            className="group"
            summaryClassName="flex w-full cursor-pointer select-none items-center justify-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-700 sm:justify-start"
            summary={
              <>
                就業規則AIとは — 製品の概要
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </>
            }
          >
            <p className="mt-2 pb-1 text-center text-sm leading-relaxed text-neutral-600 sm:text-left">
              就業規則AIは、中小企業の総務・経営者向けに、就業規則のファイルからずれを1枚にするサービスです。登録はそのあとです。相談では、置いたファイルの前提で答えます。企業ごとにデータを分離して保管します。
            </p>
          </Disclosure>
        </div>
      </section>

      {/* ===== ヒーロー（above the fold） =====
          左：価値ステートメント1つ + 支える一行 + 主要CTA1つ
          右：製品の動きを示す様式化UIプレビュー（見て分かる）
          2026-07-23 A01: モバイル縦積みで製品プレビューがCTAより後ろ＝FV外に
          落ちていた。コピー/プレビュー/CTAを3ブロックに分け、モバイルの自然順を
          「H1 → プレビュー → CTA」に変更。lg では従来どおり左=言葉・右=プレビュー
          （プレビューを row-span-2 で右列に固定）。 */}
      {/* 2026-07-30 UX監査 #4/#5: 上下パディングを詰める（1440x900 実測で主CTAが
          y=920〜970＝フォールドの20px下に落ちていた／375x812 変種Aでは主CTAが
          top=763 で固定Cookieバナー(top=765)に完全に隠れていた）。 */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-10">
        {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: grid の暗黙トラックは
            既定で子要素の min-content 幅を下限にする。H1見出しは「語中改行を防ぐ」ため
            各意味単位を inline-block(=改行不可の1ブロック)にしており、これが
            min-content 計算上「分割不可の1単語」として扱われ、極端に狭い実効幅
            （高倍率ズーム時）でも grid トラックがその幅ぶん縮まずページ全体が
            横スクロールする実害があった（実測: 375px幅で200%ズーム相当の実効幅では
            scrollWidth が clientWidth を超過）。各グリッド子要素に min-w-0 を付け、
            トラックが利用可能幅まで縮む＝内部でテキストが折り返す（オーバーフローで
            隠れるのではなく見えたまま折り返す）ようにする。見た目は通常倍率で不変。 */}
        {/* 2026-07-30 UX監査 #4/#5: 従来は左列を「言葉(row1)」と「CTA(row2)」の2セルに
            割り、右列のプレビューを row-span-2 で跨がせていた。プレビューが約830px
            あるため、そのはみ出しぶんが両トラックへ分配され、**CTAだけが下へ押し出されて
            いた**（1440x900 実測 y=920〜970＝フォールド外。1440x760 では更に深い）。
            言葉とCTAを1つのグリッドセルにまとめ、lg では items-start で上詰めにする
            （モバイルの自然順「言葉 → CTA → プレビュー」は不変）。 */}
        <div className="grid items-start gap-y-8 lg:grid-cols-2 lg:gap-x-10">
          {/* 左列：言葉（ブランド行・アイブロー・H1・サブコピー）＋CTA */}
          <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
          <div className="text-center lg:text-left">
            {/* 2026-07-23 A10: ブランド名 BANTO をH1付近でヒーロー級に（テキストのみ。
                新ロゴ画像は承認待ちのため入れない。A/B共通・変種スロットの外）。 */}
            <p className="mb-4 flex items-baseline justify-center gap-2.5 lg:justify-start">
              <span className="text-xl font-extrabold tracking-[0.06em] text-brand-700">
                就業規則AI
              </span>
            </p>
            {/* アイブロー＝A/B変種スロット。A=役割ラベル / B=痛み起点フック。
                2026-07-23 A02: variant は middleware→page が SSR で確定して prop 渡し
                （従来の hydration 後差し替えを廃止）。詳細は _components/HeroCopy.tsx。 */}
            <HeroEyebrow variant={variant} />
            {/* 2026-07-11 CMO改稿: アイブロー=役割 / H1=最強フレーズ / 直下の段落=
                「覚えている」の説明、と役割を分けて同義反復を解消。意味単位の
                inline-block で語中改行を防ぐ。
                A=記憶メタファー / B=カテゴリ即解型（B を勝者候補として70%配信）。 */}
            <HeroHeadline variant={variant} />
            {/* H1直下サブコピー＝A/B変種スロット。 */}
            <HeroSubcopy variant={variant} />
          </div>

          {/* CTA。主ボタンは登録1つ。デモはページ内ジャンプ。 */}
          <div className="mt-8">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <TrackedCTA
                location="hero"
                href="/zure"
                className={buttonClass({ variant: 'primary', size: 'lg', className: 'whitespace-normal text-center' })}
              >
                ファイルを置く
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TrackedCTA>
            </div>
            {/* 2026-07-23 A06: リスクリバーサル1行。この登録不要デモ体験自体は
                会社登録前のセルフ点検ツールで課金と無関係。全削除可は削除自己サーブと整合する事実。 */}
            <p className="mt-3 text-center text-xs text-neutral-500 lg:text-left">
              登録の前に、就業規則のファイルを置けます。クレジットカードは不要です。
            </p>
            {/* 2026-07-24 L1(発見性): モバイルFV圏内に無料ツール・記事への明示リンク。
                ヘッダのツール/記事リンクはモバイルで畳むため、ここでFV内到達を担保する。
                目的に最も近い「登録不要の答え」（セルフ点検ツール）と、記事目的の来訪者の
                入口（労務の記事）を、離脱前に届ける。内部Linkのみ。 */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs lg:justify-start">
              <Link
                href="/tools"
                className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-700 hover:text-brand-800 sm:min-h-0"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                無料ツールでセルフ点検（登録不要）
              </Link>
              <Link
                href="/roumu"
                className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-700 hover:text-brand-800 sm:min-h-0"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                労務の記事を読む
              </Link>
            </div>
            {/* 2026-07-24 P03(比較検討者): 既存システムとの共存をFV圏内で1行示す。
                比較来訪者の第一の疑問（また全部入れ直すのか）は従来スクロール後の
                比較表でしか解けなかった。A/B変種スロット(HeroCopy)の外＝A/B共通で
                固定。文面は比較表・FAQ「SmartHR…」と同一の事実で、置き換え示唆や
                誇張はしない（Phase1コンプラ・敬体・強調記号なし）。
                2026-07-30 UX監査 #4/#5 でCTAの下へ移動（文面・リンクは不変）。 */}
            <p className="mx-auto mt-5 flex max-w-xl items-start justify-center gap-1.5 text-sm leading-relaxed text-neutral-500 lg:mx-0 lg:justify-start">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
              <span>
                SmartHR・freeeなどの既存システムはそのまま。就業規則のファイルを置く使い方を1つ足します。
              </span>
            </p>
            {/* 2026-07-24 P10(英語選好の外資HR): 就業規則AIのチャットは英語質問に英語で
                答える（実装済み・実証済み）が、入口が日本語のみでその価値が発見されず
                離脱する。UIシェルの全訳はせず、「英語で聞けば英語で答える」への控えめな
                誘導一行のみ。虚偽能力主張なし＝UI全体が英語対応と誤認させない範囲。 */}
            <p className="mx-auto mt-2 flex max-w-xl items-start justify-center gap-1.5 text-sm leading-relaxed text-neutral-500 lg:mx-0 lg:justify-start">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
              <span lang="en">Ask in English — 就業規則AI answers your labor questions in English.</span>
            </p>
          </div>
          </div>

          {/* 右列：見て分かる（モバイルではCTAの後・lgでは右列）
              2026-07-23 A14+B13+I01: 業種タブ付きプレビューへ置換（初期表示は
              従来と同じ製造業＝A/BのFV体験は不変。グロー装飾は撤去しフラット化）。
              2026-07-30 UX監査 A-1: モバイルでは order で CTA を先に出す。 */}
          <div className="order-2 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1 lg:pl-4">
            <IndustryHeroPreview />
          </div>
        </div>
      </section>

      {/* ===== 社会的証明バー（2026-07-23 A13） =====
          導入社数・体験談の捏造は絶対にしない（feedback_no_sockpuppet_authentic_content）。
          コード上の事実から導ける数字のみで構成する:
            - 書類ドラフト4種 = app/(app)/company/documents/page.tsx の DOCUMENT_TYPES
              （36協定・就業規則・賃金規程・労働条件通知書）。種類を増減したら
              ここの列挙も更新すること（クライアントページのためimport不可・手動同期）。
            - 無料セルフ点検ツール数 = lib/tools.ts TOOL_LIST から動的に埋め込み。
            - 「作り手が自分の会社で使う」= 下部・信頼シグナル節と同一の事実。 */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-3">
          {/* 2026-08-11 UI監査#2: 375pxで「就業規|則」のような語中改行が起きていた。
              語単位を whitespace-nowrap で括り、折り返しは語境界でのみ起こす（文言不変）。 */}
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-neutral-600">
            <FileText className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            <span className="whitespace-nowrap">就業規則・</span>
            {/* 2026-07-29 CTO修正（UX監査Round6#5・軽微）: 「36協定」の初出（ヒーロー
                直下のこの社会的証明バー）に用語解説へのtitle属性ツールチップを追加。
                2026-08-11 UI監査#1（a11y）: title属性はタッチ端末では表示されず（hoverが
                無い）、スクリーンリーダーへも確実には届かない＝解説が実質7割の来訪者に
                到達していなかった。同ページ下部に既にある用語集（#yougo・JARGON_TERMS＝
                title属性と全く同一の文言のSSOT）へのアンカーリンクへ置き換える。これなら
                全端末・全支援技術で確実に届き、解説文言も新規に書かない。リンク先の
                Disclosureはハッシュ一致で自動的に開く（components/ui/Disclosure.tsx）。 */}
            {/* 2026-08-19 UXペルソナ監査 I-2: 実測h:16px（44px未満）。この文字自体を
                44pxに広げると周囲の文中テキスト（就業規則・/・賃金規程・…）の行間を壊す
                （このpは既にflex-wrap gap-1.5で2行に折り返しており、視覚サイズはそのまま
                行送りに直結する）。見た目のサイズは変えず、::beforeで上下14px（=44px相当）の
                不可視ヒットエリアだけを広げる。左右は隣接する非リンクテキストの上へ
                わずかに広がるだけで、他の操作要素と重ならない（この段落内のリンクは
                これ1つのみ・実測で確認済み）。 */}
            <a
              href="#yougo"
              className="relative whitespace-nowrap rounded-sm underline decoration-dotted decoration-neutral-400 underline-offset-2 hover:decoration-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 before:absolute before:-top-3.5 before:-bottom-3.5 before:inset-x-0 before:content-['']"
            >
              36協定
              <span className="sr-only">の用語解説を読む</span>
            </a>
            <span className="whitespace-nowrap">・賃金規程・</span>
            <span className="whitespace-nowrap">労働条件通知書の下書きに対応</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-neutral-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            無料セルフ点検ツール{TOOL_LIST.length}種を公開中（登録不要）
          </p>
          <p className="flex items-center gap-1.5 text-xs text-neutral-600">
            <BadgeCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            作り手が自分の会社で実際に使いながら開発しています
          </p>
        </div>
      </section>

      {/* ===== 体験デモ（折りたたみ：第一面を短く保つ・2026-08-29 LP短縮） ===== */}
      <div id="demo" className="scroll-mt-20 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <details className="group rounded-2xl border border-neutral-200 bg-neutral-50 open:bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-center text-sm font-medium text-brand-700 underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
              サンプル会社で答え方を見る（任意・登録不要）
            </summary>
            <div className="border-t border-neutral-200">
              <TryDemoLazy />
            </div>
          </details>
          <p className="mt-4 text-center text-sm text-neutral-600">
            本筋はデモではなく、
            <a href="/zure" className="font-medium text-brand-700 underline underline-offset-2">
              就業規則のファイルを置く
            </a>
            ことです。
          </p>
        </div>
      </div>

      {/* ===== 導入シナリオ（B02/B03の器・2026-07-23 Takeshi裁定で骨組み先行実装） =====
          データ(_lib/scenarios.ts)が空の間は何も描画しない。実在顧客の声と誤認される
          表記は使わない（詳細は _components/ScenarioSection.tsx）。 */}
      <ScenarioSection />

      {/* ===== 核の主張：汎用AI vs 就業規則AI（ここで一度だけ強く言う） =====
          2026-07-23 B05: 静的な箇条書き2カードを、同じ質問への回答差をトグルで
          見せるインタラクティブ比較（CompareToggle）へ置換。主張でなく挙動で示す。 */}
      <section id="vs-ai" className="scroll-mt-20 border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              汎用AIとの違いは、同じファイルを何度も貼らないこと
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              同じ質問を、切り替えて比べてみてください。毎回前提を聞き返されるか、置いたファイルから答えが始まるかが違いです。
            </p>
          </div>
          <CompareToggle />
        </div>
      </section>

      {/* ===== micro-CV（LeadCapture）再掲載（2026-07-23 B06） =====
          配布資料「労務引き継ぎチェックシート」PDFが完成し /downloads/ で本番配信中の
          ため再掲載（2026-07-11の一時非表示は「資料未完成」が理由で、解消済み）。
          メール登録→その場でPDFダウンロードの軽い一歩。計測は既存語彙 lead_captured
          のみ（source='lead_magnet' / 'lead_magnet_download'）。 */}
      <LeadCapture />

      {/* ===== 機能と効率化（統合・2026-07-23 B01+I01+B04） =====
          旧「業務効率化」(4カード+概念バー)と旧「機能4軸」(4カード+スコアカード)の
          2セクションを1つに統合し、中盤を約50%短縮。冒頭に Before/After の具体
          シーン（貼り付け回数・調べ物の分数）を置き、抽象論の前に場面で見せる。 */}
      <section id="features" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            1枚にする・答える・つくる・気づく
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            就業規則AIの仕事はこの4つ。総務が毎回費やしていた説明・調べ物・下書きの時間を肩代わりします。
          </p>
        </div>

        {/* B04: Before/After を具体シーンで対比 */}
        <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-600">
              <MessageSquareText className="h-4 w-4" aria-hidden />
              いままで（汎用AIと自力の調べ物）
            </p>
            <ul className="mt-4 space-y-3">
              {BEFORE_SCENES.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-600">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-white p-5 ring-1 ring-brand-100 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <BantoMark className="h-4 w-4 text-brand-600" aria-hidden />
              就業規則AIにしてから
            </p>
            <ul className="mt-4 space-y-3">
              {AFTER_SCENES.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-800">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mb-10 text-center text-xs text-neutral-500">
          シーンは作業のイメージ例です。時間・回数は実測値や効果の保証ではありません。
        </p>

        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <Card key={f.title} interactive className="min-w-0 flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{f.body}</p>
                </div>
              </Card>
            )
          })}
        </div>

        {/* ===== 引き継ぎビュー（D15・2026-07-23 W3.5d） =====
            新節は作らず本節末尾に1ブロック追記（LP総高さ配慮・B01短縮と整合）。
            実装事実のみ: /company/memory の引き継ぎビュー(HandoverView)は確定した
            自社ルール・過去の判断・関係者ごとの状況・リスク要点を1画面に集約し、
            印刷とコピーに対応（PDF生成・外部送信はしない実装のため「PDF」とは
            書かない）。 */}
        <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                担当者が代わる日も、残した前提はそのまま
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                担当交代のときは「引き継ぎビュー」で、確定した自社ルール・過去の判断の経緯・関係者ごとの状況・労務リスクの要点を1画面にまとめて確認できます。
                印刷やコピーでそのまま引き継ぎ書として渡せるので、前任者の頭の中に頼らずに引き継げます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 社労士に渡すメモ（B20・2026-07-23） =====
          実機能: /company/reports の mode='sharoushi'（F5）。就業規則AIが覚えている
          基本情報・整備済みの規程・近い期限・会社で決めた運用に相談論点を添えて
          1枚のメモへ整理し、コピーして渡せる（app/(app)/company/reports/page.tsx・
          lib/report.ts で実装確認済み。実装されていない能力は書かない）。 */}
      <section id="handover" className="scroll-mt-20 border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <p className="mb-3 text-sm font-semibold tracking-wide text-brand-600">
                専門家との連携
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
                相談の続きは、「社労士に渡すメモ」で
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                就業規則AIは社労士の代わりではありません。個別の法的助言や届出の代行もしません。
                専門家への橋渡しまでを仕事にしています。
                置いたファイルと、残した期限・運用を1枚のメモに整理。コピーして、そのまま顧問社労士に渡せます。
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                論点から話を始められるので相談の往復が減ります。メモに載る数値や期限は、登録済みの内容だけにもとづきます。
              </p>
            </div>

            {/* 様式化プレビュー（コード描画のみ・画像なし） */}
            <div className="mx-auto w-full max-w-md">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-600 text-white">
                    <UserCog className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold text-neutral-700">
                    社労士に渡すメモ
                  </span>
                </div>
                <ul className="space-y-2.5 px-4 py-4">
                  {[
                    '会社の基本情報',
                    '整備済みの規程',
                    '近づいている期限',
                    '会社で決めた運用',
                    '相談したい論点',
                  ].map(row => (
                    <li key={row} className="flex items-center gap-2.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                      <span className="text-[13px] text-neutral-700">{row}</span>
                      <span
                        className="ml-auto block h-1.5 w-16 rounded-full bg-neutral-100"
                        aria-hidden
                      />
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1.5 border-t border-neutral-200 bg-neutral-50/70 px-4 py-2.5 text-[11px] text-neutral-600">
                  <Copy className="h-3 w-3" aria-hidden />
                  ワンクリックでコピーして、そのまま渡せます
                </p>
              </div>
            </div>
          </div>

          {/* ===== 士業の方へ（P2-2・2026-07-23 W3.5d） =====
              第2表#3裁定: 別LP(/business/pro)には分離せず、本節を拡充する。
              実装事実のみで書く: 士業プランは複数顧問先の切り替えに対応し、記憶と
              データは企業ごとに分離（lib/plans.ts shigyo・FAQ「社労士事務所でも
              使えますか」と同一の事実）。上のメモ訴求との接続=顧問先側がメモで
              論点を持ち込む世界を、受け手（士業）の視点から言い直す。 */}
          <div className="mt-10 rounded-2xl border border-brand-200 bg-white p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <UserCog className="h-4 w-4" aria-hidden />
                  士業の方へ — 顧問先ごとに、データが分かれます
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
                  士業プランでは複数の顧問先を切り替えて使え、会社ごとにデータが分離されます。
                  A社で置いた規程や経緯がB社の回答に混ざることはなく、切り替えた瞬間から、
                  その顧問先について残した規程で相談の続きを始められます。
                  顧問先が「社労士に渡すメモ」で論点を整理して持ち込めば、面談は前提の確認ではなく論点から始められます。
                </p>
              </div>
              {/* 2026-07-24 I3(士業導線): 汎用signupでなく士業文脈を持たせる。
                  会社作成ゲート本体は別班実装中のため、LP側は導線(plan=shigyo)と
                  コピーのみ。顧問先ごとに記憶が分かれる士業プラン前提を上のコピーで明示。 */}
              <TrackedCTA
                location="shigyo_section"
                href="/zure?plan=shigyo"
                className={buttonClass({
                  variant: 'secondary',
                  size: 'sm',
                  className: 'shrink-0 self-start whitespace-normal text-center sm:self-center',
                })}
              >
                士業として顧問先を登録
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TrackedCTA>
            </div>
          </div>
        </div>
      </section>

      {/* ===== セキュリティ・プライバシー（機密の労務データを預けて大丈夫か、に答える） ===== */}
      <section id="security-info" className="scroll-mt-20 mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            機密の労務データを、安心して預けられる設計
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            労務データは会社の機密です。就業規則AIは「便利さ」より先に、『預けて大丈夫か』にまず答えます。
          </p>
        </div>
        {/* 会社ごとデータ分離の図解：RLSの安心を一目で */}
        <Card className="mb-8">
          <DataIsolationDiagram />
          <p className="mt-6 text-center text-sm leading-relaxed text-neutral-600">
            会社ごとにデータも分離。会社のデータは他社と混ざりません。
          </p>
        </Card>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Card className="min-w-0 flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-900">会社ごとに完全分離</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                自社のデータは、他社からは仕組みの上で見えない設計です。アクセスできるのは自社だけです（データベースの行レベルで分離しています）。
              </p>
            </div>
          </Card>
          <Card className="min-w-0 flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-900">通信・保管の暗号化</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                やり取りは暗号化された通信（HTTPS/TLS）で守られます。データの保管も、暗号化に対応した管理されたクラウド基盤（Supabase）で行います。
                {/* 2026-08-12 UXペルソナ監査 R-3（離脱級・稟議ブロッカー）: この節が
                    保管先の所在国に一切触れておらず、/security と /privacy にだけ
                    「（米国）」と書かれていた。LPだけを見て稟議を通した担当者が、
                    後から越境移転を知って差し戻される。既に他ページに書いてある
                    事実をLPが落としているだけなので、事実をそのまま補う。 */}
                保管先の Supabase をはじめ、AI回答の生成・ホスティング・決済などの委託先は米国に所在します。
                移転先の一覧と、講じている保護措置は
                <Link href="/security" className="underline hover:text-brand-700">セキュリティとデータ保護</Link>
                に記載しています。
              </p>
            </div>
          </Card>
          <Card className="min-w-0 flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Database className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-900">AIの学習には使いません</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                {/* 2026-07-28 CTO修正（L2監査#9）: Anthropicのみの言及だと、実際に
                    データが送信されるOpenAI（記憶のベクトル検索）・Dify（法令照会）が
                    抜け落ちて見え、プライバシーポリシーの記載範囲より狭く見えていた
                    （ペルソナ4指摘）。整合させる。 */}
                入力した相談内容や自社データを、AIモデルの学習には使用しません
                （Anthropic・OpenAIの各APIは既定で入力を学習に用いません。法令照会には
                Difyも一部利用します）。連携先の詳細は
                <Link href="/privacy" className="underline hover:text-brand-700">プライバシーポリシー</Link>
                をご覧ください。
              </p>
            </div>
          </Card>
          <Card className="min-w-0 flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Trash2 className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-900">削除はあなたの権利</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                アカウント削除と同時に全データを削除します。開示・訂正・削除のご請求にも対応します。
              </p>
            </div>
          </Card>
        </div>
        {/* 2026-08-12 UXペルソナ監査 R-2（離脱級）: 最も説得力のある /security へのリンクが
            日本語の検討導線に0本だった（英語版LP app/business/en/page.tsx:294 にはある）。
            稟議担当が到達できるよう、セキュリティ節の直後に明示の導線を置く。 */}
        <div className="mt-8 text-center">
          <Link
            href="/security"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-neutral-300 px-5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            セキュリティとデータ保護の詳細を見る
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ===== 信頼シグナル（作り手の当事者性） =====
          2026-07-23 B16: 商家の帳場格子を思わせる縦縞をCSSだけで極薄に敷く
          （画像なし・藍系#243B6Eトーン・「名前は就業規則AIから」の物語と響き合う場所に限定）。 */}
      <section className="border-t border-neutral-200 bg-neutral-50 bg-[repeating-linear-gradient(90deg,rgba(36,59,110,0.03)_0,rgba(36,59,110,0.03)_1px,transparent_1px,transparent_32px)]">
        {/* 2026-08-11 UI監査: 本LPの他セクション（py-20 ×8）とリズムを揃える（唯一のpy-16だった）。 */}
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">作り手が自分の会社で使うために作った</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  作り手が、自分の会社運営で実際に使うために開発しています。
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
                {/* 2026-08-26 Kabau×番頭 1本化: 旧名の物語は捨てず、新名への引き継ぎとして残す */}
                <p className="font-semibold text-neutral-900">名前は、就業規則AI（かばう）</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  旧名の「番頭」は、かつての商家で帳場のことをすべて覚えて主人を支えた役から借りました。
                  会社のことを覚えて支える仕事はそのままに、いまの名前は就業規則AI。
                  カスハラ対応から日々の労務まで、会社と働く人をかばう、から取っています。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 比較表（B18・2026-07-23） =====
          「正直な土俵」: 相手の強みも就業規則AIの非対応も同じ表で明記する（データは
          COMPARISON_ROWS を参照。断定・誹謗・優良誤認を避ける方針もそこに記載）。 */}
      <section id="compare" className="scroll-mt-20 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              手続きシステムとも、汎用AIとも役割が違います
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              それぞれに得意分野があります。就業規則AIが担うのは「会社を覚えて、相談に自社前提で答える」の部分です。
            </p>
          </div>
          {/* 2026-08-11 UI監査#3: min-w-[860px] の表がモバイルで「残り3列ある」ことに
              気づけなかった（スクロールバー非表示環境では手がかりゼロ）。右端フェードと
              案内1行（UIラベル）を sm 未満のみ表示する。フェードは pointer-events-none で
              操作を妨げない。 */}
          <p className="mb-2 text-center text-xs text-neutral-500 sm:hidden">
            表は横にスクロールできます
          </p>
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-2xl bg-gradient-to-l from-white to-transparent sm:hidden"
            />
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full min-w-[860px] border-collapse bg-white text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th scope="col" className="p-4 text-xs font-semibold text-neutral-600">
                    観点
                  </th>
                  {COMPARISON_HEADERS.map((name, i) => (
                    <th
                      scope="col"
                      key={name}
                      className={
                        i === 0
                          ? 'p-4 text-sm font-bold text-brand-700'
                          : 'p-4 text-sm font-semibold text-neutral-700'
                      }
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(row => (
                  <tr key={row.label} className="border-b border-neutral-100 last:border-b-0">
                    <th
                      scope="row"
                      className="p-4 align-top text-xs font-semibold text-neutral-600"
                    >
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td
                        key={`${row.label}-${i}`}
                        className={
                          (i === 0 ? 'bg-brand-50/40 ' : '') +
                          'p-4 align-top text-[13px] leading-relaxed ' +
                          (cell.strong ? 'font-medium text-neutral-900' : 'text-neutral-600')
                        }
                      >
                        {cell.strong && (
                          <Check
                            className="mb-0.5 mr-1 inline h-3.5 w-3.5 text-brand-600"
                            aria-hidden
                          />
                        )}
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
            2026年7月時点の各社公開情報にもとづく一般的な整理です。正確な機能・料金は各サービスの公式サイトをご確認ください。
            就業規則AIは手続きシステムの代替ではないため、SmartHR・freee・オフィスステーションなどと併用できます。
          </p>

          {/* 2026-07-24 I4(比較検討者の不安): 「併用できます」だけでは『また全部
              入れ直すのか』が宙に浮く。置き換えない・全項目の再入力は不要・規程は
              対話で覚える、という実装どおりの事実を正直に1ブロックで補う（誇張・
              虚偽能力なし。Phase1コンプラ）。
              2026-07-29 CTO修正（L3監査#8）: 比較表の直下がすでに情報密度の高い
              セクションのため、既存システム併用者向けの補足2段落は<details>で畳み、
              関係する人だけが開く段階的開示にする（本文はDOM上に常に存在＝SEO/GEO
              への影響なし。既存のFAQアコーディオンと同じ手法）。 */}
          {/* 2026-07-29 CTO修正（UX監査Round4#10）: ネイティブ<details>/<summary>を
              Disclosure（components/ui/Disclosure.tsx）に置き換え、キーボード操作
              （Tab+Enter/Space）を明示的に保証する（詳細は同コンポーネントのコメント参照）。 */}
          <Disclosure
            className="group mx-auto mt-8 max-w-3xl rounded-2xl border border-neutral-200 bg-neutral-50"
            summaryClassName="flex w-full cursor-pointer select-none items-center justify-between gap-2 p-6 text-sm font-semibold text-neutral-900"
            summary={
              <>
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-brand-600" aria-hidden />
                  すでにSmartHR・freeeなどをお使いの方へ
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </>
            }
          >
            <div className="px-6 pb-6">
              <p className="text-sm leading-relaxed text-neutral-600">
                就業規則AIは既存の手続きシステムを置き換えません。従業員情報や規程を、就業規則AIにすべて入れ直す必要はありません。
                就業規則のファイルを置けば、その1枚を前提に相談できます。
                手続き・給与関連はこれまでのツールのまま、就業規則AIは「自社ルールの相談窓口」を1つ足す位置づけです。
              </p>
              {/* 2026-07-24 P03(勤怠ツール併用の比較検討者): 打刻データの二重入力不安を
                  登録前に解消する。チャットが固有名込みで即答している事実（勤怠はMF等に
                  入れるだけ・就業規則AIに打刻を転記する必要はない）をLPへ焼き戻す。誇張・虚偽
                  能力なし・実挙動と一致。 */}
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                勤怠（マネーフォワード勤怠・ジョブカン・KING OF TIMEなど）とお使いの方も、打刻データを就業規則AIに入れ直す必要はありません。
                打刻はこれまでの勤怠ツールのまま、就業規則AIはそのルール照合・記憶・期限・書類のたたき台を足す役割です。
              </p>
            </div>
          </Disclosure>
        </div>
      </section>

      {/* ===== 料金 ===== */}
      {/* id="pricing": ヘッダの「料金」リンク・MobileNavの着地アンカー（L1監査#5）。
          scroll-mt-20 でスティッキーヘッダ(h-16)ぶんのオフセットを確保する。 */}
      <section id="pricing" className="scroll-mt-20 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          {/* 2026-07-25 CTO修正: 課金開始(BILLING_ENABLED=true)に合わせて「無料モニター期間」
              表記を撤去。無料プランは引き続き存在するが、有料プランは実際に課金される。
              誇張なし: 無料プランの利用上限・記憶の蓄積・全削除可はいずれも本文と整合する事実。 */}
          <div className="mx-auto mb-12 max-w-2xl rounded-2xl border border-brand-200 bg-brand-50/50 p-6 text-center sm:p-8">
            <p className="text-lg font-semibold text-neutral-900">
              無料プランから始められます。ファイルを置いた前提が残るほど、答えは自社に近づきます。
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              合わないと感じたら、預けたデータごと全削除してやめられます。
              まずは就業規則のファイルを置くところから始められます。
            </p>
          </div>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">料金</h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              登録するとまずは無料プランでお使いいただけます。下記は有料プランに切り替えた場合の月額料金です。
              {/* 2026-08-20 正典整合（business-facts.md 2026-07-30 Takeshi確定）: 当社は消費税の
                  免税事業者のため、価格の表示に消費税区分を名乗らない。2026-07-30 に総額表示の
                  明示として入れた一文が、免税事業者では言えない区分を名乗っていた。数字は
                  動かさず、区分を指す語だけを外す。追加料金が無い（＝表示額がそのまま支払額）
                  という事実は変えずに残す。判定は scripts/business_facts_gate.py が機械で行う。 */}
              <span className="mt-1 block text-sm text-neutral-500">表示価格はすべてお支払い総額です。</span>
            </p>
            {/* 2026-07-30 PMF修理#1: 料金の単独ページ /pricing を新設した。このアンカー
                (#pricing) は既存の内部リンク・計測を壊さないため残し、ここから単独ページへ
                導線を1本張る（料金だけを見に来た人・共有したい人の着地先を1枚に集める）。 */}
            <p className="mt-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                料金ページで詳しく見る（無料プランの範囲・年払い・解約の条件）
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </p>
            {/* 2026-07-25 CTO修正: 課金は既に有効。「予告してから課金開始」ではなく
                「自分の操作で申し込んだときだけ課金される」という自己サーブの事実を明示する。
                2026-07-29 CTO修正（L3監査#6）: 上記は billingEnabled() が true の前提でしか
                正しくない。false の間にこの文言のままだと特商法ページの「一時停止中」表記と
                矛盾する（実際に本番で矛盾が起きていたことを確認済み）。両状態を出し分ける。 */}
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {paidSignupOpen ? (
                <>
                  ご自身で有料プランを選び、お申し込みの操作をしたときだけ課金されます。
                  登録しただけで自動的に課金が始まることはありません。
                </>
              ) : (
                <>
                  有料プランへの切り替えは、現在お申し込みの受付を一時的に停止しています（無料プランは引き続きご利用いただけます）。
                  受付を再開する際は、このページと特定商取引法に基づく表記でお知らせします。
                </>
              )}
            </p>
          </div>
          {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: グリッド子要素に min-w-0 を
              付け、極端に狭い実効幅でもカード内の長いCTA文言を理由に横スクロールが
              発生しないようにする（通常倍率では見た目は不変）。 */}
          <div className="grid min-w-0 items-start gap-5 sm:grid-cols-3">
            {PLAN_COPY.map(p => (
              <Card
                key={p.name}
                className={
                  'min-w-0 ' +
                  (p.featured
                    ? 'border-brand-300 shadow-md ring-1 ring-brand-200'
                    : '')
                }
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">{p.name}</h3>
                  {p.badge && (
                    <Badge tone={p.featured ? 'brand' : 'neutral'}>{p.badge}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-500">{p.tagline}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                    &yen;{p.price}
                  </span>
                  <span className="text-sm text-neutral-500">{p.unit}</span>
                </p>
                {/* 2026-07-23 I02: 「2ヶ月分お得」の根拠（月払い比）を明記し、
                    年払いの提供範囲は下部の注記でプラン間の表記を統一する。
                    2026-07-30 PMF修理#7: 年額(¥39,800)が12pxのグレー1行で、月額の
                    1/3のサイズ＝実質見えていなかった。価格そのもの（lib/plans.ts の
                    yearlyJpy）は一切変えず、文字サイズと配置だけを可読な水準に上げる。
                    年払いトグルは Stripe の価格を増やす＝Takeshi承認事項のため実装しない。 */}
                {p.yearly && (
                  <p className="mt-2 inline-flex flex-wrap items-baseline gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm text-brand-800">
                    <span className="font-semibold tabular-nums">年額 &yen;{p.yearly.toLocaleString()}</span>
                    <span className="text-xs text-brand-700">（月払いより2ヶ月分お得）</span>
                  </p>
                )}
                {/* 2026-07-23 E12: 価格アンカー（自社事実のみ・外部相場は主語にしない）。
                    設計: output/0723/banto_pricing_anchor_copy.md 案A（誇張禁止・Phase1コンプラ）。 */}
                {p.anchor && (
                  <p className="mt-2 text-xs leading-relaxed text-neutral-600">{p.anchor}</p>
                )}
                <ul className="mt-5 space-y-2.5">
                  {p.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
                {/* 2026-07-23 B17: CTA文言をプラン別に分化（計測は不変）。
                    2026-07-24 I3: 士業プランのみ href に plan=shigyo を載せる。 */}
                <TrackedCTA
                  location={`pricing_${p.name}`}
                  href={p.signupHref}
                  className={buttonClass({
                    variant: p.featured ? 'primary' : 'secondary',
                    className: 'mt-6 w-full whitespace-normal text-center',
                  })}
                >
                  {p.cta}
                </TrackedCTA>
                <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500">
                  <Link href={PLAN_FILE_FIRST.href} className="underline underline-offset-2 hover:text-brand-700">
                    {PLAN_FILE_FIRST.label}
                  </Link>
                </p>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
            EntryとStandardは1社あたりの月額です。プランの上限人数までは、何人で使っても料金は変わりません。
            {/* 2026-07-29 CTO修正（UX監査Round5#4・軽）: 席数の上限（seatCap）が/tokushohoにしか
                記載されておらず、料金カード直下の説明文にも明記する。
                2026-07-29 CTO修正（UX監査Round6#6・軽微）: 顧問先数の上限（{PLANS.shigyo.maxCompanies}社）と
                席数の上限（{PLANS.shigyo.seatCap}席）が偶然同じ数字のため、1文に並べると「実績数」と
                誤読されるとの指摘（ペルソナ10）。両者が別々の上限であることを明示する言い回しに変える。 */}
            士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です。顧問先の登録数の上限は{PLANS.shigyo.maxCompanies}社までで、これとは別に、事務所の利用メンバー数（席）の上限は{PLANS.shigyo.seatCap}席までです（顧問先数と席数は別々の上限です）。
            年払い（月払いより2ヶ月分お得）は現在Entryプランのみのご用意で、Standardと士業プランは月払いのみです。
            {/* 2026-07-28 CTO修正（L2監査#2）: 複数店舗の扱いを料金セクション直下にも明記する。 */}
            複数店舗をお持ちの場合は、1社の契約にまとめて店舗ごとの前提を登録する方法と、
            士業プランの複数会社管理機能で店舗ごとに記憶を分ける方法のどちらも選べます（詳しくは下のFAQをご覧ください）。
          </p>
          <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
            インボイス制度の2026年10月キット（買い切り）は、労務の月額とは別商品です。
            <Link href="/seido/kit" className="font-medium text-brand-700 underline hover:text-brand-800">
              キットの案内
            </Link>
            から確認できます。
          </p>
        </div>
      </section>

      {/* ===== よくある質問（FAQ）===== */}
      <section id="faq" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              よくある質問
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
              中小企業の総務・経営者からよく寄せられる質問をまとめました。
            </p>
          </div>
          {/* 2026-07-23 B10: アコーディオン化。初期表示は先頭3問のみで、残りは
              「すべての質問を見る」で展開。全問のテキストは閉じていても常にDOM上に
              存在し、FAQPage構造化データも全問を維持する。
              2026-07-29 CTO修正（UX監査Round6#1）: ネイティブ<details>から
              Disclosureコンポーネントへ統一（詳細は同コンポーネントのコメント参照）。 */}
          <div className="space-y-3">
            {FAQ.slice(0, 3).map(item => (
              <Disclosure
                key={item.q}
                className="group rounded-2xl border border-neutral-200 bg-white"
                summaryClassName="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-5 text-left text-base font-semibold text-neutral-900"
                summary={
                  <>
                    {item.q}
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </>
                }
              >
                <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">
                  {item.a}
                </p>
              </Disclosure>
            ))}

            <Disclosure
              className="group"
              summaryClassName="flex w-full cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border border-neutral-500 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-600 hover:text-neutral-900"
              summary={
                <>
                  すべての質問を見る（あと{FAQ.length - 3}問）
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </>
              }
            >
              {/* 2026-07-29 CTO修正（UX監査Round6#1・派生バグ）: この内側の各FAQ項目は
                  外側「すべての質問を見る」Disclosureの入れ子。両方に無名の`group`を
                  付けると、Tailwindの`group-data-[state=open]:`は最も近い祖先ではなく
                  マッチする祖先全てに反応するため、外側だけが開いた状態でも内側の
                  閉じたchevronまで回転してしまう。名前付きgroup(`group/item`)で
                  内側だけに独立してスコープする（旧実装の`group/item`と同じ意図）。 */}
              <div className="mt-3 space-y-3">
                {FAQ.slice(3).map(item => (
                  <Disclosure
                    key={item.q}
                    className="group/item rounded-2xl border border-neutral-200 bg-white"
                    summaryClassName="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-5 text-left text-base font-semibold text-neutral-900"
                    summary={
                      <>
                        {item.q}
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]/item:rotate-180"
                          aria-hidden
                        />
                      </>
                    }
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">
                      {item.a}
                    </p>
                  </Disclosure>
                ))}
              </div>
            </Disclosure>
          </div>

          {/* 2026-07-29 CTO修正（L3監査#7）: 本文・FAQ・体験デモに前提知識として
              出てくる労務用語を、初めて読む方向けに簡潔に補足する（軽い段階的開示・
              アコーディオンで畳み、情報密度を上げすぎない）。
              2026-07-29 CTO修正（UX監査Round4#10）: Disclosureへ置き換え、
              キーボード操作（Tab+Enter/Space）を明示的に保証する。
              2026-08-11 UI監査#1（a11y）: 社会的証明バーの「36協定」からのアンカー
              着地点にする（id="yougo"）。ハッシュ一致で自動的に開くため、飛んできた
              読者は追加操作なしで解説本文を読める。scroll-mt はスティッキーヘッダ
              (min-h-16)ぶんのオフセット。 */}
          <Disclosure
            id="yougo"
            className="group mt-8 scroll-mt-20 rounded-2xl border border-neutral-200 bg-white"
            summaryClassName="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-5 text-sm font-semibold text-neutral-700"
            summary={
              <>
                はじめて読む方へ — よく出てくる労務用語の補足
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </>
            }
          >
            <dl className="space-y-3 px-5 pb-5">
              {JARGON.map(j => (
                <div key={j.term}>
                  <dt className="text-sm font-semibold text-neutral-900">{j.term}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-neutral-600">{j.body}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </div>
      </section>

      {/* ===== 構造化データ（rich results 適格化）=====
          FAQPage は上の可視FAQと対。Organization=KIZUNA Creation。
          BreadcrumbList=トップ > 就業規則AI（業務効率化）。aggregateRating は捏造しない。 */}
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
            name: 'KIZUNA Creation',
            url: 'https://banto-roumu.com/business',
            logo: 'https://banto-roumu.com/icon-512.png',
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
                name: '就業規則AI',
                item: 'https://banto-roumu.com/business',
              },
            ],
          }),
        }}
      />
      {/* 2026-08-09 SEO/AEO監査で追加: 下部「今日やることは、3つだけ」は
          登録→利用開始の実際の手順であり、HowTo構造化データが未使用だった。
          ONBOARDING_STEPS（可視本文と共用）をそのままstepへ変換する。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: '就業規則のファイルからずれを1枚にする3つのステップ',
            step: ONBOARDING_STEPS.map((s) => ({
              '@type': 'HowToStep',
              position: Number(s.step),
              name: s.title,
              text: s.body,
            })),
          }),
        }}
      />

      {/* ===== 今日やることチェックリスト（B11・2026-07-23） =====
          最終CTAの直前で「ファイル→1枚→残すときに登録」の最初の一歩を具体化し、
          登録後に何をすればよいか分からない不安を先に解消する。 */}
      <section className="mx-auto max-w-3xl px-6 pt-20">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-neutral-900">
            今日やることは、3つだけ
          </h2>
          <ol className="mt-6 grid min-w-0 gap-4 sm:grid-cols-3">
            {ONBOARDING_STEPS.map(item => (
              <li key={item.step} className="flex flex-col items-center text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white tabular-nums">
                  {item.step}
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== 末尾CTA =====
          2026-07-23 B16: 帳場格子調の縦縞をCSSだけで極薄に重ねる（画像なし）。 */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Card className="bg-brand-600 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_28px)] text-center">
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            就業規則のファイルを置く
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            ファイルを置くと、ずれが1枚になります。登録はそのあとです。相談は、その次です。
          </p>
          <div className="mt-7 flex min-w-0 justify-center">
            <TrackedCTA
              location="final"
              className={buttonClass({
                variant: 'secondary',
                size: 'lg',
                className: 'whitespace-normal text-center',
              })}
            >
              ファイルを置く
              <ArrowRight className="h-4 w-4" aria-hidden />
            </TrackedCTA>
          </div>
        </Card>
      </section>

      {/* ===== 検索意図別の使い方（関連LPへの内部リンク・クラスタ） =====
          2026-07-23 B12: 全件列挙（自動生成で増え続ける）をやめ、代表的な5件に絞る。
          全一覧へは既存の /roumu ハブページで到達できる（クロール経路は sitemap と
          /roumu 側で維持されるため、SEO上の deindex は起きない）。 */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <p className="mb-4 text-center text-xs font-medium text-neutral-500">
          代表的な使い方から見る
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {USECASE_LIST.slice(0, 5).map((u) => (
            <Link
              key={u.slug}
              href={`/roumu/${u.slug}`}
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-500 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-600 hover:text-neutral-900 sm:min-h-0 sm:py-2"
            >
              {u.ogCategory}
            </Link>
          ))}
          <Link
            href="/roumu"
            className="inline-flex min-h-11 items-center rounded-full border border-brand-200 bg-brand-50 px-4 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 sm:min-h-0 sm:py-2"
          >
            使い方の一覧をすべて見る
          </Link>
        </div>
      </section>

      {/* ===== 無料セルフ点検ツールへの内部リンク（クラスタ・ハブへ接続） =====
          /tools 一覧（ハブ）と各ツールへ /business から直接リンクし、
          クロール経路を確立する（未インデックスの /tools/* を拾わせる）。 */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <p className="mb-1 text-center text-xs font-medium text-neutral-500">
          自社の数字で確かめる無料ツール
        </p>
        <p className="mb-4 text-center text-xs text-neutral-500">
          登録不要・会社データは保存しません
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {TOOL_LIST.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="inline-flex min-h-11 items-center rounded-full border border-neutral-500 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-600 hover:text-neutral-900 sm:min-h-0 sm:py-2"
            >
              {t.label}
            </Link>
          ))}
          <Link
            href="/tools"
            className="inline-flex min-h-11 items-center rounded-full border border-brand-200 bg-brand-50 px-4 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 sm:min-h-0 sm:py-2"
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
            className="inline-flex min-h-11 items-center rounded-full border border-brand-200 bg-brand-50 px-4 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 sm:min-h-0 sm:py-2"
          >
            規程管理・組織の記憶ブログを読む
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-500 px-4 text-xs text-neutral-600 transition-colors hover:border-neutral-600 hover:text-neutral-900 sm:min-h-0 sm:py-2"
          >
            よくある質問を見る
          </Link>
        </div>
      </section>

      <PublicFooter ctaLocation="footer" />
    </div>
  )
}
