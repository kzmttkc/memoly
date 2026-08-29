export const PLANS = {
  free: { yen: 0, seats: 3, docs: 1, chats: 20, drafts: 3, clients: 1 },
  entry: { yen: 3980, yearly: 39800, seats: 5, docs: 10, chats: 50, drafts: 10, clients: 1 },
  standard: { yen: 9800, seats: 20, docs: 50, chats: 150, drafts: 30, clients: 1 },
  shiwa: { yenPerSeat: 29800, seatsMax: 50, docs: 200, chats: 400, drafts: 80, clients: 50 },
} as const;

export function overQuota(
  plan: keyof typeof PLANS,
  used: { chats: number; drafts: number },
  kind: "chats" | "drafts",
): boolean {
  return used[kind] >= PLANS[plan][kind];
}
