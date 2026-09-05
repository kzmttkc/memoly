import type { GapBlock, GapSheet } from "../engine/types";
import {
  DISCLAIMER,
  PRIORITY_LABEL,
  PRIORITY_NOTE,
  PRIORITY_ORDER,
  taxonomyIndex,
} from "../taxonomy/items";

export { PRIORITY_LABEL, PRIORITY_NOTE } from "../taxonomy/items";

const STATUS_LABEL: Record<string, string> = {
  written: "規程にある",
  ops_missing: "制度はあるが運用の書き方がまだない",
  unmentioned: "このファイルでは触れていない",
  unread: "未読ページに残している",
  not_applicable: "このファイルでは制度を置いていないと読める",
};

/**
 * 34項目の並べ替え（2026-09-05 再監査で作り直した）。
 *
 * 旧: 束の中を `a.id.localeCompare(b.id)` ＝**内部英語IDのアルファベット順**にしていた。
 *   p0 の実表示順は 求職者等セクハラ窓口 → 内容と対処 → 悪質事案 → 事実確認 → 不利益取扱い →
 *   **方針(6番目)** → プライバシー → 再発防止 → 配慮 → **相談窓口(10番目)** → 窓口体制。
 *   10/1 に一番要る「方針」と「相談窓口」が束の後半にあり、しかも**同じ10項目が下段の
 *   10措置表では 1→10 で並ぶ**ので、1枚の中に別順序の同じリストが2本あった。
 *
 * 新: (1) 束（priority）→ (2) **手当てが要るものが先**（読む人が先に見たい順） →
 *     (3) TAXONOMY の定義順（＝カスハラ10措置の 1→10。下段の表と一致する）。
 */
export function sortBlocks(sheet: GapSheet) {
  return [...sheet.blocks].sort((a, b) => {
    const pd = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pd !== 0) return pd;
    const od = Number(isOpenBlock(b)) - Number(isOpenBlock(a));
    if (od !== 0) return od;
    return taxonomyIndex(a.id) - taxonomyIndex(b.id);
  });
}

/** 優先度ごとの束。見出しをここから作る（順序は sortBlocks と同じ）。 */
export function groupByPriority(
  sheet: GapSheet,
): { priority: string; label: string; note: string; blocks: GapBlock[] }[] {
  const sorted = sortBlocks(sheet);
  return PRIORITY_ORDER.map((p) => ({
    priority: p,
    label: PRIORITY_LABEL[p] ?? p,
    note: PRIORITY_NOTE[p] ?? "",
    blocks: sorted.filter((b) => b.priority === p),
  })).filter((g) => g.blocks.length > 0);
}

/** 手当てが要る（=「規程にある」でも「置いていない」でもない）項目か。 */
export function isOpenBlock(b: GapBlock): boolean {
  return b.status !== "written" && b.status !== "not_applicable";
}

export function blockLine(status: string, title: string): string {
  return `${STATUS_LABEL[status] ?? status}  ${title}`;
}

export function sheetTitle(sheet: GapSheet): string {
  const guess = sheet.document?.title_guess?.trim();
  if (guess) return `${guess.replace(/\.[^.]+$/, "")}のずれ1枚`;
  return sheet.summary?.headline || "ずれ1枚";
}

/**
 * followups の並べ替え。
 *
 * 2026-09-05 の監査所見: 17件の followups のうち「運輸業（タクシー、バス、トラック等）では、
 * 顧客からの迷惑行為が多く報告されています」のように**業種を当てにいった一文**があり、
 * 「この製品は私の会社を見ている」と感じさせたのはそれだけだった。ところが画面には1件も
 * 出ていなかった。全件を上部に積むと結論が遠のくので、業種に触れた一文を先頭へ寄せる。
 *
 * 2026-09-05 再監査: その語群に **「介護」** が入っていた。34項目には常に
 * 「育児・介護休業」があるので、その followup が毎回「業種を当てた一文」として
 * 上位4件へ繰り上がる。実測の表示順は 1位・2位が本命（運輸業）、**3位が誤爆
 * （育児・介護休業法）、4位に期日へ一番効く一文（2026年10月1日までにカスハラ対策を追加）が
 * 押し出されていた**。制度名としての「介護」を業種語から外し（拾うのは介護事業/介護業だけ）、
 * 育児・介護休業の文は明示的に除外する。
 */
const INDUSTRY_HINT =
  /業種|業界|運輸|運送|製造|小売|飲食|建設|医療|介護事業|介護業|介護施設|物流|倉庫|警備|清掃|宿泊|保育|サービス業|事業所|自社の業/;
/** 制度名としての「介護」。業種を当てた一文ではないので繰り上げない。 */
const NOT_INDUSTRY = /育児[・･]?介護休業|育児休業|介護休業|介護休暇|子の看護/;
/** 施行日に触れた一文（期日に効く）。 */
const DEADLINE_HINT = /2026年10月1日|2026-10-01|施行|義務化|10月1日まで/;

