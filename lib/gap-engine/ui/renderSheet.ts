import type { GapBlock, GapSheet } from "../engine/types";
import { DISCLAIMER } from "../taxonomy/items";

const PRIORITY_ORDER = ["p0_deadline", "p1_absolute", "p2_dispute", "p3_optional"];
const STATUS_LABEL: Record<string, string> = {
  written: "規程にある",
  ops_missing: "制度はあるが運用の書き方がまだない",
  unmentioned: "このファイルでは触れていない",
  unread: "未読ページに残している",
  not_applicable: "このファイルでは制度を置いていないと読める",
};

/** 34項目の束ね方（2026-09-05）。平坦な34件だと「時間外労働の上限」が中盤に埋もれる。 */
export const PRIORITY_LABEL: Record<string, string> = {
  p0_deadline: "2026年10月1日までに要る（カスハラ義務化）",
  p1_absolute: "就業規則に必ず書く事項（労基法89条）",
  p2_dispute: "もめたときに効く定め",
  p3_optional: "置くなら書いておく定め",
};

export const PRIORITY_NOTE: Record<string, string> = {
  p0_deadline: "施行日までに方針・窓口・手順が要る項目です。",
  p1_absolute: "常時10人以上の事業場では、就業規則に必ず記載する事項です。",
  p2_dispute: "争いになったときに、会社の言い分の根拠になる定めです。",
  p3_optional: "制度を置くなら、就業規則に書いておく定めです。",
};

export function sortBlocks(sheet: GapSheet) {
  return [...sheet.blocks].sort((a, b) => {
    const pd = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pd !== 0) return pd;
    return a.id.localeCompare(b.id);
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
 */
const INDUSTRY_HINT = /業種|業界|運輸|製造|小売|飲食|建設|医療|介護|物流|サービス業|事業所|自社の業/;

export function sortFollowups(followups: string[]): string[] {
  const seen = new Set<string>();
  const clean = followups
    .map((f) => (typeof f === "string" ? f.trim() : ""))
    .filter((f) => {
      if (!f || seen.has(f)) return false;
      seen.add(f);
      return true;
    });
  const hit = clean.filter((f) => INDUSTRY_HINT.test(f));
  const rest = clean.filter((f) => !INDUSTRY_HINT.test(f));
  return [...hit, ...rest];
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

  if (sheet.summary?.unread_note) out.push("", `未読: ${sheet.summary.unread_note}`);
  out.push("", DISCLAIMER, "");
  return out.join("\n");
}
