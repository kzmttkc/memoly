import type { Scenario } from './scenarios'

// ============================================================================
// scenarios.en — English rendering of SCENARIOS (./scenarios.ts).
//   2026-07-29 CTO (L3 audit #1): the English LP had no equivalent of
//   ScenarioSection at all. This is a faithful translation of the same
//   verified internal test-session records in scenarios.ts — not new or
//   embellished content. Same constraint applies: these are the operator's
//   own internal verification sessions, not real-customer testimonials.
//   Keep in sync with scenarios.ts by hand when that file changes
//   (small, hand-curated list; no automated i18n pipeline for this data yet).
// ============================================================================

export const SCENARIOS_EN: Scenario[] = [
  {
    industry: 'Apparel retail',
    employees: '20 employees',
    topic: 'Teaching Kabau the company\'s paid-leave rule and checking it answers with that exact setting',
    duration: 'A few minutes after teaching it',
    quote:
      'We told Kabau, through conversation, that paid leave is granted "11 days after 6 months" (one day more than the statutory 10) and then asked how many days of paid leave our company grants. Kabau answered 11 days — not the statutory 10 — and even noted that this was one day above the legal minimum. The answer cited the one company rule it referenced, confirming that a fact taught in conversation is reflected directly in later answers.',
    verifiedOn: '2026-07-24',
  },
  {
    industry: 'Construction',
    employees: '30 employees',
    topic: 'How the overtime cap regulation (construction\'s "2024 problem") applies to this company',
    duration: 'About 30 seconds to the answer',
    quote:
      "Asked how the overtime cap applies to construction, Kabau explained that the regulation started applying to construction in April 2024, walked through the general cap and the special-provision exception, and noted that disaster recovery/reconstruction work is treated differently. For anything not yet finalized, it flagged that as something to confirm with the Ministry of Health, Labour and Welfare, and proactively pointed out that if the 36 Agreement isn't filed yet, that should happen first. The industry and headcount entered at signup were reflected in the answer's premise.",
    verifiedOn: '2026-07-24',
  },
  {
    industry: 'Trucking / logistics',
    employees: '40 employees',
    topic: "Checking driver binding-hour rules (the Improvement Standard notice) against this company",
    duration: 'A few tens of seconds to the first answer',
    quote:
      "Asked about driver binding hours, Kabau cited the key points of the Improvement Standard notice — the monthly binding-hour cap, daily binding/rest-hour rules, and the mandatory break after every 4 hours of continuous driving — with sources, and wove in the company's own name. It was upfront that the company's own rules weren't registered yet, and suggested that registering them would let it check compliance from the company's actual situation next.",
    verifiedOn: '2026-07-24',
  },
  {
    industry: 'Manufacturing',
    employees: '150 employees',
    topic: 'Whether Kabau can run alongside SmartHR and existing tools without double data entry',
    duration: 'A few minutes from signup to the answer',
    quote:
      'Given the premise that we already use SmartHR and a separate attendance system, we asked what Kabau replaces and what it adds, and whether all our rules would need re-entering. Kabau laid out, step by step, that procedures and employee data stay in the existing tools, that Kabau\'s role is to remember internal rules, policies, and past decisions and answer questions about them, and that rules don\'t need to be re-entered wholesale — just the parts you want to discuss, taught through conversation. This matched the comparison table and the "if you already use SmartHR" note elsewhere on the site.',
    verifiedOn: '2026-07-24',
  },
  {
    industry: 'Tax accounting firm',
    employees: '20 client companies',
    topic: 'Whether memory stays separate across client companies, and whether you can switch between them',
    duration: 'About 20 seconds to the answer',
    quote:
      "Asked whether memory stays separate when different client companies have different work rules, Kabau confirmed that rules and memory are isolated per company and don't mix when you switch — with a caveat to confirm specifics with a professional. When we tried adding a second company, it explained, with the reason and the next step, that switching between multiple clients requires the professional (multi-client) plan — answering the underlying worry about client data mixing both on-screen and in the chat itself.",
    verifiedOn: '2026-07-24',
  },
  {
    industry: 'Manufacturing (metal processing)',
    employees: '18 employees',
    topic: 'By when does the 36 Agreement need to be filed, and what should we do this year?',
    duration: 'About 6 minutes',
    quote:
      'Within minutes of signing up, we confirmed — without wading through jargon — that a 36 Agreement must be filed and accepted before any overtime starts, that it needs re-filing every year before it expires, and that Form 9 can be submitted via e-Gov. The items to check this year came back as a checklist, so even someone taking over the role mid-year could see what to do first.',
    verifiedOn: '2026-07-23',
  },
  {
    industry: 'Restaurant chain (multiple locations)',
    employees: 'Mostly part-time staff',
    topic: 'Are part-timers covered by the mandatory 5-day paid-leave rule, and who exactly qualifies?',
    duration: 'About 1 minute with the free tool + about 34 seconds for the first chat answer',
    quote:
      'We confirmed on the spot that part-timers granted 10+ days of paid leave per year are subject to the mandatory 5-day-use rule, and that a part-timer working 4 days/week could qualify. It also flagged that larger workplaces are more prone to tracking gaps, mentioned the penalty (up to ¥300,000 per person), and helped us see that we needed a list of each person\'s base date.',
    verifiedOn: '2026-07-23',
  },
  {
    industry: 'Information & communications',
    employees: '25 employees',
    topic: 'Verifying data isolation and what happens to data after account deletion, before trusting it with our rules',
    duration: 'About 2 minutes from signup to the first answer',
    quote:
      "When we edited the company ID in the URL to point at another company, we got a 403 — and Kabau itself confirmed there's no mechanism for the AI to access another company's data at all. Seeing row-level data isolation actually enforced, rather than just claimed, resolved our hesitation about handing over our rules. We also confirmed that after deleting the account, logging back in is genuinely no longer possible.",
    verifiedOn: '2026-07-23',
  },
  {
    industry: 'Foreign-owned IT (Japan subsidiary)',
    employees: 'About 15 employees',
    topic: "Understanding Japan's paid-leave rules (including the mandatory 5-day rule) in English",
    duration: 'About 2 minutes from question to the English explanation',
    quote:
      "Asking in English, Kabau answered accurately in English — the paid-leave grant table, the mandatory 5-day-use rule, and carry-over — citing the Labor Standards Act as its source. It was clear that some specifics couldn't be confirmed until the company's own work rules were registered. A team member who doesn't read Japanese could get an accurate overview of the system in their own language.",
    verifiedOn: '2026-07-23',
  },
]
