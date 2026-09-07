export type GapStatus =
  | "written"
  | "ops_missing"
  | "unmentioned"
  | "unread"
  | "not_applicable";

export type GapPriority =
  | "p0_deadline"
  | "p1_absolute"
  | "p2_dispute"
  | "p3_optional";

export type GapGroup =
  | "kasuhara_2026_10"
  | "absolute_lsa89"
  | "operations"
  | "amendment_dispute";

export type TaxonomyItem = {
  id: string;
  group: GapGroup;
  title: string;
  priority: GapPriority;
  deadline?: string;
  lookFor: string;
  /**
   * その項目の「根拠語」。**引用した原文にこの語が1つも無ければ、
   * 「ある」側の分類（written / ops_missing）を名乗らせない**（validateSheet.ts）。
   *
   * 2026-09-07 開業社労士の走破で実測: 引用は本文に実在する別の条文なので quoteExists は
   * 通り、その隣に「会社が時季を指定して年5日を取得させる制度の存在は読み取れます」と出た。
   * 引用した原文は「年次有給休暇は、従業員があらかじめ請求する時季に与える。」——
   * **「時季指定」も「年5日」も一文字も無い**。同型がもう1件（賃金の締切と支払時期。
   * 引用は第40条の構成・計算方法・支払方法までで、締切にも支払日にも触れていない）。
   *
   * 語は**広めに**取る（言い換えを1つでも拾えば通す）。狭くすると、正しい「ある」を
   * 「触れていない」へ落とす——それは本文に無いことを言い足すより静かな壊れ方になる。
   * lookFor（モデルへ渡す散文のヒント）とは用途が別なので、別の項目にする。
   */
  anchors: RegExp;
  allowNotApplicable: boolean;
};

