import { redirect } from 'next/navigation'

/**
 * パック招待メール等が指す入口。token検証は後続。
 * 今はメールが404で死なないことだけを保証する。
 */
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const fromRaw = sp.from
  const tokenRaw = sp.token
  const from = typeof fromRaw === 'string' ? fromRaw : Array.isArray(fromRaw) ? fromRaw[0] : 'pack'
  const token = typeof tokenRaw === 'string' ? tokenRaw : Array.isArray(tokenRaw) ? tokenRaw[0] : ''
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (token) q.set('token', token)
  q.set('utm_source', 'invite')
  q.set('utm_campaign', 'one_product')
  redirect(`/signup?${q.toString()}`)
}
