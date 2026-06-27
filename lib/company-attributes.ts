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
export const INDUSTRY_MAJORS = [
  { code: 'A', label: '農業・林業' },
  { code: 'B', label: '漁業' },
  { code: 'C', label: '鉱業・採石業・砂利採取業' },
  { code: 'D', label: '建設業' },
  { code: 'E', label: '製造業' },
  { code: 'F', label: '電気・ガス・熱供給・水道業' },
  { code: 'G', label: '情報通信業' },
  { code: 'H', label: '運輸業・郵便業' },
  { code: 'I', label: '卸売業・小売業' },
  { code: 'J', label: '金融業・保険業' },
  { code: 'K', label: '不動産業・物品賃貸業' },
  { code: 'L', label: '学術研究・専門・技術サービス業' },
  { code: 'M', label: '宿泊業・飲食サービス業' },
  { code: 'N', label: '生活関連サービス業・娯楽業' },
  { code: 'O', label: '教育・学習支援業' },
  { code: 'P', label: '医療・福祉' },
  { code: 'Q', label: '複合サービス事業' },
  { code: 'R', label: 'サービス業（他に分類されないもの）' },
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
export const BOOL_QUESTIONS = [
  {
    key: 'has_36kyotei',
    label: '36協定（時間外・休日労働に関する協定）を締結していますか？',
    help: '残業や休日出勤をさせる場合に必要な労使協定です。',
  },
  {
    key: 'has_work_rules',
    label: '就業規則を整備していますか？',
    help: '常時10人以上を雇用する場合は作成・届出の義務があります。',
  },
  {
    key: 'has_fixed_ot',
    label: '固定残業代（みなし残業代）の制度がありますか？',
    help: '一定の残業代をあらかじめ給与に含める制度です。',
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

export { INDUSTRY_CODE_SET, EMPLOYEE_BAND_SET, BOOL_KEY_SET }