export const TAXONOMY: TaxonomyItem[] = [
  {
    id: "kasuhara.policy",
    group: "kasuhara_2026_10",
    title: "カスタマーハラスメントの方針",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "顧客等からの著しい迷惑行為、カスハラ、カスタマーハラスメントへの方針",
    anchors: /カスタマーハラスメント|カスハラ|著しい迷惑行為|悪質なクレーム|迷惑行為/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.definition_and_response",
    group: "kasuhara_2026_10",
    title: "カスハラの内容と対処の周知",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "どのような行為を対象にするか、その場での対処",
    anchors: /カスタマーハラスメント|カスハラ|著しい迷惑行為|悪質なクレーム|迷惑行為|対象となる行為|該当する行為/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.window",
    group: "kasuhara_2026_10",
    title: "カスハラの相談窓口",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談窓口、担当、連絡方法",
    anchors: /窓口|相談|申出|苦情|担当者|連絡先|通報/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.window_capability",
    group: "kasuhara_2026_10",
    title: "窓口が対応できる体制",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "窓口担当の役割、研修、引き継ぎ",
    anchors: /窓口|相談|担当|研修|教育|体制|引継|引き継/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.factfinding",
    group: "kasuhara_2026_10",
    title: "事実関係の確認",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "事実確認の手順",
    anchors: /事実|確認|調査|聴取|ヒアリング|報告/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.victim_care",
    group: "kasuhara_2026_10",
    title: "被害を受けた従業員への配慮",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "安全確保、配置、メンタル面の配慮",
    anchors: /配慮|安全|配置|メンタル|健康|休職|保護|支援|ケア/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.recurrence",
    group: "kasuhara_2026_10",
    title: "再発防止",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "再発防止、周知のやり直し",
    anchors: /再発|防止|周知|研修|教育|啓発/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.egregious",
    group: "kasuhara_2026_10",
    title: "悪質事案の対処方針",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "出入り禁止、警察連絡、取引停止などの方針",
    anchors: /出入り禁止|出入禁止|警察|取引停止|法的措置|退去|通報|悪質|刑事|弁護士/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.privacy",
    group: "kasuhara_2026_10",
    title: "相談者のプライバシー",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談内容の秘密、プライバシー保護",
    anchors: /プライバシー|秘密|守秘|個人情報|漏らさ/,
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.no_retaliation",
    group: "kasuhara_2026_10",
    title: "不利益取扱いの禁止",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談したことを理由とする不利益取扱いの禁止",
    anchors: /不利益|報復|解雇|不当な取扱/,
    allowNotApplicable: false,
  },
  {
    id: "jobseeker_sekuhara.window",
    group: "kasuhara_2026_10",
    title: "求職者等に対するセクハラの相談窓口",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "採用選考、求職者、応募者に対するセクシュアルハラスメント",
    anchors: /求職者|応募者|採用|就職活動|インターン|セクシュアルハラスメント|セクハラ|性的/,
    allowNotApplicable: false,
  },
  {
    id: "abs.hours_start_end",
    group: "absolute_lsa89",
    title: "始業・終業の時刻",
    priority: "p1_absolute",
    lookFor: "始業、終業、勤務時間の開始と終了",
    anchors: /始業|終業|所定労働時間|勤務時間|就業時間|労働時間|午前|午後|時から/,
    allowNotApplicable: false,
  },
  {
    id: "abs.break",
    group: "absolute_lsa89",
    title: "休憩時間",
    priority: "p1_absolute",
    lookFor: "休憩",
    anchors: /休憩/,
    allowNotApplicable: false,
  },
  {
    id: "abs.holidays",
    group: "absolute_lsa89",
    title: "休日",
    priority: "p1_absolute",
    lookFor: "休日、週休、振替休日",
    anchors: /休日|週休|振替|日曜|土曜|祝日/,
    allowNotApplicable: false,
  },
  {
    id: "abs.leave",
    group: "absolute_lsa89",
    title: "休暇（年次有給を含む）",
    priority: "p1_absolute",
    lookFor: "年次有給休暇、休暇",
    anchors: /有給|休暇|年休/,
    allowNotApplicable: false,
  },
  {
    id: "abs.shift",
    group: "absolute_lsa89",
    title: "交替制の就業時転換",
    priority: "p1_absolute",
    lookFor: "交替、シフト、勤務の転換",
    anchors: /交替|交代|シフト|勤務の転換|就業時転換|変形労働|番方/,
    allowNotApplicable: true,
  },
  {
    id: "abs.wage_decide_calc_pay",
    group: "absolute_lsa89",
    title: "賃金の決定・計算・支払方法",
    priority: "p1_absolute",
    lookFor: "賃金、給与の計算、支払方法",
    anchors: /賃金|給与|給料|手当|支払|支給|計算/,
    allowNotApplicable: false,
  },
  {
    id: "abs.wage_cutoff_paydate",
    group: "absolute_lsa89",
    title: "賃金の締切と支払時期",
    priority: "p1_absolute",
    lookFor: "締切、支払日",
    anchors: /締切|締め切|締日|締め日|〆|日締|賃金計算期間|計算期間|支払日|支給日|支払期日|翌月\d+日|毎月\d+日|\d+日払|\d+日までに支払/,
    allowNotApplicable: false,
  },
  {
    id: "abs.raise",
    group: "absolute_lsa89",
    title: "昇給",
    priority: "p1_absolute",
    lookFor: "昇給",
    anchors: /昇給|給与改定|賃金改定|昇格|ベースアップ/,
    allowNotApplicable: false,
  },
  {
    id: "abs.retirement",
    group: "absolute_lsa89",
    title: "退職",
    priority: "p1_absolute",
    lookFor: "退職、自己都合、定年",
    anchors: /退職|定年|辞職|自己都合|退社/,
    allowNotApplicable: false,
  },
  {
    id: "abs.dismissal",
    group: "absolute_lsa89",
    title: "解雇事由",
    priority: "p1_absolute",
    lookFor: "解雇、普通解雇、懲戒解雇",
    anchors: /解雇|解職|退職を命/,
    allowNotApplicable: false,
  },
  {
    id: "ops.annual_leave_grant",
    group: "operations",
    title: "有給の付与起算と日数",
    priority: "p1_absolute",
    lookFor: "雇入れ、6か月、付与日数、出勤率",
    anchors: /付与|雇入|雇い入|継続勤務|出勤率|勤続|所定労働日数|労働日|比例/,
    allowNotApplicable: false,
  },
  {
    id: "ops.annual_leave_5days",
    group: "operations",
    title: "年5日の時季指定",
    priority: "p1_absolute",
    lookFor: "年5日、時季指定、10日以上付与",
    anchors: /年5日|5日|五日|時季指定|時季を指定|使用者が時季|10日以上|十日以上/,
    allowNotApplicable: false,
  },
  {
    id: "ops.36_agreement",
    group: "operations",
    title: "36協定への言及",
    priority: "p1_absolute",
    lookFor: "時間外労働、36協定、労使協定",
    anchors: /36協定|三六協定|時間外労働|時間外|労使協定|残業|休日労働/,
    allowNotApplicable: false,
  },
  {
    id: "ops.overtime_cap",
    group: "operations",
    title: "時間外労働の上限の考え方",
    priority: "p1_absolute",
    lookFor: "月45時間、年360時間、特別条項",
    anchors: /45時間|360時間|特別条項|限度時間|上限|時間を超え/,
    allowNotApplicable: false,
  },
  {
    id: "ops.pay_rate",
    group: "operations",
    title: "割増賃金の率",
    priority: "p1_absolute",
    lookFor: "割増、1.25、深夜、休日労働",
    anchors: /割増|1\.25|125|2割5分|25%|深夜|休日労働|35%|1\.35|3割5分|5割|1\.5|60時間/,
    allowNotApplicable: false,
  },
  {
    id: "rel.power_harassment",
    group: "amendment_dispute",
    title: "パワーハラスメント",
    priority: "p2_dispute",
    lookFor: "パワーハラスメント、パワハラ",
    anchors: /パワーハラスメント|パワハラ|優越的な関係|いじめ|嫌がらせ|職場におけるハラスメント/,
    allowNotApplicable: false,
  },
  {
    id: "rel.sexual_harassment",
    group: "amendment_dispute",
    title: "セクシュアルハラスメント",
    priority: "p2_dispute",
    lookFor: "セクシュアルハラスメント、セクハラ",
    anchors: /セクシュアルハラスメント|セクハラ|性的な言動|性的/,
    allowNotApplicable: false,
  },
  {
    id: "rel.ikuji_kaigo",
    group: "amendment_dispute",
    title: "育児・介護休業",
    priority: "p2_dispute",
    lookFor: "育児休業、介護休業、子の看護",
    anchors: /育児|介護|子の看護|出生時|産前|産後|養育/,
    allowNotApplicable: false,
  },
  {
    id: "rel.flexible_work_2025_10",
    group: "amendment_dispute",
    title: "柔軟な働き方を実現するための措置",
    priority: "p2_dispute",
    lookFor: "フレックスタイム、テレワーク、時差出勤、短時間、柔軟な働き方",
    anchors: /フレックス|テレワーク|在宅|時差出勤|短時間勤務|繰上げ|繰下げ|柔軟な働き方|所定外労働の制限|時間単位/,
    allowNotApplicable: false,
  },
  {
    id: "rel.muki_tenkan",
    group: "amendment_dispute",
    title: "無期転換",
    priority: "p2_dispute",
    lookFor: "無期転換、通算5年",
    anchors: /無期転換|無期労働契約|通算5年|通算して5年|期間の定めのない/,
    allowNotApplicable: true,
  },
  {
    id: "rel.secondary_job",
    group: "amendment_dispute",
    title: "副業・兼業",
    priority: "p3_optional",
    lookFor: "副業、兼業",
    anchors: /副業|兼業|他社の業務|他の会社の業務/,
    allowNotApplicable: true,
  },
  {
    id: "rel.telework",
    group: "amendment_dispute",
    title: "テレワーク",
    priority: "p3_optional",
    lookFor: "テレワーク、在宅勤務、リモート",
    anchors: /テレワーク|在宅勤務|リモート|サテライトオフィス/,
    allowNotApplicable: true,
  },
  {
    id: "rel.disciplinary",
    group: "amendment_dispute",
    title: "懲戒",
    priority: "p2_dispute",
    lookFor: "懲戒、譴責、減給、出勤停止",
    anchors: /懲戒|譴責|けん責|減給|出勤停止|停職|訓告|戒告|論旨|降格/,
    allowNotApplicable: true,
  },
];

