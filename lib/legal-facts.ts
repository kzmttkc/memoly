// ============================================================================
// legal-facts.ts — 出典付き「確定法令ファクト」ベース（CEO裁定 2026-06-27）
//
//   目的:
//     番頭（縦SaaS「会社を覚える労務AI」）の差別化の本丸は「最新法令ファクト精度＋
//     citation＋信頼担保」。Difyナレッジはコモディティ。固い法令数値は、ここに
//     TypeScript型付き定数で出典つきで持ち、sonnet の system prompt に【確定ファクト】
//     として注入する（LLMの記憶任せ＝捏造リスクを排する）。
//
//   収録方針（厳守）:
//     - 一次情報で確定している値のみ。曖昧・年度/地域で変動する値は安易に固定しない。
//     - 都道府県・年度で変動するもの（健康保険料率/雇用保険料率/最低賃金）は、ここに
//       確定値として入れず、LLMに「最新は要確認」と言わせる設計にする（VARIABLE_FACT_NOTES）。
//     - 各値に sourceName / sourceUrl / effectiveDate を必ず付ける。
//
//   ※ SHAKAIHOKEN_SIM / KYUYO_CHECK の Dify 照会を fact ルートから外した穴は、
//     ここの確定値（厚生年金料率・36協定上限・税制改正）＋「変動は要確認」で埋める。
// ============================================================================

export interface LegalFact {
  /** 内部キー（安定識別子）。 */
  key: string
  /** 表示ラベル（プロンプト・UIで使う日本語名）。 */
  label: string
  /** 確定値（数値または規則の要約文字列）。 */
  value: string
  /** 単位（任意。% や 時間 など）。 */
  unit?: string
  /** 出典名（一次情報の発行元）。 */
  sourceName: string
  /** 出典URL（一次情報）。 */
  sourceUrl: string
  /** 施行日・適用時点（YYYY-MM-DD or 年度表記）。 */
  effectiveDate: string
  /** 補足（変動性・暫定措置などの注記）。 */
  note?: string
}

// ----------------------------------------------------------------------------
// トピックキー（DifyルートやチャットのキーワードからこのIDへ寄せる）。
// ----------------------------------------------------------------------------
export type LegalFactTopic =
  | 'tax_reform_2025' // 令和7年度税制改正（年収の壁）
  | 'overtime_36' // 36協定の時間外上限
  | 'pension_rate' // 厚生年金保険料率

// ----------------------------------------------------------------------------
// 確定ファクト（一次情報のみ）。
//   reference_2025_tax_reform.md（国税庁・令和7年12月1日施行・令和7年分以後適用）と
//   数値を一致させている。
// ----------------------------------------------------------------------------
export const LEGAL_FACTS: LegalFact[] = [
  // --- 令和7年度税制改正（年収の壁見直し）---
  {
    key: 'kyuyo_shotoku_kojo_min',
    label: '給与所得控除の最低額',
    value: '55万円 → 65万円（給与収入190万円以下は一律65万円）',
    sourceName: '国税庁 令和7年度税制改正（基礎控除・給与所得控除の見直し）',
    sourceUrl: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm',
    effectiveDate: '2025-12-01（令和7年分以後の所得税に適用）',
    note: '令和7年12月1日施行。令和8年分も適用中。',
  },
  {
    key: 'kiso_kojo_shotokuzei',
    label: '基礎控除（所得税）',
    value:
      '48万円 → 合計所得に応じ 95万/88万/68万/63万/58万円（合計所得132万以下=95万、132超336以下=88万、336超489以下=68万、489超655以下=63万、655超2350以下=58万）',
    sourceName: '国税庁 令和7年度税制改正（基礎控除の見直し）',
    sourceUrl: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm',
    effectiveDate: '2025-12-01（令和7年分以後の所得税に適用）',
    note: '95/88/68/63万は令和7・8年分のみの暫定。令和9年分以降は2350万以下一律58万。住民税の基礎控除は43万で据置（改正対象外）。',
  },
  {
    key: 'fuyo_goukei_shotoku_youken',
    label: '扶養・同一生計配偶者の合計所得要件',
    value: '48万円 → 58万円以下（給与のみなら年収123万円まで＝旧103万の壁の後継）',
    sourceName: '国税庁 令和7年度税制改正',
    sourceUrl: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm',
    effectiveDate: '2025-12-01（令和7年分以後の所得税に適用）',
    note: '「本人が所得税を払い始める＝年収160万（65万+95万）」と「扶養に入れる側＝123万」は別ライン。混同注意。社会保険の106万・130万の壁は税制改正と別系統で存続。',
  },

  // --- 36協定の時間外労働の上限 ---
  {
    key: 'overtime_gensoku',
    label: '時間外労働の上限（原則）',
    value: '月45時間・年360時間',
    sourceName: '労働基準法第36条／厚生労働省（時間外労働の上限規制）',
    sourceUrl:
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000148322_00001.html',
    effectiveDate: '2019-04-01（中小企業は2020-04-01から適用）',
  },
  {
    key: 'overtime_tokubetsu',
    label: '時間外労働の上限（特別条項つき）',
    value:
      '年720時間以内・複数月平均80時間以内（休日労働含む）・単月100時間未満（休日労働含む）・月45時間を超えられるのは年6回まで',
    sourceName: '労働基準法第36条／厚生労働省（時間外労働の上限規制）',
    sourceUrl:
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000148322_00001.html',
    effectiveDate: '2019-04-01（中小企業は2020-04-01から適用）',
    note: '36協定の締結・届出が無いまま時間外労働をさせる状態は違法のおそれが高い。',
  },

  // --- 厚生年金保険料率（固定）---
  {
    key: 'kosei_nenkin_rate',
    label: '厚生年金保険料率',
    value: '18.3%（労使折半。被保険者負担は9.15%）',
    unit: '%',
    sourceName: '日本年金機構（厚生年金保険料額表・保険料率）',
    sourceUrl:
      'https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html',
    effectiveDate: '2017-09（平成29年9月以降固定）',
    note: '段階的引上げが2017年9月に上限到達し、以後18.3%で固定。',
  },
]

