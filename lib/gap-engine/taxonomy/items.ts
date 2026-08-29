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
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.definition_and_response",
    group: "kasuhara_2026_10",
    title: "カスハラの内容と対処の周知",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "どのような行為を対象にするか、その場での対処",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.window",
    group: "kasuhara_2026_10",
    title: "カスハラの相談窓口",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談窓口、担当、連絡方法",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.window_capability",
    group: "kasuhara_2026_10",
    title: "窓口が対応できる体制",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "窓口担当の役割、研修、引き継ぎ",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.factfinding",
    group: "kasuhara_2026_10",
    title: "事実関係の確認",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "事実確認の手順",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.victim_care",
    group: "kasuhara_2026_10",
    title: "被害を受けた従業員への配慮",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "安全確保、配置、メンタル面の配慮",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.recurrence",
    group: "kasuhara_2026_10",
    title: "再発防止",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "再発防止、周知のやり直し",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.egregious",
    group: "kasuhara_2026_10",
    title: "悪質事案の対処方針",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "出入り禁止、警察連絡、取引停止などの方針",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.privacy",
    group: "kasuhara_2026_10",
    title: "相談者のプライバシー",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談内容の秘密、プライバシー保護",
    allowNotApplicable: false,
  },
  {
    id: "kasuhara.no_retaliation",
    group: "kasuhara_2026_10",
    title: "不利益取扱いの禁止",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "相談したことを理由とする不利益取扱いの禁止",
    allowNotApplicable: false,
  },
  {
    id: "jobseeker_sekuhara.window",
    group: "kasuhara_2026_10",
    title: "求職者等に対するセクハラの相談窓口",
    priority: "p0_deadline",
    deadline: "2026-10-01",
    lookFor: "採用選考、求職者、応募者に対するセクシュアルハラスメント",
    allowNotApplicable: false,
  },
  {
    id: "abs.hours_start_end",
    group: "absolute_lsa89",
    title: "始業・終業の時刻",
    priority: "p1_absolute",
    lookFor: "始業、終業、勤務時間の開始と終了",
    allowNotApplicable: false,
  },
  {
    id: "abs.break",
    group: "absolute_lsa89",
    title: "休憩時間",
    priority: "p1_absolute",
    lookFor: "休憩",
    allowNotApplicable: false,
  },
  {
    id: "abs.holidays",
    group: "absolute_lsa89",
    title: "休日",
    priority: "p1_absolute",
    lookFor: "休日、週休、振替休日",
    allowNotApplicable: false,
  },
  {
    id: "abs.leave",
    group: "absolute_lsa89",
    title: "休暇（年次有給を含む）",
    priority: "p1_absolute",
    lookFor: "年次有給休暇、休暇",
    allowNotApplicable: false,
  },
  {
    id: "abs.shift",
    group: "absolute_lsa89",
    title: "交替制の就業時転換",
    priority: "p1_absolute",
    lookFor: "交替、シフト、勤務の転換",
    allowNotApplicable: true,
  },
  {
    id: "abs.wage_decide_calc_pay",
    group: "absolute_lsa89",
    title: "賃金の決定・計算・支払方法",
    priority: "p1_absolute",
    lookFor: "賃金、給与の計算、支払方法",
    allowNotApplicable: false,
  },
  {
    id: "abs.wage_cutoff_paydate",
    group: "absolute_lsa89",
    title: "賃金の締切と支払時期",
    priority: "p1_absolute",
    lookFor: "締切、支払日",
    allowNotApplicable: false,
  },
  {
    id: "abs.raise",
    group: "absolute_lsa89",
    title: "昇給",
    priority: "p1_absolute",
    lookFor: "昇給",
    allowNotApplicable: false,
  },
  {
    id: "abs.retirement",
    group: "absolute_lsa89",
    title: "退職",
    priority: "p1_absolute",
    lookFor: "退職、自己都合、定年",
    allowNotApplicable: false,
  },
  {
    id: "abs.dismissal",
    group: "absolute_lsa89",
    title: "解雇事由",
    priority: "p1_absolute",
    lookFor: "解雇、普通解雇、懲戒解雇",
    allowNotApplicable: false,
  },
  {
    id: "ops.annual_leave_grant",
    group: "operations",
    title: "有給の付与起算と日数",
    priority: "p1_absolute",
    lookFor: "雇入れ、6か月、付与日数、出勤率",
    allowNotApplicable: false,
  },
  {
    id: "ops.annual_leave_5days",
    group: "operations",
    title: "年5日の時季指定",
    priority: "p1_absolute",
    lookFor: "年5日、時季指定、10日以上付与",
    allowNotApplicable: false,
  },
  {
    id: "ops.36_agreement",
    group: "operations",
    title: "36協定への言及",
    priority: "p1_absolute",
    lookFor: "時間外労働、36協定、労使協定",
    allowNotApplicable: false,
  },
  {
    id: "ops.overtime_cap",
    group: "operations",
    title: "時間外労働の上限の考え方",
    priority: "p1_absolute",
    lookFor: "月45時間、年360時間、特別条項",
    allowNotApplicable: false,
  },
  {
    id: "ops.pay_rate",
    group: "operations",
    title: "割増賃金の率",
    priority: "p1_absolute",
    lookFor: "割増、1.25、深夜、休日労働",
    allowNotApplicable: false,
  },
  {
    id: "rel.power_harassment",
    group: "amendment_dispute",
    title: "パワーハラスメント",
    priority: "p2_dispute",
    lookFor: "パワーハラスメント、パワハラ",
    allowNotApplicable: false,
  },
  {
    id: "rel.sexual_harassment",
    group: "amendment_dispute",
    title: "セクシュアルハラスメント",
    priority: "p2_dispute",
    lookFor: "セクシュアルハラスメント、セクハラ",
    allowNotApplicable: false,
  },
  {
    id: "rel.ikuji_kaigo",
    group: "amendment_dispute",
    title: "育児・介護休業",
    priority: "p2_dispute",
    lookFor: "育児休業、介護休業、子の看護",
    allowNotApplicable: false,
  },
  {
    id: "rel.flexible_work_2025_10",
    group: "amendment_dispute",
    title: "柔軟な働き方を実現するための措置",
    priority: "p2_dispute",
    lookFor: "フレックスタイム、テレワーク、時差出勤、短時間、柔軟な働き方",
    allowNotApplicable: false,
  },
  {
    id: "rel.muki_tenkan",
    group: "amendment_dispute",
    title: "無期転換",
    priority: "p2_dispute",
    lookFor: "無期転換、通算5年",
    allowNotApplicable: true,
  },
  {
    id: "rel.secondary_job",
    group: "amendment_dispute",
    title: "副業・兼業",
    priority: "p3_optional",
    lookFor: "副業、兼業",
    allowNotApplicable: true,
  },
  {
    id: "rel.telework",
    group: "amendment_dispute",
    title: "テレワーク",
    priority: "p3_optional",
    lookFor: "テレワーク、在宅勤務、リモート",
    allowNotApplicable: true,
  },
  {
    id: "rel.disciplinary",
    group: "amendment_dispute",
    title: "懲戒",
    priority: "p2_dispute",
    lookFor: "懲戒、譴責、減給、出勤停止",
    allowNotApplicable: true,
  },
];

export const DISCLAIMER =
  "この1枚は、置いたファイルから読み取れた範囲の整理です。不足の断定でも、適法性の保証でもありません。届出用の完成書類ではありません。最終判断は必要に応じて専門家へ確認してください。";

export const ADVICE_FOOTER =
  "一般的な情報提供です。個別の法的助言、書類作成代行、届出の代行ではありません。";
