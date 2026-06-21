import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { buildSystemPromptWithRoumu } from '@/lib/prompts'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, conversationId } = await req.json()

  // ユーザープロファイル取得
  const { data: profileRows } = await supabase
    .from('memoly_profiles')
    .select('key, value')
    .eq('user_id', user.id)

  const profile: Record<string, string> = {}
  profileRows?.forEach(row => { profile[row.key] = row.value })

  // 関連記憶を取得（テキスト検索・MVP版）
  const { data: memoryRows } = await supabase
    .from('memoly_memories')
    .select('content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const memories = memoryRows?.map(r => r.content) ?? []

  // Claude APIへ送信（ストリーミング）
  const stream = await anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: buildSystemPromptWithRoumu(memories, profile, messages.at(-1)?.content ?? ''),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  // ストリームをそのままレスポンスとして返す
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