export const DISCLAIMER =
  "この1枚は、置いたファイルから読み取れた範囲の整理です。不足の断定でも、適法性の保証でもありません。届出用の完成書類ではありません。最終判断は必要に応じて専門家へ確認してください。";

export const ADVICE_FOOTER =
  "一般的な情報提供です。個別の法的助言、書類作成代行、届出の代行ではありません。";

// ============================================================================
// 優先度の束（見出し・並び順・結論文の正典）
// ----------------------------------------------------------------------------
// 2026-09-05 の再監査で3つ直した。
//  (1) 見出しが実態とずれていた。p0 の11件目は「求職者等に対するセクハラの相談窓口」で
//      カスハラではない（同じ 2026-10-01 施行の措置義務）。p2 には パワハラ・育児介護休業・
//      柔軟な働き方（いずれも現行法の措置義務）が入っていて「もめたとき」だけでは言えない。
//  (2) 束の中の並びが内部英語IDのアルファベット順で、10/1 に一番要る「方針」が6番目・
//      「相談窓口」が10番目に出ていた。TAXONOMY の定義順＝カスハラ10措置の 1→10 なので、
//      定義順を並びの正典にする（下段の10措置表と1枚の中で順序が食い違わなくなる）。
//  (3) 結論1文を全項目の実数から作るのに、短い束名が要る（PRIORITY_SHORT）。
// ============================================================================

