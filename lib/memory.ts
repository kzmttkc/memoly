import { anthropic, MEMORY_MODEL } from './claude'
import { MEMORY_EXTRACTION_PROMPT } from './prompts'

export interface MemoryExtraction {
  summary: string
  profile: Record<string, string>
}

export async function extractMemory(messages: { role: string; content: string }[]): Promise<MemoryExtraction> {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : 'AI'}：${m.content}`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: MEMORY_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${MEMORY_EXTRACTION_PROMPT}\n\n---会話---\n${conversationText}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { summary: '', profile: {} }
    return JSON.parse(jsonMatch[0]) as MemoryExtraction
  } catch {
    return { summary: text, profile: {} }
  }
}

// テキストをembeddingに変換（Supabase pgvectorへ保存用）
// Note: OpenAI embedding or use simple text search as fallback in MVP
export function cosineSimilarityQuery(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
