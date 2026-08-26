// ============================================================================
// company-attributes.ts — 集合知モート用「正規化属性」の SSOT（決定的・LLM非依存）
// ----------------------------------------------------------------------------
//   #5集合知ベンチマーク（同業◯%が対応済 等）は「業種×規模×制度有無」の
//   決定的フィールドでしか組めない。自由形式 company_profiles では集計不能なので、
//   集約専用の正規化属性（supabase/collective_intelligence.sql の company_attributes）を
//   構造化ウィザードで取る。その選択肢・検証をここに一元化する。
//
//   設計方針:
//     - ドロップダウン/トグルのみ＝ユーザーの自由入力もLLM抽出も介在させない（集計の純度）。
//     - 制度有無は「三値」: true=ある / false=ない / null=未回答。
//       null を false と取り違えない（誤集計＝間違ったベンチマークは信頼を壊す）。
//     - 値は DB の CHECK 制約と1対1に一致させる（DB が最終防衛線）。
// ============================================================================

// JSIC（日本標準産業分類）大分類 A〜T。company_attributes.industry_major の CHECK と一致。
//   ★DB CHECK は大分類コード（1文字）で固定＝集合知ベンチマーク（業種×規模）の集計単位。
//     造園業・電気工事業・運送業などの中分類を新コードとして足すと CHECK 変更（migration）と
//     集計粒度の破壊になるため、コードは増やさない。代わりに examples で「自分の業種が
//     どの大分類か」を選択時に示し、誤選択（P03: 電気工事→F, P09: 造園→迷い）を防ぐ。
//   examples: ドロップダウンの選択肢テキストにのみ併記する補助（label 自体は据え置き＝
//     プロフィール要約バー等の1行表示は簡潔に保つ）。
export const INDUSTRY_MAJORS = [
  { code: 'A', label: '農業・林業', examples: '農業・造園の植木/緑化のうち農業分野 ほか' },
  { code: 'B', label: '漁業' },
  { code: 'C', label: '鉱業・採石業・砂利採取業' },
  { code: 'D', label: '建設業', examples: '造園業・電気工事業・とび・大工・管/設備工事 など' },
  { code: 'E', label: '製造業' },
  { code: 'F', label: '電気・ガス・熱供給・水道業', examples: '電力・ガス・水道の事業者。電気工事業は「建設業」' },
  { code: 'G', label: '情報通信業' },
  { code: 'H', label: '運輸業・郵便業', examples: '運送業・トラック・タクシー・バス・倉庫・郵便 など' },
  { code: 'I', label: '卸売業・小売業' },
  { code: 'J', label: '金融業・保険業' },
  { code: 'K', label: '不動産業・物品賃貸業' },
  { code: 'L', label: '学術研究・専門・技術サービス業' },
  { code: 'M', label: '宿泊業・飲食サービス業' },
  { code: 'N', label: '生活関連サービス業・娯楽業', examples: '理美容・クリーニング・冠婚葬祭・娯楽 など' },
  { code: 'O', label: '教育・学習支援業' },
  { code: 'P', label: '医療・福祉', examples: '病院・診療所・介護・保育・障害福祉 など' },
  { code: 'Q', label: '複合サービス事業' },
  { code: 'R', label: 'サービス業（他に分類されないもの）', examples: '警備・ビル管理・整備・産業廃棄物処理 など' },
  { code: 'S', label: '公務（他に分類されるものを除く）' },
  { code: 'T', label: '分類不能の産業' },
] as const

export type IndustryMajor = (typeof INDUSTRY_MAJORS)[number]['code']

const INDUSTRY_CODE_SET = new Set<string>(INDUSTRY_MAJORS.map(i => i.code))

// 従業員規模バンド。company_attributes.employee_band の CHECK と一致。
export const EMPLOYEE_BANDS = ['1-4', '5-9', '10-29', '30-49', '50-99', '100+'] as const
export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number]
const EMPLOYEE_BAND_SET = new Set<string>(EMPLOYEE_BANDS)

// 制度有無の三値設問（ウィザードのトグル群）。key は DB 列名に一致させる。
//   help 文言は最優先ペルソナ「総務をお一人で担当している方」（E09）に合わせる:
//   前任者から引き継いだ書類しか手がかりがない前提で、「ある/ない」の判断基準を
//   具体的な現物（届出控え・雇用契約書・ファイル）で示す。key/label の法的定義は不変。
//   profileKey: company_profiles に写すときの key（人が読む短い名前）。
//   attributesToProfileRows がこれを使う。設問文（label）は長いのでそのままは使わない。
export const BOOL_QUESTIONS = [
  {
    key: 'has_36kyotei',
    profileKey: '36協定',
    label: '36協定（時間外・休日労働に関する協定）を締結していますか？',
    help: '残業や休日出勤をさせる場合に必要な労使協定です。前任の方が届け出た控えが残っている場合も「ある」で大丈夫です。',
  },
  {
    key: 'has_work_rules',
    profileKey: '就業規則',
    label: '就業規則を整備していますか？',
    help: '常時10人以上を雇用する場合は作成・届出の義務があります。書庫や共有フォルダに以前作られたものがある場合も「ある」です。',
  },
  {
    key: 'has_fixed_ot',
    profileKey: '固定残業代',
    label: '固定残業代（みなし残業代）の制度がありますか？',
    help: '一定の残業代をあらかじめ給与に含める制度です。雇用契約書や求人票に「固定残業代」「みなし残業」とあれば「ある」に当たります。',
  },
] as const

