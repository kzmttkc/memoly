import type { CompanyAttributesValues, CompanyContext } from '@/lib/company'
import { INDUSTRY_MAJORS, EMPLOYEE_BANDS } from '@/lib/company-attributes'

// ============================================================================
// report.ts — F6「経営者向け1枚報告」の決定的アセンブラ（LLM非依存）
// ----------------------------------------------------------------------------
//   目的（看板「会社を覚える」と実体の一致）:
//     番頭が覚えている会社データ（属性・規程・期限・過去の判断）を、経営者が
//     1枚で把握できる要約に組み立てる。核心は「事実はコード側で組み立て、
//     数値・期限・規程名を創作しない」こと。LLM は体裁を整える役に留める
//     （lib/report.ts は事実の骨格＝ハルシネーションの入る余地を持たない）。
//
//   Phase1コンプラ（設計の要）:
//     - 断定・命令・診断をしない。中立の「整理」に徹する。
//     - 未登録の項目は正直に「未登録」と書く（捏造しない・埋めない）。
//     - 期日(due_on)はユーザーが確定したものだけを載せる。システムは日付を断定しない。
//     - 禁止語（——／皆さん／絶対／とても／結論から言う／markdown太字）を出さない。
//     - 敬体（です・ます）。「あなた」を多用しない。
//
//   deadlines.ts / company-attributes.ts と同じ流儀＝集計/整形の純度（DB非依存・LLM非依存）。
// ============================================================================

/** 1枚報告の入力（各ソースは呼び出し側=route が取得して渡す）。 */
export interface ReportInput {
  companyName: string
  attrs: CompanyAttributesValues
  context: CompanyContext
  /** 取込済み規程の軽量メタ（company_documents の一覧・title/件数用）。 */
  documents: { title: string; docType: string | null; updatedAt: string }[]
  /** 直近の期限（company_deadlines の due_on 昇順・今日以降のみを route が絞って渡す）。 */
  deadlines: { title: string; dueOn: string; note: string | null }[]
  /** 生成基準日（YYYY-MM-DD・route が JST で確定して渡す）。 */
  today: string
}

/** 属性の日本語ラベル（company-attributes.ts の定義を人が読む形に写す）。 */
const INDUSTRY_LABEL = new Map<string, string>(INDUSTRY_MAJORS.map(i => [i.code, i.label]))
const EMPLOYEE_BAND_LABEL: Record<string, string> = {
  '1-4': '1〜4人',
  '5-9': '5〜9人',
  '10-29': '10〜29人',
  '30-49': '30〜49人',
  '50-99': '50〜99人',
  '100+': '100人以上',
}

/** 三値（true/false/null）を「あり／なし／未登録」に写す。null は正直に「未登録」。 */
function triLabel(v: boolean | null): string {
  if (v === true) return 'あり'
  if (v === false) return 'なし'
  return '未登録'
}

/** industry_major コードを日本語ラベルへ。未登録/未知コードは「未登録」。 */
function industryLabel(code: string | null): string {
  if (!code) return '未登録'
  return INDUSTRY_LABEL.get(code) ?? '未登録'
}

/** employee_band を人が読むラベルへ。未登録は「未登録」。 */
function employeeLabel(band: string | null): string {
  if (!band) return '未登録'
  return EMPLOYEE_BAND_LABEL[band] ?? '未登録'
}

/** YYYY-MM-DD → 「YYYY年M月D日」。不正値はそのまま返す（route 側で妥当性は担保済み）。 */
function jpDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return dateStr
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}

