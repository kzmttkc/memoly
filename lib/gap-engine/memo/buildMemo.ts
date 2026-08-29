import { ADVICE_FOOTER } from "../taxonomy/items";
import type { GapSheet, MemoryRecord } from "../engine/types";

export type MemoInput = {
  companyName: string;
  industry?: string;
  headcountBand?: string;
  documents: string[];
  sheet?: GapSheet;
  memories: MemoryRecord[];
  deadlines: { title: string; dueOn: string }[];
  questions: string[];
};

export function buildMemo(input: MemoInput): string {
  const p0 = input.sheet?.blocks.filter((b) => b.priority === "p0_deadline" && b.status !== "written") ?? [];
  const p1 = input.sheet?.blocks.filter((b) => b.priority === "p1_absolute" && b.status !== "written") ?? [];
  const mem = input.memories.filter((m) => m.confidence === "high").slice(0, 12);

  const lines = [
    "社労士に渡すメモ（就業規則AI）",
    "",
    "■ 会社の基本情報",
    `- 名称: ${input.companyName || "未登録"}`,
    `- 業種: ${input.industry || "未登録"}`,
    `- 人数帯: ${input.headcountBand || "未登録"}`,
    "",
    "■ 整備済みとして残している規程",
    ...(input.documents.length ? input.documents.map((d) => `- ${d}`) : ["- 未登録"]),
    "",
    "■ ずれ1枚のうち、ファイルから十分に読めなかった p0（2026-10-01）",
    ...(p0.length ? p0.map((b) => `- ${b.title}（${b.status}）`) : ["- p0 は written として整理されています。不足の断定ではありません。"]),
    "",
    "■ ずれ1枚のうち、絶対的記載に近い p1",
    ...(p1.length ? p1.map((b) => `- ${b.title}（${b.status}）`) : ["- p1 は written として整理されています。"]),
    "",
    "■ 近づいている期限",
    ...(input.deadlines.length ? input.deadlines.map((d) => `- ${d.dueOn} ${d.title}`) : ["- 登録なし"]),
    "",
    "■ ファイルから high で残した運用",
    ...(mem.length ? mem.map((m) => `- ${m.label}: ${m.value}${m.locus ? `（${m.locus}）` : ""}`) : ["- なし"]),
    "",
    "■ 相談したい論点",
    ...(input.questions.length ? input.questions.slice(0, 5).map((q) => `- ${q}`) : ["- 未記入"]),
    "",
    "このメモは就業規則AIがファイルと登録情報から作った整理です。専門家の見解ではありません。",
    ADVICE_FOOTER,
  ];
  return lines.join("\n");
}