export function sortFollowups(followups: string[]): string[] {
  const seen = new Set<string>();
  const clean = followups
    .map((f) => (typeof f === "string" ? f.trim() : ""))
    .filter((f) => {
      if (!f || seen.has(f)) return false;
      seen.add(f);
      return true;
    });
  const isIndustry = (f: string) => INDUSTRY_HINT.test(f) && !NOT_INDUSTRY.test(f);
  // 期日に触れた一文は、業種の一文の次に置く（上位4件から押し出されていた）。
  const isDeadline = (f: string) => !isIndustry(f) && DEADLINE_HINT.test(f);
  const hit = clean.filter(isIndustry);
  const deadline = clean.filter(isDeadline);
  const rest = clean.filter((f) => !isIndustry(f) && !isDeadline(f));
  return [...hit, ...deadline, ...rest];
}

export type SheetTextExtras = {
  /** カスハラ10措置の照合結果（○△×）。無ければ書かない。 */
  measures?: { n: number; title: string; verdict: string; evidence?: string; note?: string }[];
  /** 規程追補案の全文。無ければ書かない。 */
  draft?: string;
};

const VERDICT_MARK: Record<string, string> = { ok: "○", weak: "△", missing: "×" };

/**
 * 「1枚を保存」「1枚をコピー」で持ち帰るテキスト。
 *
 * 2026-09-05 の監査所見: 保存もコピーも同一の 5,207 字で、**原文引用も・10措置の○△×も・
 * そのまま貼れる規程追補案の条文も入っていなかった**。無料で一番価値のあるものが
 * 画面から出られない状態だったので、判定の根拠（原文）と、照合結果と、追補案を載せる。
 */
export function sheetPlainText(sheet: GapSheet, extras: SheetTextExtras = {}): string {
  const out: string[] = [sheetTitle(sheet)];

  const headline = sheet.summary?.headline?.trim();
  if (headline) out.push("", headline);

  const doc = sheet.document;
  if (doc) {
    out.push(
      "",
      (doc.page_count ?? 0) > 0
        ? `読めたページ: ${doc.pages_read ?? 0}／未読 ${doc.pages_unread?.length ?? 0}`
        : `読んだ本文: ${(doc.char_count ?? 0).toLocaleString("ja-JP")}字`,
    );
  }

  for (const g of groupByPriority(sheet)) {
    out.push("", `■ ${g.label}（${g.blocks.length}件）`);
    for (const b of g.blocks) {
      out.push("", `・${blockLine(b.status, b.title)}${b.deadline ? `（期限 ${b.deadline}）` : ""}`);
      for (const line of [b.what_found, b.what_not_found]) {
        if (line?.trim()) out.push(line.trim());
      }
      if (b.why_it_matters?.trim()) out.push(`なぜ: ${b.why_it_matters.trim()}`);
      for (const c of (b.citations ?? []).filter((c) => c?.quote?.trim())) {
        out.push(`原文: 「${c.quote.trim()}」${c.approx_locus ? `（${c.approx_locus}）` : ""}`);
      }
      if (b.next_step?.trim()) out.push(`次: ${b.next_step.trim()}`);
    }
  }

  const followups = sortFollowups(sheet.followups ?? []);
  if (followups.length) {
    out.push("", "■ この規則から読み取れたこと");
    for (const f of followups) out.push(`・${f}`);
  }

  if (extras.measures?.length) {
    out.push("", "■ カスハラ10措置との照合（2026年10月1日義務化）");
    for (const m of extras.measures) {
      out.push(`${VERDICT_MARK[m.verdict] ?? m.verdict} 措置${m.n} ${m.title}`);
      if (m.evidence?.trim()) out.push(`  根拠: ${m.evidence.trim()}`);
      if (m.note?.trim()) out.push(`  ${m.note.trim()}`);
    }
    out.push("×は「違法」ではなく「該当する定めが本文から見つからない」の意味です。");
  }

  if (extras.draft?.trim()) {
    out.push("", "■ ×・△だけを埋める規程追補案", extras.draft.trim());
  }

  // 2026-09-05 再監査: 上部ボタンは照合前に押せる位置にあるため、上部＝10,539字 /
  // 下部＝12,781字 と中身が 2,242字ちがう控えが、**同じファイル名・同じ体裁**で配られていた。
  // 欠けるのは10措置の○△×と規程追補案の全文——無料で一番価値のある部分なのに、
  // 薄い方を持ち帰ったことに気づけなかった。本文の側に欠落を書く。
  if (!extras.measures?.length || !extras.draft?.trim()) {
    out.push(
      "",
      "※ この控えには、カスハラ10措置の照合結果（○△×）と、×・△だけを埋める規程追補案の全文は含まれていません。",
      "  画面の「10措置と照合する」を実行してから保存・コピーすると、同じ1枚に両方が入ります。",
    );
  }

  if (sheet.summary?.unread_note) out.push("", `未読: ${sheet.summary.unread_note}`);
  out.push("", DISCLAIMER, "");
  return out.join("\n");
}
