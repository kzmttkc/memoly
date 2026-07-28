// ============================================================================
// industries.en — English data for the /business/en demo (TryDemoEn).
//   2026-07-29 CTO (L3 audit #1): the English LP had no equivalent of the
//   Japanese /business demo (TryDemo) at all. This file is a faithful English
//   rendering of the same facts already published (and Phase1-reviewed) in
//   ../industries.ts — not new legal claims. Numbers, thresholds and caveats
//   match the Japanese source 1:1; only the language changes.
//
//   Phase1 compliance (same as the Japanese source):
//     - General information only. No individualized legal advice, no
//       guaranteed outcomes. Each answer ends with a plain caveat.
//     - No "supervised by a licensed labor consultant" / "AI labor
//       consultant" framing.
// ============================================================================

export type EnIndustryKey = 'manufacturing' | 'foodservice' | 'it' | 'construction' | 'other'

export type EnDemoQA = { q: string; a: string }

export type EnIndustryPreset = {
  key: EnIndustryKey
  label: string
  tags: string[]
  qa: EnDemoQA[]
}

export const EN_INDUSTRIES: EnIndustryPreset[] = [
  {
    key: 'manufacturing',
    label: 'Manufacturing',
    tags: ['Manufacturing', '8 employees', '8h/day, 40h/week', 'No 36 Agreement filed'],
    qa: [
      {
        q: 'Can we ask staff to work overtime next week?',
        a: 'Your company has not filed a 36 Agreement, so under current conditions, having employees work overtime at all could violate the Labor Standards Act. The first step is to elect a representative of the majority of employees, conclude a 36 Agreement, and file it with the Labor Standards Inspection Office. Manufacturing is subject to the general overtime cap: 45 hours/month and 360 hours/year in principle. If busy-season overtime is expected, you can design the agreement with a special provision (extended cap). (General information — please confirm the details that apply to your actual operations with a professional.)',
      },
      {
        q: 'How many days of paid leave should we grant?',
        a: 'A full-time employee (5 days/week) is entitled to 10 days after 6 months of employment with an 80%+ attendance rate, increasing with tenure up to 20 days at 6 years 6 months. With 8 employees, remember the 5-day mandatory-use rule also applies to anyone granted 10+ days. Part-time staff working fewer days per week receive a prorated number of days. (General information.)',
      },
      {
        q: "What's the risk if we don't have a 36 Agreement?",
        a: 'Having employees work beyond statutory hours (8 hours/day, 40 hours/week) or on statutory holidays without a 36 Agreement can violate Articles 32 and 36 of the Labor Standards Act, and may be subject to penalties. Since busy-season overtime is expected, the safest path is: elect a majority representative, conclude the agreement, then file it with the Labor Standards Inspection Office — and keep within statutory hours until the filing is complete. (General information. Please confirm the final judgment with a professional.)',
      },
    ],
  },
  {
    key: 'foodservice',
    label: 'Food service',
    tags: ['Food service', '9 employees', 'Shift-based', 'Mostly part-time staff'],
    qa: [
      {
        q: 'Do part-time staff get paid leave too?',
        a: 'Yes. Part-time employees with fewer scheduled working days receive prorated paid leave — for example, someone working 3 days/week gets 5 days after 6 months with 80%+ attendance. Since your team is mostly part-time on a shift basis, tracking each person\'s scheduled working days is the reliable way to manage this. Anyone granted 10+ days/year is also subject to the mandatory 5-day-use rule. (General information — please confirm actual operation with a professional.)',
      },
      {
        q: "I've heard our size can work up to 44 hours/week — is that right?",
        a: 'Restaurants and other customer-service businesses with fewer than 10 regular employees can qualify for a special exception allowing 44 statutory hours/week instead of 40. With 9 employees, you may qualify, but the 8-hour daily cap still applies, and any overtime beyond that still requires a filed 36 Agreement. (General information. Please confirm the final judgment with a professional.)',
      },
      {
        q: 'Can we schedule a high-school-age part-timer for a late shift?',
        a: 'Workers under 18 are generally prohibited from late-night work between 10pm and 5am (Labor Standards Act Article 61). Workers 18 and over can work late nights, but any hours after 10pm require a night-shift premium of at least 25%. Since you run shifts, checking age at scheduling time — and keeping under-18 staff out of late-night shifts by design — is the safe approach. (General information.)',
      },
    ],
  },
  {
    key: 'it',
    label: 'IT',
    tags: ['IT / software', '15 employees', 'Flextime', 'Remote work allowed'],
    qa: [
      {
        q: 'How is overtime calculated under flextime?',
        a: "Under flextime, overtime is judged over the whole settlement period, not day by day. For a one-month settlement period, hours beyond the statutory total (40 hours x calendar days ÷ 7) count as overtime. Since your company uses flextime, the right approach is watching whether the running total is approaching that cap mid-period, rather than giving daily overtime instructions. (General information — please confirm actual operation with a professional.)",
      },
      {
        q: 'Do we still need to track working hours for remote staff?',
        a: "Yes. Even for remote work, employers are required to track working hours, and objective records (like PC login logs) are the expected method. Since you allow remote work, if you rely on self-reporting, it's safer to also check that self-reports aren't significantly diverging from actual activity. (General information.)",
      },
      {
        q: 'Can we put engineers on a discretionary-work (裁量労働) scheme?',
        a: "Work involving the analysis and design of information systems can qualify for the professional-type discretionary work scheme, but work limited to plain programming is generally considered outside its scope. Introducing it requires a labor-management agreement, a filing, and — since April 2024 — the individual employee's consent. Since you currently use flextime, comparing which system actually fits your real work patterns is the practical starting point. (General information. Please confirm the final judgment with a professional.)",
      },
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    tags: ['Construction', '30 employees', '44h/week exception: N/A', 'No 36 Agreement filed'],
    qa: [
      {
        q: 'Does the overtime cap regulation apply to construction companies?',
        a: 'Yes. Construction had a grace period, but the overtime cap regulation has applied to the industry since April 2024. The general caps are 45 hours/month and 360 hours/year, extendable via a special-provision agreement for temporary special circumstances — though disaster recovery/reconstruction work is treated differently and partially exempt from the cap. Since your company has not filed a 36 Agreement yet, concluding and filing one comes first. (General information — details not yet finalized should be confirmed with the Ministry of Health, Labour and Welfare or a professional.)',
      },
      {
        q: "If our sites run 6 days a week, do the working-hour rules still apply the same way?",
        a: "Yes — statutory working hours (8 hours/day, 40 hours/week) apply regardless of industry, and exceeding them requires a filed 36 Agreement plus premium pay. With 30 employees, tracking binding hours per site and checking monthly against the cap is a practical approach. (General information — please confirm actual operation with a professional.)",
      },
      {
        q: 'Do our labor rules apply to sole-proprietor subcontractors on site?',
        a: "Labor rules generally apply to employees under an employment contract who work under the company's direction. They generally do not apply to a sole proprietor working under a contract-for-work arrangement who isn't legally a 'worker.' If someone is, in practice, working under your direction despite a contract-for-work on paper, worker status can become a genuine point of dispute. Whether your contract structure matches the actual working reality is a case-by-case question best confirmed with a professional. (General information.)",
      },
    ],
  },
  {
    key: 'other',
    label: 'Other industries',
    tags: ['Any industry', 'General labor rules'],
    qa: [
      {
        q: 'Can we ask employees to work overtime?',
        a: "Having employees work overtime requires first concluding a 36 Agreement and filing it with the Labor Standards Inspection Office. If already filed, check whether you're within the general cap of 45 hours/month and 360 hours/year. If not yet filed, having employees work overtime at all can violate the Labor Standards Act, so filing comes first. (General information — please confirm actual operation with a professional.)",
      },
      {
        q: 'How many days of paid leave should we grant?',
        a: "A full-time employee (5 days/week) is granted 10 days after 6 months of employment with 80%+ attendance, increasing with tenure. Part-time staff with fewer scheduled days receive a prorated amount. Anyone granted 10+ days/year is also subject to the mandatory 5-day-use rule. (General information.)",
      },
      {
        q: 'Do we have to have work rules (shugyo kisoku)?',
        a: "Workplaces that regularly employ 10 or more workers are required to draft work rules and file them with the Labor Standards Inspection Office. Even under 10, writing your rules down in plain language helps prevent disputes and speeds up everyday decisions. Starting with the rules you actually need, based on your size and industry, is the practical approach. (General information — please confirm the final judgment with a professional.)",
      },
    ],
  },
]

export const EN_DEFAULT_INDUSTRY: EnIndustryKey = 'manufacturing'

export function getEnIndustry(key: EnIndustryKey): EnIndustryPreset {
  return EN_INDUSTRIES.find(i => i.key === key) ?? EN_INDUSTRIES[0]
}