export type BoolQuestionKey = (typeof BOOL_QUESTIONS)[number]['key']
const BOOL_KEY_SET = new Set<string>(BOOL_QUESTIONS.map(q => q.key))

// 三値の UI 表現（未回答を明示的に持つ＝null を false と混同させない）。
export type TriState = 'yes' | 'no' | 'unknown'
export function triToBool(v: TriState): boolean | null {
  if (v === 'yes') return true
  if (v === 'no') return false
  return null
}
export function boolToTri(v: boolean | null | undefined): TriState {
  if (v === true) return 'yes'
  if (v === false) return 'no'
  return 'unknown'
}

// ----------------------------------------------------------------------------
// サーバ側の検証（API ルートで使う）。不正値は弾く／三値は null も許す。
// ----------------------------------------------------------------------------
export interface CompanyAttributesInput {
  industry_major?: string | null
  employee_band?: string | null
  has_36kyotei?: boolean | null
  has_work_rules?: boolean | null
  has_fixed_ot?: boolean | null
  benchmark_optout?: boolean
}

export interface CompanyAttributesRow {
  industry_major: string | null
  employee_band: string | null
  has_36kyotei: boolean | null
  has_work_rules: boolean | null
  has_fixed_ot: boolean | null
  benchmark_optout: boolean
}

/** 受信ペイロードを DB に入れてよい正規化値だけに丸める（CHECK と一致）。 */
export function sanitizeAttributes(input: CompanyAttributesInput): CompanyAttributesRow {
  const industry =
    typeof input.industry_major === 'string' && INDUSTRY_CODE_SET.has(input.industry_major)
      ? input.industry_major
      : null
  const band =
    typeof input.employee_band === 'string' && EMPLOYEE_BAND_SET.has(input.employee_band)
      ? input.employee_band
      : null
  const tri = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null)
  return {
    industry_major: industry,
    employee_band: band,
    has_36kyotei: tri(input.has_36kyotei),
    has_work_rules: tri(input.has_work_rules),
    has_fixed_ot: tri(input.has_fixed_ot),
    benchmark_optout: input.benchmark_optout === true,
  }
}

/**
 * オンボーディング5問の回答を company_profiles の行（key/value）へ変換する。
 *
 * なぜ要るか（2026-07-30 UX監査で検出した看板の破れ）:
 *   5問の保存先は company_attributes だが、チャットが読む loadCompanyContext は
 *   company_profiles と company_memories しか見ておらず、system プロンプトに
 *   attributes が渡る経路が存在しなかった（grep -c "attributes" lib/prompts.ts → 0）。
 *   その一方でチャット画面は「Kabauはこの前提で答えます：建設業・30〜49人・36協定なし」と
 *   表示していた＝**表示は前提を踏まえると言い、実挙動はモデルに何も渡していない**。
 *   結果、5問に答えた直後の初回相談が業種も人数も知らない一般論で返り、
 *   「会社を覚える」という製品の看板が実装で裏切られていた。
 *
 *   ここで company_profiles に写すことで、既存の想起パネル（参照した自社ルール）・
 *   記憶残高メーターにも同時に乗る（チャット側の改修が不要で、可視化とも整合する）。
 *
 * 値は人が読む文にする。モデルにも利用者にも同じ文字列が見えるようにして、
 * 表示と実挙動の乖離を構造的に起こさないため。
 */
export function attributesToProfileRows(
  attrs: CompanyAttributesRow,
): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = []

  const industry = INDUSTRY_MAJORS.find(i => i.code === attrs.industry_major)?.label
  if (industry) rows.push({ key: '業種', value: industry })

  if (attrs.employee_band) rows.push({ key: '従業員規模', value: `${attrs.employee_band}人` })

  // 三値（yes/no/unknown）のうち、unknown(null) は書かない。
  // 「わからない」を「無い」と断定してモデルに渡すと、事実でない前提で法令判断をしてしまう。
  const yesNo = (v: boolean | null): string | null => (v === true ? 'あり' : v === false ? 'なし' : null)
  for (const q of BOOL_QUESTIONS) {
    const v = yesNo(attrs[q.key as keyof CompanyAttributesRow] as boolean | null)
    if (v) rows.push({ key: q.profileKey, value: v })
  }

  return rows
}

export { INDUSTRY_CODE_SET, EMPLOYEE_BAND_SET, BOOL_KEY_SET }
