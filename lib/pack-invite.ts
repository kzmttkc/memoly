/**
 * パック購入 → Free 招待。Word 配信は Agent Netlify のまま。
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isPackPriceId } from './sku.ts'

const BASE = 'https://banto-roumu.com'
const ZURE_URL = `${BASE}/zure?from=pack&utm_source=pack&utm_campaign=one_product`
const SIGNUP_URL = `${BASE}/signup?from=pack&utm_source=pack&utm_campaign=one_product`

export const PACK_MAIL_SUBJECT = '就業規則AI — パックの次は、ずれを1枚にする'

export function packMailHtml(opts: { existingUser: boolean; zureUrl: string; signupUrl: string }): string {
  const action = opts.existingUser
    ? `<p><a href="${opts.zureUrl}">就業規則のファイルを置く（ずれ1枚）</a></p>`
    : `<p><a href="${opts.signupUrl}">無料で始める（登録）</a></p>
       <p>登録のあと、<a href="${opts.zureUrl}">ファイルを置く</a>とずれが1枚になります。</p>`
  return `<!doctype html><html lang="ja"><body style="font-family:sans-serif;line-height:1.6;color:#171717">
<p>実務パックのご購入ありがとうございます。</p>
<p>Word書式は、決済完了時のアクセスURLからこれまでどおり開けます。</p>
<p>同じメールで、就業規則AIの無料枠をご案内します。パックの次は、店の就業規則のファイルです。</p>
${action}
<p>お問い合わせ: <a href="mailto:support@banto-roumu.com">support@banto-roumu.com</a></p>
</body></html>`
}

export { isPackPriceId }

export function isPackCheckout(input: {
  priceId: string | null | undefined
  amountTotal: number | null | undefined
  mode: string | null | undefined
  paymentLinkId?: string | null
}): boolean {
  if (isPackPriceId(input.priceId)) return true
  const link = process.env.STRIPE_PAYMENT_LINK_KASUHARA_PACK?.trim()
  if (link && input.paymentLinkId && input.paymentLinkId === link) return true
  return input.mode === 'payment' && input.amountTotal === 19800
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === needle)
    if (hit) return hit.id
    if (data.users.length < 200) break
  }
  return null
}

async function sendPackMail(opts: {
  to: string
  existingUser: boolean
}): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.DIGEST_FROM_EMAIL || process.env.MAIL_FROM
  if (!key || !from) {
    console.warn('[pack-invite] RESEND_API_KEY / DIGEST_FROM_EMAIL 未設定のためメール省略')
    return { ok: false }
  }
  const html = packMailHtml({
    existingUser: opts.existingUser,
    zureUrl: ZURE_URL,
    signupUrl: SIGNUP_URL,
  })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: PACK_MAIL_SUBJECT,
      html,
    }),
  })
  if (!res.ok) {
    console.error('[pack-invite] Resend failed', res.status, await res.text().catch(() => ''))
    return { ok: false }
  }
  return { ok: true }
}

export async function handlePackInvite(opts: {
  admin: SupabaseClient
  eventId: string
  sessionId: string
  email: string | null | undefined
  amountTotal: number | null
}): Promise<{ handled: true; detail: string }> {
  const email = (opts.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { handled: true, detail: 'pack: no email' }
  }

  const userId = await findUserIdByEmail(opts.admin, email)

  await opts.admin.from('pack_invites').upsert(
    {
      stripe_session_id: opts.sessionId,
      email,
      status: userId ? 'existing_user' : 'pending',
      user_id: userId,
      meta: { event_id: opts.eventId, amount: opts.amountTotal },
    },
    { onConflict: 'stripe_session_id' },
  )

  const mailed = await sendPackMail({ to: email, existingUser: !!userId })
  if (mailed.ok) {
    await opts.admin
      .from('pack_invites')
      .update({
        status: userId ? 'existing_user' : 'mailed',
        mailed_at: new Date().toISOString(),
      })
      .eq('stripe_session_id', opts.sessionId)
  }

  return {
    handled: true,
    detail: userId ? 'pack: existing_user mailed' : 'pack: invite mailed',
  }
}
