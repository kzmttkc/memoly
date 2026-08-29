import { TAXONOMY, DISCLAIMER } from "../taxonomy/items";
import { GAP_SYSTEM } from "../prompts/constitution";
import type { AnalyzeInput, GapSheet, LlmClient } from "./types";
import { enforceTaxonomy, parseSheetJson } from "./validateSheet";

export const PROMPT_VERSION = "gap-2026-08-29.1";

function buildUserPrompt(input: AnalyzeInput): string {
  const checklist = TAXONOMY.map((t) => ({
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

  const raw = await client.completeJson({
    system: GAP_SYSTEM,
    user: buildUserPrompt({ ...input, text }),
    maxTokens: 8000,
  });

  const parsed = parseSheetJson(raw);
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
