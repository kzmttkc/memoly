import {
  DISCLAIMER,
  PRIORITY_ORDER,
  PRIORITY_SHORT,
  TAXONOMY,
} from "../taxonomy/items";
import type { GapSheet, GapBlock } from "./types";

/**
 * 出してはいけない断定。
 *
 * 2026-09-05 の実走（運送業 1,991字）で「**2026年10月1日の努力義務化に向けて**」という
 * 一文が結論の隣（followups 2位）と p0 の1件目の「なぜ」に出た。改正労働施策総合推進法
 * （令和7年法律第63号）によるカスハラ対策は **措置義務** であって努力義務ではない
 * （正典: lib/kasuhara/measures.ts の冒頭・steering/trend-calendar.md）。
 * 静的ページ側には同じ誤りを止める単体テストがあるのに、LLM の生成文だけ素通りしていた。
 */
const FORBIDDEN = /違法|無効|是正勧告|届出できない|必ず足りない|法律上欠落|努力義務/;

/** FORBIDDEN に当たる文だけを落とす（「。」区切り）。文章ごと消さない。 */
function scrubForbidden(s: string): string {
  if (!s || !FORBIDDEN.test(s)) return s;
  return s
    .split("。")
    .filter((sentence) => sentence.trim() && !FORBIDDEN.test(sentence))
    .map((sentence) => `${sentence.trim()}。`)
    .join("");
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").replace(/[「」『』]/g, "");
}

export function quoteExists(source: string, quote: string): boolean {
  if (!quote || quote.length < 4) return false;
  const src = normalize(source);
  if (src.includes(normalize(quote))) return true;
  // 2026-08-31 実測: モデルは逐語の抜き出しに出典を足して
  // 「始業は午前9時、終業は午後6時とする。（第2条）」と返すことがある。
  // 本文にその括弧書きは無いので一致せず、正しい引用が捨てられていた。
  // 末尾の括弧注記だけ落としてもう一度照合する（本文側は触らない）。
  const trimmed = quote.replace(/[（(][^（()）]*[)）]\s*$/, "").trim();
  return trimmed.length >= 4 && src.includes(normalize(trimmed));
}

/**
 * 根拠の項目名ゆれを citations に寄せる。
 *
 * 2026-08-31 実測: プロンプトが出力の項目名を一度も示していなかった
 * （「スキーマどおりの JSON」とだけ書いてあり、そのスキーマが無かった）。
 * モデルは根拠を citations ではなく quote、要約を what_found ではなく note で返し、
 * citations が空 → sanitizeBlock が written を unmentioned へ格下げ → **条文を
 * 正しく引用しているのに「触れていない」と表示されていた**（本番実測 6/10）。
 * プロンプトに項目名を明記したうえで、ここでも受け止める。
 */
function coerceEvidence(block: GapBlock): GapBlock {
  const b = block as GapBlock & { quote?: unknown; note?: unknown };
  let out = block;
  if ((!out.citations || out.citations.length === 0) && typeof b.quote === "string" && b.quote) {
    out = { ...out, citations: [{ quote: b.quote }] };
  }
  if (!out.what_found && typeof b.note === "string" && b.note) {
    out = { ...out, what_found: b.note };
  }
  return out;
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
  block = coerceEvidence(block);
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

/** 手当てが要る（=「規程にある」でも「置いていない」でもない）項目か。 */
function needsWork(b: GapBlock): boolean {
  return b.status !== "written" && b.status !== "not_applicable";
}

/**
 * 結論1文を、**34項目すべての実数から**組み立てる。
 *
 * 2026-09-05 の再監査で実測された壊れ方: runGapSheet は34項目を4分割して並列に投げ、
 * blocks / followups / summary は全バッチから作り直すのに、**headline だけ1本目のバッチの
 * ものをそのまま使っていた**（`settled.find((s) => s !== null)!`）。バッチ1は TAXONOMY 先頭
 * 9件＝すべてカスハラなので、「年5日の時季指定」「時間外労働の上限の考え方」「割増賃金の率」は
 * **構造上この結論に絶対載らなかった**。しかもバッチ1が落ちると、バッチ2の結論が
 * 全体の結論として出ていた。
 *
 * モデルの一文に頼るのをやめ、enforceTaxonomy が数え終えた実際の内訳から作る。
 * 画面の「手当てが要るもの N件」「触れていない N件」と必ず一致する。
 */
export function buildHeadline(blocks: GapBlock[]): string {
  if (blocks.length === 0) return "";
  const open = blocks.filter(needsWork);
  if (open.length === 0) {
    return `${blocks.length}項目すべてに、対応する定めがこのファイルから読み取れました。`;
  }
  const counts = PRIORITY_ORDER.map((p) => ({
    p,
    n: open.filter((b) => b.priority === p).length,
  })).filter((c) => c.n > 0);
  // 期限のある束は件数に関わらず先頭。残りは厚い順。
  const head = counts.filter((c) => c.p === "p0_deadline");
  const tail = counts.filter((c) => c.p !== "p0_deadline").sort((a, b) => b.n - a.n);
  const parts = [...head, ...tail]
    .slice(0, 2)
    .map((c) => `${PRIORITY_SHORT[c.p] ?? c.p}が${c.n}件`);
  const un = blocks.filter((b) => b.status === "unmentioned").length;
  const tailNote = un > 0 ? `（うちこのファイルで触れていないもの${un}件）` : "";
  return `${blocks.length}項目のうち、手当てが要るものが${open.length}件${tailNote}。${parts.join("、")}です。`;
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
      // why_it_matters 以外にも同じ断定が入ることがある（2026-09-05 実走で確認）。
      base.what_found = scrubForbidden(base.what_found);
      base.what_not_found = scrubForbidden(base.what_not_found);
      base.next_step = scrubForbidden(base.next_step);
    }
    const out = sanitizeBlock(source, base);
    // 2026-09-05 再監査: 34件中14件は written / not_applicable なのに
    // 「休憩時間は労働基準法89条の絶対的記載事項です…」等の定型文が計653字ぶら下がっていた。
    // 見出しは「なぜ:」＝**なぜ直すのか**なので、直すものが無い項目に理由は要らない。
    // 画面とテキストの両方に効くよう、ここで落とす（表示側の分岐を増やさない）。
    return needsWork(out) ? out : { ...out, why_it_matters: "" };
  });

  const written = blocks.filter((b) => b.status === "written").length;
  const ops = blocks.filter((b) => b.status === "ops_missing").length;
  const un = blocks.filter((b) => b.status === "unmentioned").length;

  // 本文が読めなかったときは、数え直した内訳を結論にすると「34件触れていない」と誤報になる。
  // そのときだけ呼び出し側の一文（理由）を残す。
  const headline =
    sheet.document?.extracted_ok === false
      ? sheet.summary?.headline || "本文を読めませんでした"
      : buildHeadline(blocks);

  return {
    schema_version: "2026-08-29.1",
    disclaimer: DISCLAIMER,
    document: sheet.document,
    summary: {
      headline: headline || "このファイルから読み取れたこと",
      written_count: written,
      ops_missing_count: ops,
      unmentioned_count: un,
      unread_note: sheet.summary?.unread_note ?? null,
    },
    blocks,
    contradictions: (sheet.contradictions ?? []).filter(
      (c) => quoteExists(source, c.left.quote) && quoteExists(source, c.right.quote),
    ),
    // followups は結論のすぐ隣に出る。断定を含む文だけ落とし、空になったものは捨てる。
    followups: (sheet.followups ?? [])
      .map((f) => (typeof f === "string" ? scrubForbidden(f) : ""))
      .filter((f) => f.trim().length > 0),
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
