import { TAXONOMY, DISCLAIMER } from "../taxonomy/items";
import { GAP_SYSTEM } from "../prompts/constitution";
import type { AnalyzeInput, GapBlock, GapSheet, LlmClient } from "./types";
import { enforceTaxonomy, parseSheetJson } from "./validateSheet";
import { heuristicGapSheet } from "../fallback";

export const PROMPT_VERSION = "gap-2026-08-31.1";

/**
 * チェック項目を何分割して並列に投げるか。
 *
 * 2026-08-31 実測（実物大 29KB の就業規則・claude-sonnet-4-6）:
 *   1回で34項目 … 出力 6,311tok / **87.1秒** → 関数上限60秒を超えて 504。
 *   max_tokens=2000 に絞る … 30.1秒で stop_reason=max_tokens、JSON が途中で切れて
 *     parse に失敗 → 例外 → ヒューリスティックへ。**上限を絞っても直らず、
 *     失敗の形がタイムアウトから切り捨てに変わっただけだった。**
 *   4分割を並列 … 43.9秒 / 全バッチ end_turn / 34項目そろう。→ これを採る。
 *
 * 分割数を増やすほど1回あたりの生成が短くなり締切内に返りやすいが、
 * 同じ本文を何度も入力に載せるので入力トークンは分割数に比例して増える。
 * 4 は「60秒に収まる」と「入力の重複」の折り合いとして実測から選んだ。
 */
const BATCHES = 4;

/** 1バッチあたりの締切。関数上限（60秒）より必ず短くする。 */
const BATCH_DEADLINE_MS = 42_000;

function buildUserPrompt(input: AnalyzeInput, items: typeof TAXONOMY): string {
  const checklist = items.map((t) => ({
    id: t.id,
    title: t.title,
    group: t.group,
    priority: t.priority,
    deadline: t.deadline ?? null,
    lookFor: t.lookFor,
    allowNotApplicable: t.allowNotApplicable,
  }));
  return `[CHECKLIST_JSON]
${JSON.stringify(checklist)}

[COMPANY_HINT]
業種: ${input.industry ?? "未設定"}
人数帯: ${input.headcountBand ?? "未設定"}
未読ページ: ${(input.pagesUnread ?? []).join(",") || "なし"}
総ページ: ${input.pageCount ?? "不明"}

[DOCUMENT_TEXT]
${input.text.slice(0, 120000)}`;
}

export function emptySheet(input: AnalyzeInput, reason: string): GapSheet {
  return enforceTaxonomy(
    {
      schema_version: "2026-08-29.1",
      disclaimer: DISCLAIMER,
      document: {
        title_guess: input.titleGuess ?? "",
        page_count: input.pageCount ?? 0,
        pages_read: 0,
        pages_unread: input.pagesUnread ?? [],
        char_count: input.text.trim().length,
        extracted_ok: false,
      },
      summary: {
        headline: "本文を読めませんでした",
        written_count: 0,
        ops_missing_count: 0,
        unmentioned_count: 0,
        unread_note: reason,
      },
      blocks: [],
      contradictions: [],
      followups: ["画像PDFの場合はテキスト付きPDFかWordに変換して置き直す"],
    },
    input.text,
  );
}

export async function runGapSheet(
  client: LlmClient,
  input: AnalyzeInput,
): Promise<GapSheet> {
  const text = (input.text ?? "").trim();
  if (text.length < 80) {
    return emptySheet(input, "抽出文字が少なすぎます。画像PDFや保護ファイルの可能性があります。");
  }

  // 34項目を BATCHES 個に割って並列に投げる（理由と実測値は BATCHES の注記）。
  // 落ちたバッチだけヒューリスティックで埋める——1バッチの失敗で
  // 全体をヒューリスティックへ落とすと、読めていた項目まで捨てることになるため。
  const size = Math.ceil(TAXONOMY.length / BATCHES);
  const groups: (typeof TAXONOMY[number])[][] = [];
  for (let i = 0; i < TAXONOMY.length; i += size) groups.push(TAXONOMY.slice(i, i + size));

  const settled = await Promise.all(
    groups.map(async (g) => {
      try {
        const raw = await client.completeJson({
          system: GAP_SYSTEM,
          user: buildUserPrompt({ ...input, text }, g),
          maxTokens: 4000,
          timeoutMs: BATCH_DEADLINE_MS,
        });
        return parseSheetJson(raw);
      } catch (e) {
        console.error("[runGapSheet] batch failed", (e as Error)?.message);
        return null;
      }
    }),
  );

  if (settled.every((s) => s === null)) {
    throw new Error("all_batches_failed");
  }

  const fallbackById = new Map(
    heuristicGapSheet({ ...input, text }).blocks.map((b) => [b.id, b]),
  );
  const byId = new Map<string, GapBlock>();
  for (const s of settled) {
    for (const b of s?.blocks ?? []) if (b?.id) byId.set(b.id, b);
  }

  // 生き残ったバッチの1本を器として使う。**中身は全バッチから作り直す**——
  // 2026-09-05 の再監査まで、blocks / contradictions / followups だけを作り直し、
  // summary.headline は器（＝先頭バッチ）のものをそのまま出していた。先頭バッチは
  // TAXONOMY の先頭9件＝すべてカスハラなので、「年5日の時季指定」「時間外労働の上限」
  // 「割増賃金の率」は構造上その結論に載らず、先頭バッチが落ちれば2本目の結論が
  // 全体の結論として出ていた。結論は enforceTaxonomy が34項目の実数から組み立てる。
  const parsed = settled.find((s) => s !== null)!;
  parsed.blocks = TAXONOMY.map((item) => byId.get(item.id) ?? fallbackById.get(item.id))
    .filter((b): b is GapBlock => Boolean(b));
  parsed.contradictions = settled.flatMap((s) => s?.contradictions ?? []);
  parsed.followups = [...new Set(settled.flatMap((s) => s?.followups ?? []))];
  parsed.summary = {
    ...parsed.summary,
    headline: "",
    unread_note:
      settled.map((s) => s?.summary?.unread_note).find((v) => v) ?? null,
  };
  parsed.document = {
    title_guess: parsed.document?.title_guess || input.titleGuess || "",
    page_count: input.pageCount ?? parsed.document?.page_count ?? 0,
    pages_read:
      (input.pageCount ?? 0) - (input.pagesUnread?.length ?? 0) ||
      parsed.document?.pages_read ||
      0,
    pages_unread: input.pagesUnread ?? parsed.document?.pages_unread ?? [],
    char_count: text.length,
    extracted_ok: true,
  };
  return enforceTaxonomy(parsed, text);
}

export function toAnonymousStats(args: {
  industry?: string;
  headcountBand?: string;
  sheet: GapSheet;
  yyyymm: string;
}): { yyyymm: string; industry: string; headcount_band: string; item_id: string; status: string }[] {
  const industry = args.industry || "unspecified";
  const band = args.headcountBand || "unspecified";
  return args.sheet.blocks.map((b) => ({
    yyyymm: args.yyyymm,
    industry,
    headcount_band: band,
    item_id: b.id,
    status: b.status,
  }));
}
