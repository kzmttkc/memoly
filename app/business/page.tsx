import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { MessageSquareText, FileText, ShieldCheck, Lock, BadgeCheck, ArrowRight, ArrowDown, Check, X, Building2, Sparkles, Database, KeyRound, Trash2, ChevronDown, UserCog, Copy, ClipboardList, Globe } from 'lucide-react'
import { BantoMark } from '@/components/ui/BantoMark'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import TryDemoLazy from './_components/TryDemoLazy'
import { TrackedCTA } from './_components/TrackedCTA'
import { HeroEyebrow, HeroHeadline, HeroSubcopy } from './_components/HeroCopy'
import { HeaderCta } from './_components/HeaderCta'
import { MobileNav } from './_components/MobileNav'
import IndustryHeroPreview from './_components/IndustryHeroPreview'
import CompareToggle from './_components/CompareToggle'
import ScenarioSection from './_components/ScenarioSection'
import ScrollProgress from './_components/ScrollProgress'
import ForcePaidVariant from './_components/ForcePaidVariant'
import LeadCapture from './_components/LeadCapture'
import { VARIANT_HEADER, type LpVariant } from './_lib/variant-shared'
import { PLANS, billingEnabled } from '@/lib/plans'
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
        url: 'https://banto-roumu.com/og-banto-main.png',
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
    a: '番頭が提供するのは一般的な情報提供と、自社の数値を入れた下書きの補助です。就業規則の作成代行や個別の法的助言ではありません。最終的な判断は、必要に応じて専門家にご確認ください。',
  },
  {
    q: '就業規則のファイルをアップロードして覚えさせられますか',
    a: '現在、PDFやWordなどのファイルを取り込む機能はありません。就業規則や36協定などの規程は、対話や入力で要点を番頭に伝えていくと、その内容を覚えて以降の回答に反映します。一度覚えた内容は繰り返し説明する必要がなく、二度目からは前提を省いて相談できます。',
  },
  {
    q: 'SmartHRやfreeeなど既存のツールを使っています。乗り換えや全項目の入れ直しが必要ですか',
    a: '番頭は既存の手続きシステムを置き換えるものではなく、併用を前提にしています。SmartHR・freee・オフィスステーションなどは手続き・データ管理を、番頭は自社ルールの相談を担う役割分担です。従業員情報や規程のすべてを入れ直す必要はありません。相談したい範囲の規程の要点だけを対話で覚えさせれば、自社の前提に沿った回答が得られます。',
  },
  {
    q: '社労士資格との関係はどうなっていますか',
    a: '運営者は社会保険労務士試験に合格していますが、社会保険労務士会への登録は行っておらず、資格者としての個別相談・書類作成代行は提供していません。番頭は、自社の規程を覚えて一般的な情報を即答するツールであり、法的な最終判断が必要な場面では登録済みの専門家にご確認ください。',
  },
  {
    // 2026-07-28 CTO修正（L2監査#3）: 顧問先の登録上限（50社）が非公開で、
    // 検討者（士業）が実際の運用可否を判断できなかった（ペルソナ2・10で独立に指摘）。
    q: '社労士事務所でも使えますか',
    a: '士業プランで、複数の顧問先企業を切り替えて使えます（顧問先は最大50社まで登録できます）。記憶とデータは企業ごとに分離され、顧問先ごとに覚えた前提で、切り替えてすぐ相談を続けられます。料金は事務所の利用メンバー数に応じた席単位の課金です。',
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
    a: 'できます。士業プランは社会保険労務士に限定していません。記帳代行・バックオフィス代行など、複数のクライアント企業の労務まわりを切り替えて管理したい方であればご利用いただけます。会社ごとに記憶とデータが分離されるため、クライアントの情報が混ざる心配はありません（顧問先は最大50社まで登録できます）。料金は事務所・ご自身の利用メンバー数に応じた席単位の課金です。',
  },
  {
    q: '専任の労務担当がいなくても使えますか',
    a: '中小企業の総務担当や経営者が、社内規程の管理や日々の労務管理の調べ物を減らす用途を想定しています。専任の労務担当がいなくても、自社の前提に合わせた答えを得られます。',
  },
]

