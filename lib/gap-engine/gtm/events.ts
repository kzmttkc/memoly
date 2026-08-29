export const EVENTS = {
  zure_view: { props: ["variant"] },
  zure_file_selected: { props: ["ext", "bytes"] },
  zure_paste_used: { props: ["chars"] },
  zure_sheet_generated: {
    props: ["ms", "pages_read", "pages_unread", "p0_unwritten", "p1_unwritten"],
  },
  zure_kasuhara_block_shown: { props: ["unwritten_count"] },
  zure_save_clicked: { props: ["authed"] },
  zure_save_completed: { props: ["document_id"] },
  consult_sent: { props: ["thread_new"] },
  consult_answered: { props: ["ms", "used_memories"] },
  memo_generated: { props: ["p0_unwritten"] },
  memo_copied: { props: ["bytes"] },
  plan_checkout_started: { props: ["plan"] },
  plan_activated: { props: ["plan"] },
  plan_canceled: { props: ["plan"] },
} as const;

export type EventName = keyof typeof EVENTS;
