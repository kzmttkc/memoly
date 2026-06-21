import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service roleクライアントで全データ削除
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ユーザーデータを全削除（RLSを回避してservice roleで実行）
  await Promise.all([
    admin.from('memoly_memories').delete().eq('user_id', user.id),
    admin.from('memoly_profiles').delete().eq('user_id', user.id),
    admin.from('memoly_messages').delete().in(
      'conversation_id',
      (await admin.from('memoly_conversations').select('id').eq('user_id', user.id)).data?.map(r => r.id) ?? []
    ),
  ])
  await admin.from('memoly_conversations').delete().eq('user_id', user.id)
  await admin.from('memoly_users').delete().eq('id', user.id)

  // Supabase Authからユーザー削除
  await admin.auth.admin.deleteUser(user.id)

  return NextResponse.json({ ok: true })
}
