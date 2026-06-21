import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, value } = await req.json()
  if (!id || typeof value !== 'string') {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  await supabase
    .from('memoly_profiles')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id) // user_idで自分のデータのみ更新

  return NextResponse.json({ ok: true })
}
