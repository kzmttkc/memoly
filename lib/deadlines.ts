import type { CompanyAttributesValues } from '@/lib/company'

// ============================================================================
// deadlines.ts — F4「期限レジストリ」のルールベース・サジェスト（決定的・LLM非依存）
// ----------------------------------------------------------------------------
//   目的:
//     company_attributes（オンボーディング5問の正規化属性）の値だけから、
//     「登録しておくとよさそうな労務の期限」の候補を決定的に導く。
//
//   Phase1コンプラ（設計の要）:
//     - 候補は「title と目安の月」だけを返し、due_on（具体的な日付）は返さない。
//       日付はユーザーが画面で確定する（システムは日付を断定しない）。
//     - 断定・命令をしない。ラベルは中立（「〜の目安」）。禁止語を含めない。
//     - null（未回答）の属性からは候補を出さない（不確かな前提で提案しない）。
//       false（明示的に「ない」）は、必要な制度が未整備＝候補を出してよい場合がある
//       （例: 就業規則が無い → 届出の目安を案内する）。三値を取り違えない。
//
//   LLM は一切呼ばない純関数（company-attributes.ts の sanitize と同じ流儀＝集計/提案の純度）。
// ============================================================================

/** サジェスト候補1件（title と目安月のみ・due_on はユーザー確定）。 */
export interface DeadlineSuggestion {
  /** 期限の名称（そのまま登録の title になる）。 */
  title: string
  /** 目安の時期（人が読む中立ラベル。例「毎年6〜7月ごろ」「11〜12月ごろ」）。 */
  timingLabel: string
  /** 補足（任意・note の初期値候補）。断定しない中立文。 */
  hint?: string
  /** 既定の繰り返し。年次で巡るものは 'yearly'、一度きりは 'none'。 */
  recurrence: 'none' | 'yearly'
}

/**
 * 正規化属性から、未登録なら案内したい期限候補を決定的に導く。
 *   - 呼び出し側（API GET ?suggest=1）で既存の title と突き合わせ、
 *     既に登録済みのものを除外してから返す（本関数は「素の候補集合」を返す）。
 *   - 属性が全 null（オンボーディング未完）なら、常時該当の年次期限のみを返す。
 *
 * @param attrs loadCompanyAttributes の返す三値属性（null=未回答）。
 */
export function suggestDeadlines(attrs: CompanyAttributesValues): DeadlineSuggestion[] {
  const out: DeadlineSuggestion[] = []

  // --- 常時該当（属性に依存しない年次の代表的な労務期限） ---
  // 労働保険の年度更新（例年6〜7月）。事業所として労働保険に加入していれば毎年巡る。
  out.push({
    title: '労働保険の年度更新',
    timingLabel: '毎年6〜7月ごろ',
    hint: '前年度の確定と当年度の概算の申告・納付の目安です。',
    recurrence: 'yearly',
  })
  // 算定基礎届（例年7月）。社会保険の定時決定の届出。
  out.push({
    title: '算定基礎届',
    timingLabel: '毎年7月ごろ',
    hint: '社会保険の標準報酬月額を見直す定時決定の届出の目安です。',
    recurrence: 'yearly',
  })
  // 年末調整（例年11〜12月）。給与支払をしていれば毎年巡る。
  out.push({
    title: '年末調整',
    timingLabel: '毎年11〜12月ごろ',
    hint: '年間の給与にかかる所得税の精算の目安です。',
    recurrence: 'yearly',
  })

  // --- 36協定を締結している場合: 有効期間の更新（多くは年次）。 ---
  if (attrs.has_36kyotei === true) {
    out.push({
      title: '36協定の更新',
      timingLabel: '有効期間の満了前',
      hint: '締結済みの36協定の有効期間が切れる前に、更新と届出を検討する目安です。',
      recurrence: 'yearly',
    })
  }

  // --- 従業員規模が「1〜4人」でない場合: 定期健康診断（例年・常時使用する労働者が対象）。 ---
  //   employee_band は '1-4' 以外なら常時使用の労働者がいる想定で候補を出す。null は出さない。
  if (attrs.employee_band !== null && attrs.employee_band !== '1-4') {
    out.push({
      title: '定期健康診断',
      timingLabel: '毎年1回の実施時期',
      hint: '常時使用する労働者への定期健康診断の実施時期の目安です。',
      recurrence: 'yearly',
    })
  }

  // --- 従業員規模が「50人以上」: ストレスチェック（年1回・50人以上の事業場）。 ---
  if (attrs.employee_band === '50-99' || attrs.employee_band === '100+') {
    out.push({
      title: 'ストレスチェックの実施',
      timingLabel: '毎年1回の実施時期',
      hint: '常時50人以上の事業場での年1回の実施の目安です。',
      recurrence: 'yearly',
    })
  }

  // --- 就業規則が未整備（明示的に false）: 作成・届出の目安を一度案内する（単発）。 ---
  //   null（未回答）では出さない。false（無いと回答）でのみ出す＝三値の使い分け。
  if (attrs.has_work_rules === false) {
    out.push({
      title: '就業規則の届出',
      timingLabel: '整備でき次第',
      hint: '就業規則を整備した際の作成・届出の目安です。',
      recurrence: 'none',
    })
  }

  return out
}
