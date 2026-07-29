import Link from 'next/link'
import type { Metadata } from 'next'

// ============================================================================
// /privacy/en — English translation of /privacy (2026-07-28 CTO, L1 audit #3).
//   Content must stay in sync with /privacy; when editing one, check the other.
// ============================================================================

export const metadata: Metadata = {
  title: 'Privacy Policy | Banto',
  description: 'Privacy Policy for Banto (English).',
  alternates: { canonical: '/privacy/en' },
}

export default function PrivacyEnglishPage() {
  return (
    <div className="company-light min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <Link href="/business/en" className="text-sm text-neutral-500 hover:text-neutral-700">
            Back to top
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Privacy Policy</h1>
          <p className="mt-1 text-sm text-neutral-500">Last updated: July 30, 2026</p>
          <p className="mt-1 text-xs text-neutral-400">
            English translation for reference. The <Link href="/privacy" className="underline">Japanese version</Link> is the governing text in case of any discrepancy.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-neutral-700">
          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Operator information</h2>
            <ul className="space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">Operator:</span> KIZUNA Creation (responsible person / Kazumoto Takeshi)</li>
              <li><span className="text-neutral-800">Representative:</span> Kazumoto Takeshi</li>
              <li>
                <span className="text-neutral-800">Location:</span> Japan (as a sole proprietorship, the full address is not displayed at all times; it is disclosed without delay upon request, as described in the{' '}
                <Link href="/tokushoho" className="text-brand-600 underline">Specified Commercial Transactions Act notice</Link>)
              </li>
              <li><span className="text-neutral-800">Contact:</span> <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">1. Information we collect</h2>
            <p>Banto collects the following information:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li>Email address (at account creation)</li>
              <li>Company profile and chat consultation content</li>
              <li>Attributes/memory extracted by the AI (e.g., standard working hours, holidays, status of internal rules)</li>
              {/* 2026-07-30 法務追加: /privacy（日本語・正文）と同期。従業員等の個人情報の
                  類型と要配慮個人情報を含みうる旨を追加。 */}
              <li>
                Personal information of your employees, officers and other related persons that you (the company) enter into the Service
                (name or label, department, work/employment status, background of the consultation).
                Given the nature of labor-related consultations, <span className="text-warning-700">this may include sensitive personal information (e.g., leave of absence, illness or injury, harassment reports).</span>
                We handle such data as a processor entrusted by you (see <Link href="/terms" className="text-brand-600 underline">Terms of Service, Section 5</Link>; Japanese text only).
              </li>
              <li>Service usage (anonymous statistics)</li>
            </ul>
            <p className="mt-2 text-neutral-500">
              When creating long-term memories from conversations, we instruct the AI not to retain raw full names, addresses or national identification numbers in the subject label, and to use initials or roles instead (as this is performed by an AI model, automatic pseudonymization cannot be guaranteed). Please do not enter Japanese Individual Numbers (My Number) or documents containing them.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">2. Purpose of use and legal basis</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>Providing and improving the Service (performance of contract)</li>
              <li>Generating company-specific answers (performance of contract)</li>
              <li>Providing the long-term memory feature (performance of contract)</li>
              <li>Sending notification emails (legitimate interest; opt-out available)</li>
              <li>Security and fraud prevention (legitimate interest)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">3. Disclosure to third parties</h2>
            <p>We use the following services, which may involve data being sent to them:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-600">
              <li><strong className="text-neutral-800">Anthropic (Claude API)</strong>: receives your consultation content to generate AI responses. <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropic Privacy Policy</a></li>
              <li><strong className="text-neutral-800">Supabase</strong>: database/authentication (US). <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Supabase Privacy Policy</a></li>
              <li><strong className="text-neutral-800">Vercel</strong>: hosting (US)</li>
              <li><strong className="text-neutral-800">Plausible Analytics</strong>: anonymous, cookie-free analytics (EU). <a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Plausible Data Policy</a></li>
              <li><strong className="text-neutral-800">Resend</strong>: notification email delivery (US)</li>
              <li><strong className="text-neutral-800">Dify</strong>: lookups against a legal knowledge base (US). Question text related to laws/regulations may be sent.</li>
              <li><strong className="text-neutral-800">OpenAI</strong>: vectorization for semantic memory search (US). Summary text of memories is sent. Data sent via the API is not used for model training by default. <a href="https://openai.com/policies/api-data-usage-policies" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">OpenAI API Data Usage Policy</a></li>
              <li><strong className="text-neutral-800">Stripe</strong>: payment processing for paid plans (US). Card data is handled directly by Stripe and is not stored on Banto&apos;s servers. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Stripe Privacy Policy</a></li>
            </ul>
            <p className="mt-2 text-neutral-500">
              Disclosure to these third parties is limited to what is necessary to provide the
              Service. For EU/EEA residents: the above international transfers rely on Standard
              Contractual Clauses (SCCs) under GDPR Article 46.
            </p>
            {/* 2026-07-30 法務修正: /privacy（日本語・正文）と同期。同意単独の構成から
                「従業員等＝委託／登録者本人＝同意」の二層構成へ組み替え。 */}
            <p className="mt-2 text-neutral-500">
              Under Japan&apos;s Act on the Protection of Personal Information (cross-border
              provision to third parties): all vendors listed above are located in the United
              States. The basis for handling differs depending on the information concerned:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-500">
              <li>
                <span className="text-neutral-800">Personal information of your employees and related persons that you enter</span>: handled on the basis of entrustment (outsourcing) by you as the company
                (see <Link href="/terms" className="text-brand-600 underline">Terms of Service, Section 5</Link>; Japanese text only).
                Provision to the vendors above occurs as sub-processing, limited to what is necessary to provide the Service, and we have confirmed through contractual safeguards (data processing agreements, SCCs, etc.) that each vendor maintains appropriate ongoing measures for handling personal information.
                Notice to, and where required consent of, the individuals concerned is the responsibility of you as the entrusting company. Individuals should direct requests for disclosure, correction or suspension of use to their employer first.
              </li>
              <li>
                <span className="text-neutral-800">Information about the registered user (e.g., email address)</span>: at sign-up, you provide explicit consent to this Privacy Policy (and the Terms of Service) via an active checkbox, and this information is handled on the basis of that explicit consent. To withdraw consent or request details, please contact us at the address below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. Data retention period</h2>
            <p>
              Data is retained for as long as your account exists. All data is deleted at the same
              time as account deletion. If there is no login activity for 2 years, we will notify you
              by email in advance before deleting your account and data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. Opting out of emails</h2>
            <p>
              You can stop notification emails at any time via the unsubscribe link at the bottom of
              the email, or via the{' '}
              <Link href="/unsubscribe" className="text-brand-600 underline">unsubscribe page</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. Cookies</h2>
            <p>
              The Service uses a session cookie to keep you logged in. We do not use cookies to track
              individuals. Analytics is provided by Plausible Analytics, which is cookie-free and
              collects only anonymous pageview-style statistics.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. Your rights</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>Requesting disclosure, correction, or deletion of personal information</li>
              <li>Restriction of processing / objection (for GDPR data subjects)</li>
              <li>Data portability (for GDPR data subjects)</li>
            </ul>
            <p className="mt-2">To exercise the above rights, please contact <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. Security</h2>
            <p>
              Row-Level Security (RLS) ensures that each company/user can only access their own data.
              Communications are encrypted via HTTPS/TLS. For details, see{' '}
              <Link href="/security" className="text-brand-600 underline">Security &amp; data protection</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. Contact</h2>
            <p>
              <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> (we accept inquiries by email and reply within 3 business days as a rule)
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
