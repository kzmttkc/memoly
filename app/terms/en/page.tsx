import Link from 'next/link'
import type { Metadata } from 'next'

// ============================================================================
// /terms/en — English translation of /terms (2026-07-28 CTO, L1 audit #3).
//   This is the document an English-speaking signup (?lang=en) consents to
//   in place of the Japanese /terms. Content must stay in sync with /terms;
//   when editing one, check the other.
// ============================================================================

export const metadata: Metadata = {
  title: 'Terms of Service | Banto',
  description: 'Terms of Service for Banto (English).',
  // 2026-07-30 PMF fix #3: pair this page with the Japanese original via hreflang
  //   (site-wide there were 0 hreflang tags and no /en URL in sitemap.xml).
  //   The reciprocal declaration on /terms (Japanese) is owned by another team
  //   this session and is filed as a work order.
  alternates: {
    canonical: '/terms/en',
    languages: {
      ja: '/terms',
      en: '/terms/en',
      'x-default': '/terms',
    },
  },
}

export default function TermsEnglishPage() {
  return (
    // lang on the subtree root: app/layout.tsx renders the only <html> element
    // and emits lang="ja" for every route (see app/business/en/page.tsx for why
    // it is not path-aware). The nearest ancestor lang wins per the HTML spec.
    <div lang="en" className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business/en" className="text-sm text-neutral-500 hover:text-neutral-700">
            Back to top
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Terms of Service</h1>
          <p className="mt-1 text-sm text-neutral-500">Last updated: August 23, 2026</p>
          <p className="mt-1 text-xs text-neutral-500">
            English translation for reference. The <Link href="/terms" className="underline">Japanese version</Link> is the governing text in case of any discrepancy.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. Service overview</h2>
            <p>
              Banto (&quot;the Service&quot;) starts from a work rules file (or pasted text). It puts what is
              written and what is not onto one page. After you choose to keep that page, the Service
              stores it as a company document and later answers use that document and labor facts as
              the premise. The Service is operated by KIZUNA Creation (a sole proprietorship operated
              by Kazumoto Takeshi). Banto uses{' '}
              <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                Anthropic (Claude API)
              </a>{' '}
              to generate AI responses. For how to obtain the operator&apos;s name, address, and
              contact details, see the{' '}
              <Link href="/tokushoho" className="text-brand-600 underline">
                Act on Specified Commercial Transactions disclosure
              </Link>{' '}
              page.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. Eligibility</h2>
            <p className="font-medium text-warning-700">
              The Service is available only to business users (including corporations and sole
              proprietors) who are 18 years of age or older and use the Service for business
              purposes.
            </p>
            <p className="mt-2">
              Use as a consumer for personal purposes is out of scope. At signup you are asked to
              confirm &quot;I am using this as a business (18+)&quot;.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">3. About AI responses</h2>
            <p className="text-warning-700">
              AI responses are reference information only; accuracy and completeness are not
              guaranteed. For matters requiring professional judgment (medical, legal, financial,
              labor, or social-insurance matters), please consult a licensed professional. Labor or
              social-insurance information obtained through the Service does not constitute the basis
              for any individual legal determination.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. Data retention period</h2>
            <p>
              Data is retained for as long as your account exists. All data is deleted at the same
              time as account deletion. If there is no login activity for 2 years, data will be
              deleted after prior notice.
            </p>
          </section>

          {/* 2026-08-12 法務追加（越境移転レビュー C の派生）: 日英突合の結果、日本語版
              /terms の第5条「個人データの取扱い（お客様の従業員等の情報の委託）」が
              この英語版には丸ごと存在せず、第5条以降の節番号も1つずれていることが判明した
              （2026-07-30 に日本語版へ追加した際、英訳が同期されなかった）。
              第5条の全文英訳は法務の別タスクとし、ここでは越境移転に関する導線だけを
              先に張って、英語読者が委託・再委託の条件に到達できない状態を解消する。
              節番号は、既存の英語版の連番を維持する（振り直すと外部リンクが壊れるため）。 */}
          <section>
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-neutral-600">
              <span className="font-medium text-neutral-800">Note on personal data of your employees.</span>{' '}
              The Japanese version of these Terms contains an additional Section 5
              (&quot;Handling of personal data — entrustment of information on your employees and
              related persons&quot;), which governs our role as a processor, the sub-processors we
              use, security measures, and handling on termination. That section has not yet been
              translated; the{' '}
              <Link href="/terms" className="text-brand-600 underline">Japanese version</Link>{' '}
              is the governing text. For the countries our sub-processors are located in, the data
              protection regime of those countries, and the measures we take, see{' '}
              <Link href="/privacy/en#cross-border" className="text-brand-600 underline">
                Privacy Policy, &quot;Cross-border provision to third parties outside Japan&quot;
              </Link>
              . The numbering of the sections below differs from the Japanese version for this
              reason.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. Prohibited conduct</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>Obtaining information related to illegal activity or crime</li>
              <li>Defamation or harassment of others</li>
              <li>Generating content harmful to minors</li>
              <li>Unauthorized use of the Service or attacks on its systems</li>
              <li>Large-scale commercial use without prior authorization</li>
              <li>Presenting AI responses to third parties as professional advice</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. Reporting AI content</h2>
            <p>
              You can report an inappropriate AI response by contacting us at{' '}
              <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">
                support@banto-roumu.com
              </a>
              . Reports are used to improve the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. Disclaimer</h2>
            {/* 2026-07-28 CTO fix (L2 audit #8): mirrors the same change made to /terms
                (Japanese governing text) — replace unlimited disclaimer with a reasonable
                cap for a sole-proprietor service. */}
            <p>
              Except in cases of the operator&apos;s willful misconduct or gross negligence, the
              operator&apos;s liability for damages arising from use of the Service is limited to the
              amount of fees you paid for the Service in the month the event giving rise to the claim
              occurred (or ¥0 if you were on the free plan). The Service may be changed or suspended
              without prior notice.
            </p>
            <p className="mt-2">
              Our incident-response policy (no formal uptime SLA is offered; target time from
              incident detection to notification) is described in the &quot;Incident response
              policy&quot; row of the{' '}
              <Link href="/tokushoho" className="text-brand-600 underline">
                Act on Specified Commercial Transactions disclosure
              </Link>{' '}
              page.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. Intellectual property</h2>
            <p>
              Rights to content you input belong to you. Use of AI-generated content is subject to{' '}
              <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                Anthropic&apos;s commercial terms of use
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. Governing law and jurisdiction</h2>
            <p>These Terms are governed by the laws of Japan.</p>
            <p className="mt-2">
              Any dispute arising in connection with the Service between the operator and a user
              shall be subject to the exclusive jurisdiction of the Tokyo District Court as the court
              of first instance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. Contact</h2>
            <p>
              <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">
                support@banto-roumu.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
