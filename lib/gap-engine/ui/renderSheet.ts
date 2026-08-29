import type { GapSheet } from "../engine/types";

const PRIORITY_ORDER = ["p0_deadline", "p1_absolute", "p2_dispute", "p3_optional"];
const STATUS_LABEL: Record<string, string> = {
  written: "規程にある",
  ops_missing: "制度はあるが運用の書き方がまだない",
  unmentioned: "このファイルでは触れていない",
  unread: "未読ページに残している",
  not_applicable: "このファイルでは制度を置いていないと読める",
};

export function sortBlocks(sheet: GapSheet) {
  return [...sheet.blocks].sort((a, b) => {
    const pd = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (pd !== 0) return pd;
    return a.id.localeCompare(b.id);
  });
}

export function blockLine(status: string, title: string): string {
  return `${STATUS_LABEL[status] ?? status}  ${title}`;
}