/** today（含む）から due_on までの残日数。負値は経過を表す（route は今日以降のみ渡す想定）。 */
function daysUntil(today: string, dueOn: string): number | null {
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${dueOn}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/** 登録済みの規程タイトルを正規化した集合（相談論点の突き合わせに使う・小文字化＋前後空白除去）。 */
function docTitleSet(documents: { title: string }[]): Set<string> {
  return new Set(documents.map(d => (d.title ?? '').trim()))
}

/** タイトル群に、指定キーワードのいずれかを含む規程があるか（部分一致・素朴な突き合わせ）。 */
function hasDocMatching(titles: Set<string>, keywords: string[]): boolean {
  for (const t of titles) {
    for (const k of keywords) {
      if (t.includes(k)) return true
    }
  }
  return false
}

/**
 * 「まだ番頭に教えていない項目」を導く（未登録の属性＝次に埋めると価値が出る点）。
 *   null（未回答）のみを対象にする。false（明示的に「ない」）は登録済みなので出さない。
 *   捏造・断定をしないため、中立の「登録すると整理が進みます」トーンのラベルで返す。
 */
export function unansweredAttributeHints(attrs: CompanyAttributesValues): string[] {
  const hints: string[] = []
  if (attrs.industry_major === null) hints.push('業種')
  if (attrs.employee_band === null) hints.push('従業員規模')
  if (attrs.has_36kyotei === null) hints.push('36協定の有無')
  if (attrs.has_work_rules === null) hints.push('就業規則の有無')
  if (attrs.has_fixed_ot === null) hints.push('固定残業代の有無')
  return hints
}

/**
 * 1枚報告の本文（Markdown）を決定的に組み立てる。LLM を一切呼ばない。
 *   ここで作る text が「事実の骨格」であり、数値・期限・規程名はすべてこの層で確定する。
 *   route はこの text をそのまま返すか、LLM に前書き/むすびだけを足して返す（事実は不可変）。
 */
export function buildReportBody(input: ReportInput): string {
  const { companyName, attrs, context, documents, deadlines, today } = input
  const lines: string[] = []

  lines.push(`# ${companyName} 経営者向けまとめ（${jpDate(today)}時点）`)
  lines.push('')
  lines.push('番頭が覚えている会社の情報を、1枚で見渡せるように整理しました。数値や期限は登録済みの内容にもとづいています。未登録の項目は「未登録」と表示しています。')
  lines.push('')

  // --- 1. 会社の基本情報（登録済みのものだけ・未登録は正直に表示） ---
  lines.push('## 会社の基本情報')
  lines.push(`- 業種：${industryLabel(attrs.industry_major)}`)
  lines.push(`- 従業員規模：${employeeLabel(attrs.employee_band)}`)
  lines.push(`- 36協定：${triLabel(attrs.has_36kyotei)}`)
  lines.push(`- 就業規則：${triLabel(attrs.has_work_rules)}`)
  lines.push(`- 固定残業代：${triLabel(attrs.has_fixed_ot)}`)
  // 自社ルール（company_profiles）が登録されていれば件数と一部を添える。
  if (context.profiles.length) {
    lines.push(`- 登録済みの自社ルール：${context.profiles.length}件`)
    for (const p of context.profiles.slice(0, 6)) {
      lines.push(`  - ${p.key}：${p.value}`)
    }
    if (context.profiles.length > 6) {
      lines.push(`  - ほか${context.profiles.length - 6}件`)
    }
  } else {
    lines.push('- 登録済みの自社ルール：未登録')
  }
  lines.push('')

  // --- 2. 覚えている規程（company_documents のタイトル一覧・件数） ---
  lines.push('## 番頭が覚えている規程')
  if (documents.length) {
    lines.push(`登録済みの規程は${documents.length}件です。`)
    for (const d of documents.slice(0, 10)) {
      // docType がタイトルと同じ場合は「就業規則（就業規則）」の冗長を避けて括弧を省く。
      const type = d.docType && d.docType !== d.title ? `（${d.docType}）` : ''
      lines.push(`- ${d.title}${type}`)
    }
    if (documents.length > 10) {
      lines.push(`- ほか${documents.length - 10}件`)
    }
  } else {
    lines.push('まだ規程は登録されていません。就業規則などを取り込むと、相談の際に原文を参照した回答ができるようになります。')
  }
  lines.push('')

  // --- 3. 近づいている労務期限（F4連携＝目玉。today 以降・route が昇順で渡す） ---
  lines.push('## 近づいている労務の期限')
  if (deadlines.length) {
    lines.push('登録済みの期限のうち、期日が近いものから並べています。')
    for (const dl of deadlines.slice(0, 6)) {
      const d = daysUntil(today, dl.dueOn)
      const remain = d === null ? '' : d === 0 ? '（本日）' : d > 0 ? `（あと${d}日）` : ''
      const note = dl.note ? `　${dl.note}` : ''
      lines.push(`- ${jpDate(dl.dueOn)}　${dl.title}${remain}${note}`)
    }
  } else {
    lines.push('登録済みの期限はまだありません。労働保険の年度更新や年末調整など、毎年巡ってくる期限を登録しておくと、近づいたときにお知らせできます。')
  }
  lines.push('')

  // --- 4. 最近の相談・決定の要約（decisions があれば・無ければ省略） ---
  if (context.decisions.length) {
    lines.push('## 最近の判断の記録')
    lines.push('過去に番頭に相談して決めた内容のうち、新しいものから並べています。')
    for (const dec of context.decisions.slice(0, 5)) {
      const topic = dec.topic ? `［${dec.topic}］` : ''
      lines.push(`- ${topic}${dec.summary}`)
    }
    lines.push('')
  }

  // 対象者ごとの状況（peopleSituations があれば・担当交代でも残る記憶）。
  if (context.peopleSituations.length) {
    lines.push('## 対象者ごとの記録')
    for (const person of context.peopleSituations.slice(0, 5)) {
      lines.push(`- ${person.subject}：${person.notes.slice(0, 2).join(' / ')}`)
    }
    lines.push('')
  }

  // --- 5. 次に登録するとよい項目（未登録の属性＝埋めると整理が進む） ---
  const hints = unansweredAttributeHints(attrs)
  if (hints.length) {
    lines.push('## 次に登録するとよい項目')
    lines.push('以下はまだ番頭に登録されていません。登録すると、この1枚まとめや相談の精度が上がります。')
    for (const h of hints) {
      lines.push(`- ${h}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

// ============================================================================
// F5「社労士連携メモ」の決定的アセンブラ（LLM非依存）
// ----------------------------------------------------------------------------
//   読み手はF6（経営者本人）と違い「会社が相談する社労士（プロ）」。目的は
//   「相談の往復を減らす下準備」＝会社の状況を過不足なく整理して手渡すこと。
//   F6と同じ硬化パターン: 事実（数値・期限・規程名・属性）はこの層でコード確定し、
//   LLM は前書き/むすびの短文しか触れない（route が intro＋body＋outro を連結）。
//
//   Phase1コンプラ（F6と同一）: 番頭が「社労士監修/AI社労士/法的精度」を名乗らない。
//     このメモは「会社が自分の社労士に渡す自社まとめ」であり、番頭が社労士を名乗る文面を
//     一切書かない。断定/命令/診断をしない。未登録は正直に「未登録」。禁止語0・敬体。
// ============================================================================

/**
 * 「社労士に相談したい未解決の論点」を決定的ルールで抽出する（断定しない・中立の確認事項）。
 *   ・未登録の重要属性（36協定/就業規則/固定残業代/業種/規模）＝プロに伝えるべき前提の欠落。
 *   ・「規模的に就業規則が要る可能性の目安（10人以上）」なのに就業規則が「なし/未登録」。
 *   ・36協定が「なし/未登録」なのに時間外労働が想定される規模（＝確認したい典型論点）。
 *   ・期日が近い（30日以内）のに、その分野の規程が見当たらない期限。
 *   すべて「確認したいこと」＝会社側が社労士に問う候補として列挙する。要否は判断しない。
 */
export function sharoushiConsultPoints(input: {
  attrs: CompanyAttributesValues
  documents: { title: string }[]
  deadlines: { title: string; dueOn: string }[]
  today: string
}): string[] {
  const { attrs, documents } = input
  const points: string[] = []
  const titles = docTitleSet(documents)

  // 1) 未登録の重要属性＝プロに前提を伝えるうえで埋めたい欠落（中立の確認候補）。
  if (attrs.industry_major === null) points.push('業種が未登録です。業種による適用の違いを相談したい場合に伝える前提として確認したい項目です。')
  if (attrs.employee_band === null) points.push('従業員規模が未登録です。規模で変わる義務（就業規則の作成義務など）を相談する前提として確認したい項目です。')
  if (attrs.has_36kyotei === null) points.push('36協定の有無が未登録です。時間外・休日労働の運用について相談する前提として確認したい項目です。')
  if (attrs.has_work_rules === null) points.push('就業規則の有無が未登録です。整備状況を相談する前提として確認したい項目です。')
  if (attrs.has_fixed_ot === null) points.push('固定残業代の有無が未登録です。割増賃金の設計を相談する前提として確認したい項目です。')

  // 2) 規模が10人以上（10-29/30-49/50-99/100+）なのに就業規則が「なし/未登録」＝典型論点。
  const bandsWith10Plus = new Set(['10-29', '30-49', '50-99', '100+'])
  if (
    attrs.employee_band !== null &&
    bandsWith10Plus.has(attrs.employee_band) &&
    attrs.has_work_rules !== true &&
    !hasDocMatching(titles, ['就業規則'])
  ) {
    points.push('従業員規模が10人以上で、就業規則が「あり」として登録・整備されていません。就業規則の整備状況について相談したい項目です。')
  }

  // 3) 36協定が「なし/未登録」で、36協定に相当する規程も見当たらない＝時間外運用の確認候補。
  if (attrs.has_36kyotei !== true && !hasDocMatching(titles, ['36協定', '三六協定', '時間外'])) {
    points.push('36協定が「あり」として登録・整備されていません。時間外・休日労働の運用と届出について相談したい項目です。')
  }

  // 近い期限は上の「近づいている労務の期限」セクションに既出のため、論点では再掲しない。
  //   （旧ルール4=期限タイトルとdoc名の語一致は粗く、ほぼ全期限を拾ってボイラープレート化し、
  //     同じ36協定等が何度も並ぶ＝機械生成臭を生んでいた。2026-07-03 ドッグフードで是正。）
  //   論点は「登録/整備の欠落」に絞る＝社労士に伝えるべき固有情報に限定する。

  return points
}

/** F5メモの入力（F6 ReportInput と同型・route が同じ5ソースから取得して渡す）。 */
export type SharoushiMemoInput = ReportInput

/**
 * F5「社労士連携メモ」本文（Markdown）を決定的に組み立てる。LLM を一切呼ばない。
 *   会社が社労士に渡す前提で、基本情報・整備済み規程・近い期限・自社で決めた運用・
 *   「相談したい論点」を過不足なく整理する。数値/期限/規程名/属性はこの層で確定する。
 */
export function buildSharoushiMemoBody(input: SharoushiMemoInput): string {
  const { companyName, attrs, context, documents, deadlines, today } = input
  const lines: string[] = []

  lines.push(`# ${companyName} 社労士相談メモ（${jpDate(today)}時点）`)
  lines.push('')
  lines.push('社労士に相談・引き継ぎをする際にお渡しする、会社側の下準備メモです。番頭が覚えている登録済みの情報を整理しています。未登録の項目は「未登録」と表示しています。相談の往復を減らすための整理資料であり、対応の要否はこのメモでは判断していません。')
  lines.push('')

  // --- 1. 会社の基本情報（登録済みのみ・未登録は正直に） ---
  lines.push('## 会社の基本情報')
  lines.push(`- 業種：${industryLabel(attrs.industry_major)}`)
  lines.push(`- 従業員規模：${employeeLabel(attrs.employee_band)}`)
  lines.push(`- 36協定：${triLabel(attrs.has_36kyotei)}`)
  lines.push(`- 就業規則：${triLabel(attrs.has_work_rules)}`)
  lines.push(`- 固定残業代：${triLabel(attrs.has_fixed_ot)}`)
  if (context.profiles.length) {
    lines.push(`- 登録済みの自社ルール：${context.profiles.length}件`)
    for (const p of context.profiles.slice(0, 8)) {
      lines.push(`  - ${p.key}：${p.value}`)
    }
    if (context.profiles.length > 8) {
      lines.push(`  - ほか${context.profiles.length - 8}件`)
    }
  } else {
    lines.push('- 登録済みの自社ルール：未登録')
  }
  lines.push('')

  // --- 2. 整備済みの規程一覧（company_documents のタイトル） ---
  lines.push('## 整備済みの規程')
  if (documents.length) {
    lines.push(`登録・取込済みの規程は${documents.length}件です。`)
    for (const d of documents.slice(0, 20)) {
      // docType がタイトルと同じ場合は「就業規則（就業規則）」の冗長を避けて括弧を省く。
      const type = d.docType && d.docType !== d.title ? `（${d.docType}）` : ''
      lines.push(`- ${d.title}${type}`)
    }
    if (documents.length > 20) {
      lines.push(`- ほか${documents.length - 20}件`)
    }
  } else {
    lines.push('登録・取込済みの規程はまだありません。')
  }
  lines.push('')

  // --- 3. 近づいている労務期限（F4連携・today 以降を route が昇順で渡す） ---
  lines.push('## 近づいている労務の期限')
  if (deadlines.length) {
    lines.push('登録済みの期限のうち、期日が近いものから並べています。')
    for (const dl of deadlines.slice(0, 6)) {
      const d = daysUntil(today, dl.dueOn)
      const remain = d === null ? '' : d === 0 ? '（本日）' : d > 0 ? `（あと${d}日）` : ''
      const note = dl.note ? `　${dl.note}` : ''
      lines.push(`- ${jpDate(dl.dueOn)}　${dl.title}${remain}${note}`)
    }
  } else {
    lines.push('登録済みの期限はまだありません。')
  }
  lines.push('')

  // --- 4. 会社側で既に決めた運用・判断の記録（decisions があれば） ---
  if (context.decisions.length) {
    lines.push('## 会社側で決めている運用・判断')
    lines.push('過去に会社側で決めた内容のうち、新しいものから並べています。')
    for (const dec of context.decisions.slice(0, 8)) {
      const topic = dec.topic ? `［${dec.topic}］` : ''
      lines.push(`- ${topic}${dec.summary}`)
    }
    lines.push('')
  }

  // 対象者ごとの状況（peopleSituations があれば・担当交代でも残る記憶）。
  if (context.peopleSituations.length) {
    lines.push('## 対象者ごとの状況')
    for (const person of context.peopleSituations.slice(0, 5)) {
      lines.push(`- ${person.subject}：${person.notes.slice(0, 2).join(' / ')}`)
    }
    lines.push('')
  }

  // --- 5. 社労士に相談したい論点（決定的抽出・断定しない確認事項） ---
  const points = sharoushiConsultPoints({ attrs, documents, deadlines, today })
  lines.push('## 社労士に相談したい論点')
  if (points.length) {
    lines.push('以下は、登録内容から会社側で確認したい候補として整理したものです。要否や対応はこのメモでは判断していません。相談時にご確認ください。')
    for (const p of points) {
      lines.push(`- ${p}`)
    }
  } else {
    lines.push('登録内容からは、特に確認したい論点は自動では抽出されませんでした。相談したい内容があれば、このメモに書き足してお渡しください。')
  }
  lines.push('')

  return lines.join('\n').trim()
}
