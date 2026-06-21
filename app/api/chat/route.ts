import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { buildSystemPromptWithRoumu } from '@/lib/prompts'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 記憶注入の上限（Token オーバーフロー防止）
const MAX_MEMORIES = 10

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate Limiting: 1分間に20リクエストまで
  const windowStart = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase
    .from('memoly_messages')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', windowStart)
    .in(
      'conversation_id',
      (await supabase.from('memoly_conversations').select('id').eq('user_id', user.id)).data?.map(r => r.id) ?? []
    )

  if ((count ?? 0) >= 20) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。1分後にお試しください。' },
      { status: 429 }
    )
  }

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // 入力の長さを制限（プロンプトインジェクション対策）
  const sanitizedMessages = messages.slice(-50).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: String(m.content).slice(0, 4000),
  }))

  // ユーザープロファイル取得
  const { data: profileRows } = await supabase
    .from('memoly_profiles')
    .select('key, value')
    .eq('user_id', user.id)

  const profile: Record<string, string> = {}
  profileRows?.forEach(row => { profile[row.key] = row.value })

  // 記憶を直近MAX_MEMORIES件に制限（Token オーバーフロー防止）
  const { data: memoryRows } = await supabase
    .from('memoly_memories')
    .select('content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_MEMORIES)

  const memories = memoryRows?.map(r => r.content) ?? []
  const lastUserMessage = sanitizedMessages.findLast(m => m.role === 'user')?.content ?? ''

  const stream = await anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 2048,
    system: buildSystemPromptWithRoumu(memories, profile, lastUserMessage),
    messages: sanitizedMessages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } catch {
        controller.enqueue(new TextEncoder().encode('\n\n[エラーが発生しました。もう一度お試しください]'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
