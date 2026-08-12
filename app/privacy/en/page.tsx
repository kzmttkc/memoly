import Link from 'next/link'
import type { Metadata } from 'next'

// ============================================================================
// /privacy/en — English translation of /privacy (2026-07-28 CTO, L1 audit #3).
//   Content must stay in sync with /privacy; when editing one, check the other.
// ============================================================================

export const metadata: Metadata = {
  title: 'Privacy Policy | Banto',
  description: 'Privacy Policy for Banto (English).',
  // 2026-07-30 PMF fix #3: pair this page with the Japanese original via hreflang
  //   (site-wide there were 0 hreflang tags and no /en URL in sitemap.xml).
  //   The reciprocal declaration on /privacy (Japanese) is owned by another team
  //   this session and is filed as a work order.
  alternates: {
    canonical: '/privacy/en',
    languages: {
      ja: '/privacy',
      en: '/privacy/en',
      'x-default': '/privacy',
    },
  },
}

export default function PrivacyEnglishPage() {
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
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Privacy Policy</h1>
          <p className="mt-1 text-sm text-neutral-500">Last updated: August 12, 2026</p>
          <p className="mt-1 text-xs text-neutral-500">
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
              <li><strong className="text-neutral-800">Anthropic (Claude API, US)</strong>: receives your consultation content to generate AI responses. <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Anthropic Privacy Policy</a></li>
              <li><strong className="text-neutral-800">Supabase</strong>: database/authentication (US). <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Supabase Privacy Policy</a></li>
              <li><strong className="text-neutral-800">Vercel</strong>: hosting (US)</li>
              <li><strong className="text-neutral-800">Plausible Analytics</strong>: anonymous, cookie-free analytics (EU). <a href="https://plausible.io/data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Plausible Data Policy</a></li>
              <li><strong className="text-neutral-800">Resend</strong>: notification email delivery (US)</li>
              <li><strong className="text-neutral-800">Dify</strong>: lookups against a legal knowledge base (US). Question text related to laws/regulations may be sent.</li>
              <li><strong className="text-neutral-800">OpenAI</strong>: vectorization for semantic memory search (US). Summary text of memories is sent. Data sent via the API is not used for model training by default. <a href="https://openai.com/policies/api-data-usage-policies" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">OpenAI API Data Usage Policy</a></li>
              <li><strong className="text-neutral-800">Stripe</strong>: payment processing for paid plans (US). Card data is handled directly by Stripe and is not stored on Banto&apos;s servers. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">Stripe Privacy Policy</a></li>
              {/* 2026-08-12 法務修正（越境移転レビュー C）: 日本語版 §3 と /terms 5.3 には
                  Slack があるのに、この英語版の一覧にだけ Slack が欠落していた。
                  実際に個人データが国外へ出る経路（lib/slack.ts → hooks.slack.com）が
                  開示から漏れている状態で、日本語版で一度潰した欠陥の再発だった。 */}
              <li><strong className="text-neutral-800">Slack (US)</strong>: only if you (the company) configure an Incoming Webhook in the admin screen, we send the body of the weekly digest and deadline reminders (which includes your company name and a summary of key labor-related points) to the Slack workspace you designate. You can stop this at any time by removing the configuration. Because you designate the destination, handling within that workspace is under your control.</li>
            </ul>
            <p className="mt-2 text-neutral-500">
              Disclosure to these third parties is limited to what is necessary to provide the
              Service. For transfers to vendors outside Japan, see{' '}
              <a href="#cross-border" className="text-brand-600 underline">4. Cross-border provision to third parties outside Japan</a>.
            </p>
          </section>

          {/* 2026-07-30 法務修正: /privacy（日本語・正文）と同期。同意単独の構成から
              「従業員等＝委託／登録者本人＝同意」の二層構成へ組み替え。 */}
          {/* 2026-08-12 法務修正（越境移転レビュー A/B/E）: 日本語版（正文）と同期。
              A) "all vendors listed above are located in the United States" は事実に反する
                 （Plausible Analytics はエストニア・EU）。所在国を実態どおりに書き分ける。
              B) 移転先国の個人情報保護制度に関する情報（(2)）を追加。
              E) §3 末尾の灰色小文字から独立した節へ格上げし、以降の節番号を1つ繰り下げた。 */}
          <section id="cross-border" className="scroll-mt-6">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">4. Cross-border provision to third parties outside Japan</h2>
            <p>
              In providing the Service, some of the information you entrust to us is transferred to
              vendors outside Japan. The circumstances of those transfers and the measures we take
              are as follows.
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(1) Countries of the recipients</h3>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li><span className="text-neutral-800">United States</span>: Anthropic, OpenAI, Dify, Supabase, Vercel, Resend, Stripe (and Slack, if you configure the Slack integration)</li>
              <li><span className="text-neutral-800">Estonia (EU)</span>: Plausible Analytics (cookie-free, anonymous statistics only; no information identifying an individual is sent)</li>
            </ul>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(2) The personal data protection regime of the recipient countries</h3>
            <p className="text-neutral-600">
              The United States has no comprehensive, cross-sectoral personal data protection law
              comparable to Japan&apos;s Act on the Protection of Personal Information or the EU
              GDPR; instead it is governed by sector-specific federal laws and by state laws such as
              the California Consumer Privacy Act (CCPA/CPRA). The United States is also not
              designated, under Japan&apos;s Act on the Protection of Personal Information, as a
              foreign country recognized as having standards equivalent to Japan&apos;s (an adequacy
              designation). In addition, the United States has regimes under which law enforcement
              and similar authorities may, subject to certain requirements, require businesses to
              disclose data (e.g., the CLOUD Act and Section 702 of the Foreign Intelligence
              Surveillance Act (FISA)).
            </p>
            <p className="mt-2 text-neutral-600">
              The EU (Estonia) is designated, under Japan&apos;s Act on the Protection of Personal
              Information, as a foreign country recognized as having standards equivalent to
              Japan&apos;s.
            </p>

            {/* 2026-08-12 法務修正（越境移転レビュー D）: 日本語版（正文）と同期。
                「確認したうえで利用しています」という断定は、Dify（別途署名が必要・未締結）と
                Vercel（DPA が Enterprise/Pro 限定・番頭は Hobby）について事実に反していた。
                実測台帳は docs/compliance/vendor-dpa-register.md。 */}
            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(3) Measures taken by the operator</h3>
            <p className="text-neutral-600">
              For each of the vendors above, we have reviewed whether contractual terms governing the
              handling of personal information (data processing agreements, standard contractual
              clauses, etc.) exist and what they provide, and we keep a record of that review together
              with the date it was carried out (last reviewed: August 12, 2026). For most of these
              vendors, such terms apply automatically as part of their terms of service. For some,
              however, a separate execution step is required, and that step has not been completed in
              every case. We review the status at least once a year; if problems arise in the
              implementation of those equivalent measures we will take the necessary action, and if
              improvement proves difficult we will suspend the provision of personal data to the
              vendor concerned. You can ask about the status for any individual vendor via the
              contact in (5) below.
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(4) Basis for handling</h3>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>
                <span className="text-neutral-800">Personal information of your employees and related persons that you enter</span>: handled on the basis of entrustment (outsourcing) by you as the company
                (see <Link href="/terms" className="text-brand-600 underline">Terms of Service, Section 5</Link>; Japanese text only).
                Provision to the vendors above occurs as sub-processing, limited to what is necessary to provide the Service.
                Notice to, and where required consent of, the individuals concerned is the responsibility of you as the entrusting company. Individuals should direct requests for disclosure, correction or suspension of use to their employer first.
              </li>
              <li>
                <span className="text-neutral-800">Information about the registered user (e.g., email address)</span>: handled on the basis of the systems confirmed in (3) above. In addition, at sign-up we obtain your consent to the Terms of Service and this Privacy Policy via an active checkbox.
              </li>
            </ul>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(5) Information provided at the request of the individual</h3>
            <p className="text-neutral-600">
              At the request of an individual, we will provide information at{' '}
              <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>{' '}
              regarding the equivalent measures taken by the recipient third party, including: the
              name of the recipient country; the presence and an outline of that country&apos;s
              personal data protection regime; an outline of the measures taken by the recipient;
              the frequency and method of our review; and, where problems have arisen in the
              implementation of the equivalent measures, the nature of those problems and the action
              we have taken.
            </p>

            <h3 className="mb-1 mt-4 font-semibold text-neutral-900">(6) For residents of the EU/EEA</h3>
            {/* 2026-08-12 法務修正（D の波及・日本語版と同期）: DPA が未締結の事業者では
                SCC も発効していないため、無条件の「SCC に準拠します」は書けない。 */}
            <p className="text-neutral-600">
              Of the third-country transfers above, those to vendors for which a data processing
              agreement incorporating Standard Contractual Clauses (SCCs) is in effect rely on the
              SCCs under GDPR Article 46. For the vendors whose execution step is not yet complete
              (see (3) above), the same will apply once that step is completed. Plausible Analytics
              (Estonia) is an EU-based vendor, so transfers to it are not third-country transfers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">5. Data retention period</h2>
            <p>
              Data is retained for as long as your account exists. All data is deleted at the same
              time as account deletion. If there is no login activity for 2 years, we will notify you
              by email in advance before deleting your account and data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">6. Opting out of emails</h2>
            <p>
              You can stop notification emails at any time via the unsubscribe link at the bottom of
              the email, or via the{' '}
              <Link href="/unsubscribe" className="text-brand-600 underline">unsubscribe page</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">7. Cookies</h2>
            <p>
              The Service uses a session cookie to keep you logged in. We do not use cookies to track
              individuals. Analytics is provided by Plausible Analytics, which is cookie-free and
              collects only anonymous pageview-style statistics.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">8. Your rights</h2>
            <ul className="list-inside list-disc space-y-1 text-neutral-600">
              <li>Requesting disclosure, correction, or deletion of personal information</li>
              <li>Restriction of processing / objection (for GDPR data subjects)</li>
              <li>Data portability (for GDPR data subjects)</li>
            </ul>
            <p className="mt-2">To exercise the above rights, please contact <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a>.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">9. Security</h2>
            <p>
              Row-Level Security (RLS) ensures that each company/user can only access their own data.
              Communications are encrypted via HTTPS/TLS. For details, see{' '}
              <Link href="/security" className="text-brand-600 underline">Security &amp; data protection</Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-neutral-900">10. Contact</h2>
            <p>
              <a href="mailto:support@banto-roumu.com" className="text-brand-600 underline">support@banto-roumu.com</a> (we accept inquiries by email and reply within 3 business days as a rule)
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
