# P0 Acquisition Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the acquisition path operable: CEO scoreboard, public offer boundary page, funnel event documentation, and CTA two-step prep hooks—without unlocking irreversible billing.

**Architecture:** Governance docs already live under `docs/ceo/`. Runtime work is (1) a Node scoreboard that reads `lib/offer.ts` constants and optional Plausible/Stripe env, (2) a new public `/offer` page as the single pricing-story surface, (3) footer/pricing links, (4) funnel event SSOT file. Sharoushi HTML CTA changes are a follow-up ticket on the sister repo.

**Tech Stack:** Next.js App Router, TypeScript, Plausible custom events, existing `PublicFooter` / `track` helpers.

---

### Task 1: FUNNEL_EVENTS SSOT for north star

**Files:**
- Create: `docs/FUNNEL_EVENTS.md`
- Test: manual review (markdown)

- [ ] **Step 1: Create FUNNEL_EVENTS.md** documenting `zure_sheet_shown` as north-star proxy, QA exclusion rules, and related events (`signup_completed`, `subscription_started`, `banto_cta`, `offer_view`).

- [ ] **Step 2: Cross-link from `docs/ceo/00_CEO_CHARTER.md` §3** (already references event name; ensure FUNNEL path is listed in §6).

---

### Task 2: P0 scoreboard script

**Files:**
- Create: `scripts/p0_scoreboard.mjs`
- Create: `scripts/p0_scoreboard.test.mjs` (optional node:test) OR document `--dry-run`

- [ ] **Step 1: Write script** that:
  - Parses `fileTarget`, `kabauFileTarget`, `killDate` from `lib/offer.ts` via regex
  - Prints days remaining to killDate
  - If `PLAUSIBLE_API_KEY` + site id present, fetch `zure_sheet_shown` count since 2026-08-28; else print MANUAL_REQUIRED
  - Writes `state/p0_scoreboard.json` under repo (or `docs/ceo/state/` if state/ missing—prefer `docs/ceo/state/p0_scoreboard.json` to avoid new top-level)

- [ ] **Step 2: Run** `node scripts/p0_scoreboard.mjs --dry-run` and confirm exit 0.

---

### Task 3: Public `/offer` page

**Files:**
- Create: `app/offer/page.tsx`
- Modify: `components/ui/PublicFooter.tsx` (add link)
- Modify: `app/pricing/page.tsx` (one-line link to /offer)
- Modify: sitemap if there is a central list

- [ ] **Step 1: Implement page** per `docs/ceo/04_OFFER_BOUNDARY_SPEC.md` using `BRAND_*` and `PLANS` display amounts.

- [ ] **Step 2: Add `offer_view` via client island** `OfferViewTrack.tsx` using `trackOncePerVisit`.

- [ ] **Step 3: Footer + pricing link**.

- [ ] **Step 4: Local typecheck / lint on touched files**.

---

### Task 4: Cursor CEO rule

**Files:**
- Create: `.cursor/rules/ceo-operating.mdc` (`alwaysApply: true`)

- [ ] **Step 1: Rule** summarizing charter north star, don'ts, and prompt to read `docs/ceo/03_CEO_PROMPTS.md`.

---

### Task 5: Company mirror + Downloads handoff

**Files:**
- Copy ceo docs to `~/Takeshi_Automation/.company/products/banto/ceo/`
- Copy charter + roadmap to `~/Downloads/` with touch

- [ ] **Step 1: Mirror and touch Downloads.**

---

### Task 6: (Sister repo / later) hoken CTA two-step

**Files (sharoushi site, not this repo):**
- `hoken-sim.html` + CSS/JS as needed

- [ ] **Step 1: Spec only in this plan**—personal next action primary; company zure secondary. Implement when sister repo is open.

---

## Execution order

1 → 2 → 3 → 4 → 5 → 6(later)

## Done when

- Scoreboard runs
- `/offer` builds
- Rule exists
- Owner can approve charter and ask CEO to continue W1
