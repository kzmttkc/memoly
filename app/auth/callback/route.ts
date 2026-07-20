import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// GitHub / Google OAuth コールバック。code をセッションに交換して next へ戻す。
// next はログイン画面側で相対パスのみに限定済み（open redirect対策）。
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/company'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/company'
  const failDest = `${origin}/login?auth_error=1`

  if (!code) return NextResponse.redirect(failDest)

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(failDest)

  return NextResponse.redirect(`${origin}${next}`)
}
