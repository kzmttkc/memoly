import { DISCLAIMER, TAXONOMY } from "../taxonomy/items";
import type { GapSheet, GapBlock } from "./types";

const FORBIDDEN = /違法|無効|是正勧告|届出できない|必ず足りない|法律上欠落/;

function normalize(s: string): string {
  return s.replace(/\s+/g, "").replace(/[「」『』]/g, "");
}

export function quoteExists(source: string, quote: string): boolean {
  if (!quote || quote.length < 4) return false;
  return normalize(source).includes(normalize(quote));
}

/**
 * status の語ゆれを正規化する。
 *
 * 2026-08-31 実測: プロンプトが written という語を一度も定義していなかったため
 * （手順に出てくるのは ops_missing / unmentioned / unread / not_applicable だけ）、
 * モデルは肯定側に "found" を発明して返していた。schema 外の語は下流で捨てられ、
 * **条文を正しく見つけているのに「触れていない」と表示されていた**
 * （正解データ 10件中 4件がこれで不一致。うち3件は語ゆれだけが原因）。
 * プロンプト側に許可語を明記したうえで、ここでも受け止める——
 * モデルを変えたときに同じ壊れ方を静かに繰り返さないため。
 */
const STATUS_ALIASES: Record<string, GapBlock["status"]> = {
  found: "written",
  present: "written",
  exists: "written",
  documented: "written",
  covered: "written",
  missing: "unmentioned",
  absent: "unmentioned",
  not_found: "unmentioned",
  partial: "ops_missing",
};

export function normalizeStatus(s: unknown): GapBlock["status"] | null {
  const v = String(s ?? "").trim().toLowerCase();
  const valid = ["written", "ops_missing", "unmentioned", "unread", "not_applicable"];
  if (valid.includes(v)) return v as GapBlock["status"];
  return STATUS_ALIASES[v] ?? null;
}

export function sanitizeBlock(source: string, block: GapBlock): GapBlock {
  const normalized = normalizeStatus(block.status);
  if (normalized) block = { ...block, status: normalized };
  const citations = (block.citations ?? []).filter((c) =>
    quoteExists(source, c.quote),
  );
  if (citations.length === 0 && (block.status === "written" || block.status === "ops_missing")) {
    return {
      ...block,
      status: "unmentioned",
      what_found: "",
      what_not_found: "このファイルからは読み取れませんでした。不足の断定ではありません。",
      citations: [],
    };
  }
  return { ...block, citations };
}

export function enforceTaxonomy(sheet: GapSheet, source: string): GapSheet {
  const byId = new Map(TAXONOMY.map((t) => [t.id, t]));
  const incoming = new Map((sheet.blocks ?? []).map((b) => [b.id, b]));
  const blocks: GapBlock[] = TAXONOMY.map((item) => {
    const raw = incoming.get(item.id);
    const base: GapBlock = raw ?? {
      id: item.id,
      group: item.group,
      title: item.title,
      status: "unmentioned",
      priority: item.priority,
      deadline: item.deadline,
      what_found: "",
      what_not_found: "このファイルからは読み取れませんでした。不足の断定ではありません。",
      why_it_matters: "",
      next_step: "専門家に、この項目を現行ファイルで確認する。",
      citations: [],
    };
    if (!item.allowNotApplicable && base.status === "not_applicable") {
      base.status = "unmentioned";
    }
    base.group = item.group;
    base.title = item.title;
    base.priority = item.priority;
    base.deadline = item.deadline;
    if (FORBIDDEN.test(`${base.what_found}${base.what_not_found}${base.why_it_matters}`)) {
      base.why_it_matters = "一般的な確認項目です。このファイルの範囲の整理にとどめます。";
    }
    return sanitizeBlock(source, base);
  });

  const written = blocks.filter((b) => b.status === "written").length;
  const ops = blocks.filter((b) => b.status === "ops_missing").length;
  const un = blocks.filter((b) => b.status === "unmentioned").length;

  return {
    schema_version: "2026-08-29.1",
    disclaimer: DISCLAIMER,
    document: sheet.document,
    summary: {
      headline: sheet.summary?.headline || "このファイルから読み取れたこと",
      written_count: written,
      ops_missing_count: ops,
      unmentioned_count: un,
      unread_note: sheet.summary?.unread_note ?? null,
    },
    blocks,
    contradictions: (sheet.contradictions ?? []).filter(
      (c) => quoteExists(source, c.left.quote) && quoteExists(source, c.right.quote),
    ),
    followups: sheet.followups ?? [],
  };
}

export function parseSheetJson(raw: string): GapSheet {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as GapSheet;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid_sheet");
  }
  return parsed;
}

export { byIdHint };
function byIdHint() {
  return TAXONOMY.map(({ id, title }) => ({ id, title }));
}
