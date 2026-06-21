import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { extractMemory } from '@/lib/memory'

// 会話終了時に記憶を保存
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, conversationId } = await req.json()
  if (!messages?.length) return NextResponse.json({ ok: true })

  const extraction = await extractMemory(messages)

  // サマリーをmemoriesテーブルへ保存
  if (extraction.summary) {
    await supabase.from('memoly_memories').insert({
      user_id: user.id,
      content: extraction.summary,
      memory_type: 'summary',
    })
  }

  // プロファイル属性をupsert
  for (const [key, value] of Object.entries(extraction.profile)) {
    await supabase.from('memoly_profiles').upsert({
      user_id: user.id,
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,key' })
  }

  return NextResponse.json({ ok: true, extraction })
}

// 記憶一覧取得
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: memories }, { data: profile }] = await Promise.all([
    supabase.from('memoly_memories').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('memoly_profiles').select('*').eq('user_id', user.id),
  ])

  return NextResponse.json({ memories, profile })
}

// 記憶削除
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, type } = await req.json()

  if (type === 'memory') {
    await supabase.from('memoly_memories').delete().eq('id', id).eq('user_id', user.id)
  } else if (type === 'profile') {
    await supabase.from('memoly_profiles').delete().eq('id', id).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