// 専門用語の簡潔な補足（2026-07-29 CTO・L3監査#7）: FAQ・体験デモ・比較表などの
//   本文中に前提知識として出てくる労務用語を、初めて読む方（学生インターン等）
//   向けに1箇所にまとめて簡潔に補足する。個々の本文（FAQ回答・デモの回答文言）は
//   Phase1レビュー済みの言い回しのため書き換えず、独立した用語集として追加する。
const JARGON = [
  { term: '36協定（サブロク協定）', body: '残業や休日出勤をさせる前に、会社と労働者の代表が結んで労働基準監督署へ届け出る労使協定です。これが無いと、原則として残業をさせること自体が労働基準法違反になります。' },
  { term: '特別条項', body: '36協定の残業時間の上限（原則 月45時間・年360時間）を、繁忙期など臨時的な事情に限って超えられるようにする、協定内の特別なルールです。' },
  { term: '比例付与', body: '週の勤務日数が少ないパート・アルバイトの方に、フルタイムより少ない日数で有給休暇を計算して付与する仕組みです。' },
  { term: '就業規則', body: '労働時間・休日・賃金など、会社と従業員の間のルールをまとめた文書です。常時10人以上を雇う会社は作成・届出が義務です。' },
]

// 機能4軸（2026-07-23 B01+I01: 旧「業務効率化」4カードと旧「機能」4カードを
// 1セクション4カードへ統合し、中盤を約50%短縮。各カードは「機能名＝何をするか」と
// 「肩代わりする手間＝何が減るか」を1枚で言い切る）。
const FEATURES = [
  {
    icon: BantoMark,
    title: '覚える',
    body:
      '就業規則や36協定などの規程の要点は、対話や入力で番頭に伝えて覚えさせます（ファイルの取り込みには対応していません）。会社のプロファイル（所定労働時間・休日・36協定の状況など）と相談の経緯も蓄積され、毎回の前提説明がなくなり、二度目からは話が早くなります。',
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
  '貼り付けは0回。規程も前提も、番頭が覚えている',
  '「来週、残業できる？」と聞くだけで、自社前提の答え',
  '前回の判断は、続きからそのまま話せる',
]

// 比較表（2026-07-23 B18）。「正直な土俵」原則:
//   - 相手の強み（手続きの電子化・帳票・汎用性）は強みとして明記する。
//   - 番頭の弱み（電子申請・給与計算は非対応）も同じ表の中で明記する。
//   - 各社の記載は2026年7月時点の公開情報にもとづく一般的な整理に留め、
//     優劣の断定・誹謗・優良誤認になりうる表現（「〜はできない」等の断定）を避ける。
//   - 出所と「併用できる」事実は表の直下に注記する。
// 2026-07-24 P03(freee併用の比較検討者): 併用例示が SmartHR 固定で freee が名指し
//   されず、比較モードの確信が一拍遅れていた。freee人事労務（国内2大労務SaaSの一角）を
//   独立列として追加し、各社の得意分野も正直に認める（優劣の断定・誹謗・優良誤認は避ける）。
const COMPARISON_HEADERS = ['番頭', 'SmartHR', 'freee人事労務', 'オフィスステーション', '汎用AIチャット']
const COMPARISON_ROWS: { label: string; cells: { text: string; strong?: boolean }[] }[] = [
  {
    label: '主な役割',
    cells: [
      { text: '会社の規程・前提を覚えて、労務の相談に自社前提で答える', strong: true },
      { text: '人事・労務手続きの電子化と従業員データベース' },
      { text: '給与計算・勤怠・人事労務手続きと従業員データの管理' },
      { text: '労務手続き書類の作成・電子申請' },
      { text: '分野を問わない汎用のAIチャット' },
    ],
  },
  {
    label: '自社の規程・前提を覚えた回答',
    cells: [
      { text: '中心機能。規程と相談の経緯を記憶して回答', strong: true },
      { text: '主目的ではありません' },
      { text: '主目的ではありません' },
      { text: '主目的ではありません' },
      { text: '汎用の記憶機能はあるものの、規程や期限に特化した管理ではありません' },
    ],
  },
  // 導入までの時間（2026-07-23 W3.5d G-f）。番頭は登録直後から相談でき初回回答
  // まで数分が目安（TTV設計はC03/C06で充足済みの事実）。他社は導入形態が会社ごとに
  // 異なるため「〜できない/〜かかる」の断定を避けた中立表現に留める（正直な土俵）。
  // ※「データ分離」行は競合のセキュリティ体制を当社が断定できず優良誤認リスクの
  //   ため追加しない（2026-07-23 CTO裁定・自社セキュリティ節で語る）。
  {
    label: '導入までの時間',
    cells: [
      { text: '登録からそのまま相談を始められ、初回の回答まで数分が目安です', strong: true },
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

// 表示名・価格・主役(featured)・年額は lib/plans.ts（SSOT）から引く。LP固有の訴求コピー
// （tagline/features/badge）だけをここで持つ。これにより「価格・主役が LP と課金で
// 食い違う」事故を構造的に防ぐ（2026-06-29 Takeshi承認: Entryが主役・年額¥39,800）。
// 課金単位の確定表記（SSOT: docs/BANTO_BILLING_GATE.md §4・§5）:
//   Entry/Standard = 会社単位の月額（プランの上限人数まで追加料金なし）。
//   士業のみ席（シート）単位 = 事務所の利用メンバー数に応じて課金。
//   利用回数・上限人数は lib/plans.ts の実装値から直接埋め込む（表示と実装の乖離を構造的に防ぐ）。
//   anchor（E12・2026-07-23）: 価格アンカーは「自社事実のみ」型（output/0723/banto_pricing_anchor_copy.md 案A）。
//     外部価格（社労士相談の相場等）は出典を示せず有利誤認リスク＋社労士法27条配慮に反するため
//     主語にしない。1日あたりの金額は monthlyJpy÷31 の割り算のみ（検証可能・誇張ゼロ）。
const PLAN_COPY = [
  {
    name: PLANS.starter.displayName,
    price: PLANS.starter.monthlyJpy.toLocaleString(),
    unit: `/月（1社あたり・${PLANS.starter.seatCap}名まで）`,
    yearly: PLANS.starter.yearlyJpy,
    tagline: 'まず使ってみる',
    badge: 'おすすめ',
    // 士業のみ CTA に plan=shigyo を載せる（I3・2026-07-24）。他プランは既定の
    // /signup?next=/company（TrackedCTA の既定 href）を使う。
    signupHref: undefined as string | undefined,
    anchor: `1日あたり約${Math.round(PLANS.starter.monthlyJpy / 31)}円で、労務の調べ物と記録をいつでも任せられます。`,
    // 2026-07-23 B17: CTA文言をプラン別に分化（リンク先・計測locationは不変）。
    cta: 'Entryで始める',
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
    signupHref: undefined as string | undefined,
    anchor: '総務担当を1人増やす前に、まず番頭に任せられる範囲を確かめられます。',
    cta: 'Standardで始める',
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
    // 士業CTAは士業文脈を導線に持たせる（I3・2026-07-24。ゲート本体は別班）。
    signupHref: '/signup?next=/company&plan=shigyo' as string | undefined,
    // 士業プランは設計案にアンカー無し（席単位課金で「1日あたり」換算が誤解を生むため付けない）。
    anchor: null,
    cta: '士業として顧問先を登録',
    features: [
      `Standard のすべて（AIチャット相談 1日${PLANS.shigyo.limits.chat}回まで）`,
      // 2026-07-28 CTO修正（L2監査#3）: 顧問先の登録上限（50社）が非公開だった。
      // lib/plans.ts の shigyo.maxCompanies をそのまま開示する。
      `複数企業（顧問先）の切り替え（最大${PLANS.shigyo.maxCompanies}社まで）`,
      '企業ごとに記憶・データを分離',
      '顧問先ごとに覚えた前提で、切り替えてすぐ相談を続けられます',
      '席単位の課金。事務所の利用メンバー数に応じて席を追加',
    ],
    featured: PLANS.shigyo.featured,
  },
]

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
      {/* I11: 広告着地時のみ、cookie/計測の変種を SSR 表示（B固定）と同期 */}
      {isPaidLanding && <ForcePaidVariant />}
      {/* ===== ヘッダ ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        {/* 2026-07-29 CTO修正（L3監査#4・200%ズーム対応）: この行が固定高さ h-16 だと、
            極端に狭い実効幅で右側nav（flex-wrap）が2行に折り返したとき、はみ出した
            2行目がボックスの外側（＝直下のサブナビ帯＝冒頭サマリー欄）に重なって見えた
            （近藤氏・ペルソナ4が200%ズームで再現）。h-16 を min-h-16 に変え、折り返しが
            発生したときはヘッダ自体の高さが伸びて後続セクションを押し下げる（＝重ならない）
            ようにする。通常倍率では1行に収まるため見た目は不変。 */}
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-x-2 px-6 py-2">
          <Link href="/business" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <BantoMark className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              番頭
              <span className="ml-1 text-sm font-medium text-neutral-400">Banto</span>
            </span>
          </Link>
          {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: 極端に狭い実効幅（高倍率
              ズーム時）でナビ項目(ハンバーガー/ログイン/CTA)が1行に収まりきらず、
              ページ全体の横スクロールに寄与していた。flex-wrap で折り返し可能にする
              （通常倍率では1行に収まるため見た目は不変）。 */}
          <nav className="flex flex-wrap items-center justify-end gap-2">
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
            {/* A12: スクロール深度で「無料で始める」→「診断を始める」へ動的変化。
                リンク先・location='header' 計測・utm引き継ぎは従来と同一。 */}
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
          A03: 人間の初見客には帯がFVを圧迫しH1到達を遅らせるため <details> で
          折りたたむ。本文テキストは閉じていても DOM 上に常に存在するため、
          クローラ・要約エンジンは従来どおり全文を読める（GEO効果は維持）。 */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-2.5">
          <details>
            <summary className="cursor-pointer select-none text-center text-xs font-medium text-neutral-500 hover:text-neutral-700 sm:text-left">
              番頭(Banto)とは — 30秒でわかる概要
            </summary>
            <p className="mt-2 pb-1 text-center text-sm leading-relaxed text-neutral-600 sm:text-left">
              番頭(Banto)は、中小企業の総務・経営者向けの労務記憶AIです。就業規則・36協定・有給休暇管理などの自社規程をAIに覚えさせておき、労務の疑問に自社の前提で即答します。汎用AIのように、聞くたびに社内規程や過去の運用を説明し直す必要がありません。企業ごとにデータを分離して保管し、無料で試せます。
            </p>
          </details>
        </div>
      </section>

      {/* ===== ヒーロー（above the fold） =====
          左：価値ステートメント1つ + 支える一行 + 主要CTA1つ
          右：製品の動きを示す様式化UIプレビュー（見て分かる）
          2026-07-23 A01: モバイル縦積みで製品プレビューがCTAより後ろ＝FV外に
          落ちていた。コピー/プレビュー/CTAを3ブロックに分け、モバイルの自然順を
          「H1 → プレビュー → CTA」に変更。lg では従来どおり左=言葉・右=プレビュー
          （プレビューを row-span-2 で右列に固定）。 */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pt-16">
        {/* 2026-07-28 CTO修正（L1監査#2・200%ズーム対応）: grid の暗黙トラックは
            既定で子要素の min-content 幅を下限にする。H1見出しは「語中改行を防ぐ」ため
            各意味単位を inline-block(=改行不可の1ブロック)にしており、これが
            min-content 計算上「分割不可の1単語」として扱われ、極端に狭い実効幅
            （高倍率ズーム時）でも grid トラックがその幅ぶん縮まずページ全体が
            横スクロールする実害があった（実測: 375px幅で200%ズーム相当の実効幅では
            scrollWidth が clientWidth を超過）。各グリッド子要素に min-w-0 を付け、
            トラックが利用可能幅まで縮む＝内部でテキストが折り返す（オーバーフローで
            隠れるのではなく見えたまま折り返す）ようにする。見た目は通常倍率で不変。 */}
        <div className="grid items-center gap-y-8 lg:grid-cols-2 lg:gap-x-10">
          {/* ブロック1：言葉（ブランド行・アイブロー・H1・サブコピー） */}
          <div className="min-w-0 text-center lg:text-left">
            {/* 2026-07-23 A10: ブランド名 BANTO をH1付近でヒーロー級に（テキストのみ。
                新ロゴ画像は承認待ちのため入れない。A/B共通・変種スロットの外）。 */}
            <p className="mb-4 flex items-baseline justify-center gap-2.5 lg:justify-start">
              <span className="text-xl font-extrabold tracking-[0.18em] text-brand-700">
                BANTO
              </span>
              <span className="text-sm font-semibold tracking-wide text-neutral-500">
                番頭
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
            {/* 2026-07-24 P03(比較検討者): 既存システムとの共存をFV圏内で1行示す。
                比較来訪者の第一の疑問（また全部入れ直すのか）は従来スクロール後の
                比較表でしか解けなかった。A/B変種スロット(HeroCopy)の外＝A/B共通で
                固定。文面は比較表・FAQ「SmartHR…」と同一の事実で、置き換え示唆や
                誇張はしない（Phase1コンプラ・敬体・強調記号なし）。 */}
            <p className="mx-auto mt-4 flex max-w-xl items-start justify-center gap-1.5 text-sm leading-relaxed text-neutral-500 lg:mx-0 lg:justify-start">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
              <span>
                SmartHR・freeeなどの既存システムはそのまま。番頭は「自社ルールの相談窓口」を1つ足す使い方です。
              </span>
            </p>
            {/* 2026-07-24 P10(英語選好の外資HR): 番頭のチャットは英語質問に英語で
                答える（実装済み・実証済み）が、入口が日本語のみでその価値が発見されず
                離脱する。UIシェルの全訳はせず、「英語で聞けば英語で答える」への控えめな
                誘導一行のみ。虚偽能力主張なし＝UI全体が英語対応と誤認させない範囲。 */}
            <p className="mx-auto mt-2 flex max-w-xl items-start justify-center gap-1.5 text-sm leading-relaxed text-neutral-400 lg:mx-0 lg:justify-start">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              <span lang="en">Ask in English — Banto answers your labor questions in English.</span>
            </p>
          </div>

          {/* ブロック2：見て分かる（モバイルではH1直下・lgでは右列に固定）
              2026-07-23 A14+B13+I01: 業種タブ付きプレビューへ置換（初期表示は
              従来と同じ製造業＝A/BのFV体験は不変。グロー装飾は撤去しフラット化）。 */}
          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:pl-4">
            <IndustryHeroPreview />
          </div>

          {/* ブロック3：CTA（モバイルではプレビューの後）
              主CTA=デモ体験（登録不要）へページ内スクロール。冷たい初見客に
              会社登録を先に迫らず、まず数秒でアハに届ける。純粋な内部アンカー。
              2026-07-23 A04/A05: 主CTAを時間約束型・従CTAを成果型の文言へ変更
              （リンク先・計測イベント(location="hero")・UTM引き継ぎは不変）。 */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#demo"
                className={buttonClass({ variant: 'primary', size: 'lg', className: 'whitespace-normal text-center' })}
              >
                30秒で答え方を見る
                <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
              {/* 2026-07-28 CTO修正（L1監査#7）: 「1分で自社リスク診断」は診断が
                  その場で始まるかのような文言だったが、実際はここから登録フォーム
                  (/signup)への遷移のみで、診断自体は登録後の5問（オンボーディング）
                  で行われる。実態（登録して診断に進む）に即した文言へ修正する
                  （リンク先・計測location="hero"は不変）。 */}
              <TrackedCTA
                location="hero"
                className={buttonClass({ variant: 'ghost', size: 'lg', className: 'whitespace-normal text-center' })}
              >
                無料登録して1分でリスク診断
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TrackedCTA>
            </div>
            {/* 2026-07-23 A06: リスクリバーサル1行。この登録不要デモ体験自体は
                会社登録前のセルフ点検ツールで課金と無関係。全削除可は削除自己サーブと整合する事実。 */}
            <p className="mt-3 text-center text-xs text-neutral-500 lg:text-left">
              登録不要で体験できます。クレジットカードも不要、預けたデータはいつでも全削除できます。
            </p>
            {/* 2026-07-24 L1(発見性): モバイルFV圏内に無料ツール・記事への明示リンク。
                ヘッダのツール/記事リンクはモバイルで畳むため、ここでFV内到達を担保する。
                目的に最も近い「登録不要の答え」（セルフ点検ツール）と、記事目的の来訪者の
                入口（労務の記事）を、離脱前に届ける。内部Linkのみ。 */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs lg:justify-start">
              <Link
                href="/tools"
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                無料ツールでセルフ点検（登録不要）
              </Link>
              <Link
                href="/roumu"
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                労務の記事を読む
              </Link>
            </div>
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
          <p className="flex items-center gap-1.5 text-xs text-neutral-600">
            <FileText className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            就業規則・36協定・賃金規程・労働条件通知書の下書きに対応
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

      {/* ===== 体験デモ（FV直下：初見客が数秒でアハに届く導線） =====
          ヒーロー主CTA「まず無料で試す（登録不要）」の着地点。scroll-mt でスティッキー
          ヘッダ(h-16)ぶんのオフセットを確保。スクリプト型デモ＝本物のAPIは叩かず用意済み
          回答をタイプ表示するクライアントコンポーネント。デモ内の signup 転換CTA
          (location="trydemo")は維持。詳細は _components/TryDemo.tsx を参照。 */}
      <div id="demo" className="scroll-mt-20">
        <TryDemoLazy />
      </div>

      {/* ===== 導入シナリオ（B02/B03の器・2026-07-23 Takeshi裁定で骨組み先行実装） =====
          データ(_lib/scenarios.ts)が空の間は何も描画しない。実在顧客の声と誤認される
          表記は使わない（詳細は _components/ScenarioSection.tsx）。 */}
      <ScenarioSection />

      {/* ===== 核の主張：汎用AI vs 番頭（ここで一度だけ強く言う） =====
          2026-07-23 B05: 静的な箇条書き2カードを、同じ質問への回答差をトグルで
          見せるインタラクティブ比較（CompareToggle）へ置換。主張でなく挙動で示す。 */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              汎用AIとの違いは「覚えているか」
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              同じ質問を、切り替えて比べてみてください。前提を聞き返されるか、前提から答えが始まるかが違いです。
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
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            覚える・答える・つくる・気づく
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            番頭の仕事はこの4つ。総務が毎回費やしていた説明・調べ物・下書きの時間を肩代わりします。
          </p>
        </div>

        {/* B04: Before/After を具体シーンで対比 */}
        <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
              <MessageSquareText className="h-4 w-4" aria-hidden />
              いままで（汎用AIと自力の調べ物）
            </p>
            <ul className="mt-4 space-y-3">
              {BEFORE_SCENES.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-600">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-white p-5 ring-1 ring-brand-100 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <BantoMark className="h-4 w-4 text-brand-600" aria-hidden />
              番頭にしてから
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
        <p className="mb-10 text-center text-xs text-neutral-400">
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
                担当者が代わる日も、会社の記憶はそのまま
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
          実機能: /company/reports の mode='sharoushi'（F5）。番頭が覚えている
          基本情報・整備済みの規程・近い期限・会社で決めた運用に相談論点を添えて
          1枚のメモへ整理し、コピーして渡せる（app/(app)/company/reports/page.tsx・
          lib/report.ts で実装確認済み。実装されていない能力は書かない）。 */}
      <section className="border-y border-neutral-200 bg-neutral-50">
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
                番頭は専門家の代わりではなく、専門家への橋渡しまでを仕事にしています。
                覚えている会社の基本情報・整備済みの規程・近づいている期限・会社で決めた運用に、
                相談したい論点を添えて1枚のメモに整理。コピーして、そのまま顧問社労士に渡せます。
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
                <p className="flex items-center gap-1.5 border-t border-neutral-200 bg-neutral-50/70 px-4 py-2.5 text-[11px] text-neutral-500">
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
                  士業の方へ — 顧問先ごとに、記憶が分かれます
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
                  士業プランでは複数の顧問先を切り替えて使え、記憶とデータは企業ごとに分離されます。
                  A社で覚えた規程や経緯がB社の回答に混ざることはなく、切り替えた瞬間から、
                  その顧問先について覚えた前提で相談の続きを始められます。
                  顧問先が「社労士に渡すメモ」で論点を整理して持ち込めば、面談は前提の確認ではなく論点から始められます。
                </p>
              </div>
              {/* 2026-07-24 I3(士業導線): 汎用signupでなく士業文脈を持たせる。
                  会社作成ゲート本体は別班実装中のため、LP側は導線(plan=shigyo)と
                  コピーのみ。顧問先ごとに記憶が分かれる士業プラン前提を上のコピーで明示。 */}
              <TrackedCTA
                location="shigyo_section"
                href="/signup?next=/company&plan=shigyo"
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
      </section>

      {/* ===== 信頼シグナル（作り手の当事者性） =====
          2026-07-23 B16: 商家の帳場格子を思わせる縦縞をCSSだけで極薄に敷く
          （画像なし・藍系#243B6Eトーン・「名前は番頭から」の物語と響き合う場所に限定）。 */}
      <section className="border-t border-neutral-200 bg-neutral-50 bg-[repeating-linear-gradient(90deg,rgba(36,59,110,0.03)_0,rgba(36,59,110,0.03)_1px,transparent_1px,transparent_32px)]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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

      {/* ===== 比較表（B18・2026-07-23） =====
          「正直な土俵」: 相手の強みも番頭の非対応も同じ表で明記する（データは
          COMPARISON_ROWS を参照。断定・誹謗・優良誤認を避ける方針もそこに記載）。 */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              手続きシステムとも、汎用AIとも役割が違います
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              それぞれに得意分野があります。番頭が担うのは「会社を覚えて、相談に自社前提で答える」の部分です。
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full min-w-[860px] border-collapse bg-white text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th scope="col" className="p-4 text-xs font-semibold text-neutral-500">
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
                      className="p-4 align-top text-xs font-semibold text-neutral-500"
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
          <p className="mt-4 text-center text-xs leading-relaxed text-neutral-400">
            2026年7月時点の各社公開情報にもとづく一般的な整理です。正確な機能・料金は各サービスの公式サイトをご確認ください。
            番頭は手続きシステムの代替ではないため、SmartHR・freee・オフィスステーションなどと併用できます。
          </p>

          {/* 2026-07-24 I4(比較検討者の不安): 「併用できます」だけでは『また全部
              入れ直すのか』が宙に浮く。置き換えない・全項目の再入力は不要・規程は
              対話で覚える、という実装どおりの事実を正直に1ブロックで補う（誇張・
              虚偽能力なし。Phase1コンプラ）。
              2026-07-29 CTO修正（L3監査#8）: 比較表の直下がすでに情報密度の高い
              セクションのため、既存システム併用者向けの補足2段落は<details>で畳み、
              関係する人だけが開く段階的開示にする（本文はDOM上に常に存在＝SEO/GEO
              への影響なし。既存のFAQアコーディオンと同じ手法）。 */}
          <details className="group mx-auto mt-8 max-w-3xl rounded-2xl border border-neutral-200 bg-neutral-50">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-6 text-sm font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-600" aria-hidden />
                すでにSmartHR・freeeなどをお使いの方へ
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-6 pb-6">
              <p className="text-sm leading-relaxed text-neutral-600">
                番頭は既存の手続きシステムを置き換えません。従業員情報や規程を、番頭にすべて入れ直す必要はありません。
                相談したい範囲の規程の要点だけを対話で覚えさせれば、自社の前提に沿った回答が得られます。
                手続き・給与関連はこれまでのツールのまま、番頭は「自社ルールの相談窓口」を1つ足す位置づけです。
              </p>
              {/* 2026-07-24 P03(勤怠ツール併用の比較検討者): 打刻データの二重入力不安を
                  登録前に解消する。チャットが固有名込みで即答している事実（勤怠はMF等に
                  入れるだけ・番頭に打刻を転記する必要はない）をLPへ焼き戻す。誇張・虚偽
                  能力なし・実挙動と一致。 */}
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                勤怠（マネーフォワード勤怠・ジョブカン・KING OF TIMEなど）とお使いの方も、打刻データを番頭に入れ直す必要はありません。
                打刻はこれまでの勤怠ツールのまま、番頭はそのルール照合・記憶・期限・書類のたたき台を足す役割です。
              </p>
            </div>
          </details>
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
              無料プランから始められます。そして番頭は、使うほど御社専用に育ちます。
            </p>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              規程や相談の記憶が貯まるほど、答えは自社の実態に近づいていきます。
              だからこそ先にお伝えします。合わないと感じたら、預けたデータごと全削除してやめられます。
              無料プランのいまが、記憶を貯め始めるいちばん良いタイミングです。
            </p>
          </div>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">料金</h2>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              登録するとまずは無料プランでお使いいただけます。下記は有料プランに切り替えた場合の月額料金です。
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
                    年払いの提供範囲は下部の注記でプラン間の表記を統一する。 */}
                {p.yearly && (
                  <p className="mt-1 text-xs text-neutral-500 tabular-nums">
                    年額 &yen;{p.yearly.toLocaleString()}（月払いより2ヶ月分お得）
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
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
            EntryとStandardは1社あたりの月額です。プランの上限人数までは、何人で使っても料金は変わりません。
            士業プランのみ、事務所の利用メンバー数に応じた席単位の課金です（顧問先は最大{PLANS.shigyo.maxCompanies}社まで）。
            年払い（月払いより2ヶ月分お得）は現在Entryプランのみのご用意で、Standardと士業プランは月払いのみです。
            {/* 2026-07-28 CTO修正（L2監査#2）: 複数店舗の扱いを料金セクション直下にも明記する。 */}
            複数店舗をお持ちの場合は、1社の契約にまとめて店舗ごとの前提を登録する方法と、
            士業プランの複数会社管理機能で店舗ごとに記憶を分ける方法のどちらも選べます（詳しくは下のFAQをご覧ください）。
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
          {/* 2026-07-23 B10: アコーディオン化（native <details>・JS不要）。初期表示は
              先頭3問のみで、残りは「すべての質問を見る」で展開。全問のテキストは
              閉じていても常にDOM上に存在し、FAQPage構造化データも全問を維持する。 */}
          <div className="space-y-3">
            {FAQ.slice(0, 3).map(item => (
              <details
                key={item.q}
                className="group rounded-2xl border border-neutral-200 bg-white"
              >
                <summary className="flex cursor-pointer select-none items-center justify-between gap-3 p-5 text-base font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">
                  {item.a}
                </p>
              </details>
            ))}

            <details className="group">
              <summary className="flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
                すべての質問を見る（あと{FAQ.length - 3}問）
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="mt-3 space-y-3">
                {FAQ.slice(3).map(item => (
                  <details
                    key={item.q}
                    className="group/item rounded-2xl border border-neutral-200 bg-white"
                  >
                    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 p-5 text-base font-semibold text-neutral-900 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open/item:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-neutral-600">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </details>
          </div>

          {/* 2026-07-29 CTO修正（L3監査#7）: 本文・FAQ・体験デモに前提知識として
              出てくる労務用語を、初めて読む方向けに簡潔に補足する（軽い段階的開示・
              アコーディオンで畳み、情報密度を上げすぎない）。 */}
          <details className="group mt-8 rounded-2xl border border-neutral-200 bg-white">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 p-5 text-sm font-semibold text-neutral-700 [&::-webkit-details-marker]:hidden">
              はじめて読む方へ — よく出てくる労務用語の補足
              <ChevronDown
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <dl className="space-y-3 px-5 pb-5">
              {JARGON.map(j => (
                <div key={j.term}>
                  <dt className="text-sm font-semibold text-neutral-900">{j.term}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-neutral-600">{j.body}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </section>

      {/* ===== 構造化データ（rich results 適格化）=====
          FAQPage は上の可視FAQと対。Organization=KIZUNA Creation。
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
                name: '番頭（会社を覚える労務AI）',
                item: 'https://banto-roumu.com/business',
              },
            ],
          }),
        }}
      />

      {/* ===== 今日やることチェックリスト（B11・2026-07-23） =====
          最終CTAの直前で「登録→5問→1相談」の最初の一歩を具体化し、
          登録後に何をすればよいか分からない不安を先に解消する。 */}
      <section className="mx-auto max-w-3xl px-6 pt-20">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-neutral-900">
            今日やることは、3つだけ
          </h2>
          <ol className="mt-6 grid min-w-0 gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: '無料で会社を登録', body: 'メールアドレスだけで始められます。クレジットカードは不要です。' },
              { step: '2', title: '気になる質問を5つ', body: '残業・有給・規程など、いつも調べていたことをそのまま聞いてみてください。' },
              { step: '3', title: '重い悩みを1件相談', body: 'いちばん気がかりな1件を相談。明日の番頭は、今日の続きを覚えています。' },
            ].map(item => (
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
            自社を覚えるAIを、今日から
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            会社を登録して、最初の相談を投げてみてください。今日話したことを、番頭は明日も覚えています。
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
              無料で会社を登録して試す
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
        <p className="mb-4 text-center text-xs font-medium text-neutral-400">
          代表的な使い方から見る
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {USECASE_LIST.slice(0, 5).map((u) => (
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
            使い方の一覧をすべて見る
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
                <BantoMark className="h-3.5 w-3.5" aria-hidden />
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
            © {new Date().getFullYear()} 番頭(Banto)（KIZUNA Creation）
          </p>
        </div>
      </footer>
    </div>
  )
}
