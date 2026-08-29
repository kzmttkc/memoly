import { readFileSync } from "node:fs";
import { enforceTaxonomy } from "../../lib/gap-engine/engine/validateSheet";
import { DISCLAIMER } from "../../lib/gap-engine/taxonomy/items";
import type { GapSheet } from "../../lib/gap-engine/engine/types";

const gold = JSON.parse(
  readFileSync(new URL("./gold/sample-thin.json", import.meta.url), "utf8"),
) as { text: string };

const source = gold.text;

const hallucinated: GapSheet = {
  schema_version: "x",
  disclaimer: "",
  document: {
    title_guess: "x",
    page_count: 1,
    pages_read: 1,
    pages_unread: [],
    char_count: source.length,
    extracted_ok: true,
  },
  summary: {
    headline: "",
    written_count: 0,
    ops_missing_count: 0,
    unmentioned_count: 0,
    unread_note: null,
  },
  blocks: [
    {
      id: "abs.hours_start_end",
      group: "absolute_lsa89",
      title: "始業・終業の時刻",
      status: "written",
      priority: "p1_absolute",
      what_found: "あり",
      what_not_found: "",
      why_it_matters: "",
      next_step: "",
      citations: [{ quote: "始業は午前9時、終業は午後6時とする" }],
    },
    {
      id: "kasuhara.policy",
      group: "kasuhara_2026_10",
      title: "カスタマーハラスメントの方針",
      status: "written",
      priority: "p0_deadline",
      what_found: "捏造",
      what_not_found: "",
      why_it_matters: "違法です",
      next_step: "",
      citations: [{ quote: "この引用は本文に存在しないカスハラ方針" }],
    },
  ],
  contradictions: [],
  followups: [],
};

const out = enforceTaxonomy(hallucinated, source);
const hours = out.blocks.find((b) => b.id === "abs.hours_start_end");
const kasu = out.blocks.find((b) => b.id === "kasuhara.policy");
const raise = out.blocks.find((b) => b.id === "abs.raise");

const checks: [string, boolean][] = [
  ["disclaimer fixed", out.disclaimer === DISCLAIMER],
  ["hours stays written", hours?.status === "written"],
  ["kasuhara quote dropped", kasu?.status === "unmentioned"],
  ["taxonomy completed", raise?.id === "abs.raise"],
  ["forbidden scrubbed", !/違法/.test(kasu?.why_it_matters ?? "")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "ok" : "NG"}  ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`failed ${failed}`);
  process.exit(1);
}
console.log("offline eval passed");
