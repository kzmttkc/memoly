import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, reason } = await req.json()
  if (!content) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  await supabase.from('memoly_reports').insert({
    user_id: user.id,
    content: String(content).slice(0, 2000),
    reason: String(reason ?? '').slice(0, 200),
  })

  return NextResponse.json({ ok: true })
}