// ----------------------------------------------------------------------------
// 変動する値（ここに確定値は入れない）。LLMに「最新は要確認」と言わせるための注記。
//   健康保険料率（協会けんぽは都道府県別・毎年度改定）／雇用保険料率（年度で改定）／
//   最低賃金（都道府県別・毎年10月改定）など。
// ----------------------------------------------------------------------------
export const VARIABLE_FACT_NOTES: string[] = [
  '健康保険料率（協会けんぽ）は都道府県別かつ毎年度改定されるため、確定値を断定しない。最新は協会けんぽ等で要確認。',
  '雇用保険料率は年度ごとに改定されるため、確定値を断定しない。最新は厚生労働省で要確認。',
  '最低賃金は都道府県別かつ毎年10月頃に改定されるため、確定値を断定しない。最新は厚生労働省／各都道府県労働局で要確認。',
  '割増賃金率のうち、月60時間超の時間外は50%（中小企業も2023年4月から適用）。深夜・休日割増などの組み合わせは個別確認が必要。',
]

// ----------------------------------------------------------------------------
// トピック → 該当する確定ファクトの key 群（チャットの質問内容から関連facts を選ぶ）。
// ----------------------------------------------------------------------------
const TOPIC_TO_FACT_KEYS: Record<LegalFactTopic, string[]> = {
  tax_reform_2025: [
    'kyuyo_shotoku_kojo_min',
    'kiso_kojo_shotokuzei',
    'fuyo_goukei_shotoku_youken',
  ],
  overtime_36: ['overtime_gensoku', 'overtime_tokubetsu'],
  pension_rate: ['kosei_nenkin_rate'],
}

// 質問本文から確定ファクトのトピックを推定するためのキーワード。
const TOPIC_KEYWORDS: Record<LegalFactTopic, string[]> = {
  tax_reform_2025: [
    '年収の壁', '103万', '106万', '123万', '130万', '160万', '扶養', '配偶者控除',
    '配偶者特別控除', '基礎控除', '給与所得控除', '所得税', '年末調整', '税制改正',
  ],
  overtime_36: [
    '36協定', '三六協定', '時間外', '残業', '上限規制', '特別条項', '36条',
  ],
  pension_rate: [
    '厚生年金', '社会保険料', '保険料率', '年金保険料', '標準報酬',
  ],
}

/** key 指定で確定ファクトを引く（無ければ undefined）。 */
export function getLegalFact(key: string): LegalFact | undefined {
  return LEGAL_FACTS.find(f => f.key === key)
}

/** トピック指定で確定ファクト群を引く。 */
export function getFactsByTopic(topic: LegalFactTopic): LegalFact[] {
  return (TOPIC_TO_FACT_KEYS[topic] ?? [])
    .map(getLegalFact)
    .filter((f): f is LegalFact => !!f)
}

/**
 * 質問本文から関連する確定ファクトを選ぶ。
 * キーワードに一致したトピックの facts を重複なく束ねて返す（無ければ空配列）。
 */
export function selectFactsForQuery(query: string): LegalFact[] {
  if (!query) return []
  const picked: LegalFact[] = []
  const seen = new Set<string>()
  for (const topic of Object.keys(TOPIC_KEYWORDS) as LegalFactTopic[]) {
    if (TOPIC_KEYWORDS[topic].some(kw => query.includes(kw))) {
      for (const f of getFactsByTopic(topic)) {
        if (!seen.has(f.key)) {
          seen.add(f.key)
          picked.push(f)
        }
      }
    }
  }
  return picked
}

/**
 * 確定ファクト群を system prompt 用の【確定ファクト】ブロックに整形する。
 *   各値に出典名＋施行日を併記し、項目2の citation を本物の出典で埋められるようにする。
 *   facts が空なら空文字（ブロックを付けない）。
 */
export function formatFactsBlock(facts: LegalFact[]): string {
  if (!facts.length) return ''
  const lines = facts.map(f => {
    const unit = f.unit ? `（単位: ${f.unit}）` : ''
    const note = f.note ? `\n  補足: ${f.note}` : ''
    return `- ${f.label}: ${f.value}${unit}\n  出典: ${f.sourceName}（施行/適用: ${f.effectiveDate}）\n  出典URL: ${f.sourceUrl}${note}`
  })
  const variable = VARIABLE_FACT_NOTES.map(n => `- ${n}`).join('\n')
  return `\n\n【確定ファクト（一次情報・これ以外の固い法令数値は創作しない）】
以下は出典つきの確定値です。固い法令数値はこの確定ファクトのみを使い、無い数値は「最新は要確認」と述べて創作しないでください。回答の【根拠】には、ここで使った確定ファクトの出典名＋施行日を明記してください。
${lines.join('\n')}

【変動する値（確定値を断定せず「要確認」と述べる）】
${variable}`
}