/** 束の並び順。 */
export const PRIORITY_ORDER: GapPriority[] = [
  "p0_deadline",
  "p1_absolute",
  "p2_dispute",
  "p3_optional",
];

/** 画面の見出し。 */
export const PRIORITY_LABEL: Record<string, string> = {
  p0_deadline: "2026年10月1日までに要る（措置義務）",
  p1_absolute: "就業規則に必ず書く事項（労基法89条）",
  p2_dispute: "関係法令で求められる定め・もめたときに効く定め",
  p3_optional: "置くなら書いておく定め",
};

/** 結論1文に埋める短い束名（見出しの括弧書きを落としたもの）。 */
export const PRIORITY_SHORT: Record<string, string> = {
  p0_deadline: "2026年10月1日までに要るもの",
  p1_absolute: "就業規則に必ず書く事項",
  p2_dispute: "関係法令・争いに備える定め",
  p3_optional: "置くなら書いておく定め",
};

export const PRIORITY_NOTE: Record<string, string> = {
  p0_deadline:
    "施行日までに方針・窓口・手順が要る項目です。カスハラ10措置と、求職者等に対するセクハラの窓口を含みます。",
  p1_absolute: "常時10人以上の事業場では、就業規則に必ず記載する事項です。",
  p2_dispute:
    "パワハラ・育児介護休業などの措置義務と、懲戒など争いになったときに根拠になる定めです。",
  p3_optional: "制度を置くなら、就業規則に書いておく定めです。",
};

/** TAXONOMY の定義順（id → 何番目か）。並べ替えの基準はこれ。 */
const TAXONOMY_INDEX = new Map(TAXONOMY.map((t, i) => [t.id, i]));

export function taxonomyIndex(id: string): number {
  return TAXONOMY_INDEX.get(id) ?? Number.MAX_SAFE_INTEGER;
}

/** 項目 id → 根拠語。未知の id には何も返さない（下流はそのとき素通しにしない）。 */
const ANCHORS = new Map(TAXONOMY.map((t) => [t.id, t.anchors]));

export function anchorsFor(id: string): RegExp | null {
  return ANCHORS.get(id) ?? null;
}
