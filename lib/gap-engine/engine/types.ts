import type { GapPriority, GapStatus } from "../taxonomy/items";

export type Citation = {
  quote: string;
  approx_locus?: string;
};

export type GapBlock = {
  id: string;
  group: string;
  title: string;
  status: GapStatus;
  priority: GapPriority;
  deadline?: string;
  what_found: string;
  what_not_found: string;
  why_it_matters: string;
  next_step: string;
  citations: Citation[];
};

export type Contradiction = {
  id: string;
  priority: GapPriority;
  left: { locus?: string; quote: string };
  right: { locus?: string; quote: string };
  note: string;
};

export type GapSheet = {
  schema_version: string;
  disclaimer: string;
  document: {
    title_guess: string;
    page_count: number;
    pages_read: number;
    pages_unread: number[];
    char_count: number;
    extracted_ok: boolean;
  };
  summary: {
    headline: string;
    written_count: number;
    ops_missing_count: number;
    unmentioned_count: number;
    unread_note: string | null;
  };
  blocks: GapBlock[];
  contradictions: Contradiction[];
  followups: string[];
};

export type MemoryRecord = {
  key: string;
  label: string;
  value: string;
  locus?: string;
  quote?: string;
  confidence: "high" | "medium";
};

export type AnalyzeInput = {
  text: string;
  pageCount?: number;
  pagesUnread?: number[];
  industry?: string;
  headcountBand?: string;
  titleGuess?: string;
};

export type LlmClient = {
  completeJson: (args: {
    system: string;
    user: string;
    maxTokens?: number;
  }) => Promise<string>;
};
