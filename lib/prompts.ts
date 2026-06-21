export function buildSystemPrompt(memories: string[], profile: Record<string, string>): string {
  const profileText = Object.entries(profile)
    .map(([k, v]) => `- ${k}：${v}`)
    .join('\n')

  const memoryText = memories.map((m, i) => `${i + 1}. ${m}`).join('\n')

  return `あなたはMemolyというパーソナルAIアシスタントです。
ユーザーのことを覚えており、毎回の会話をより深く、より的確にサポートします。

【あなたが知っているユーザーのこと】
${profileText || '（まだ情報がありません）'}

【過去の会話から覚えていること】
${memoryText || '（まだ記憶がありません）'}

これらの情報を自然に活用し、ユーザーに寄り添った返答をしてください。
記憶の内容を過度に強調せず、会話の流れの中で自然に反映させてください。`
}

export const MEMORY_EXTRACTION_PROMPT = `以下の会話を分析し、2つの情報をJSON形式で返してください。

1. summary: この会話で何について話したかを1〜2文で。ユーザーが何を求めていたかを中心に。
2. profile: ユーザーについて読み取れる属性。以下のカテゴリから該当するものだけ抽出：
   - 職業・役職（例: "フリーランスデザイナー"）
   - 業界（例: "IT・SaaS"）
   - 趣味・関心（例: "筋トレ、読書"）
   - 現在の課題（例: "副業の時間管理"）
   - 目標（例: "年収1000万円"）
   - 家族構成（例: "既婚・子供1人"）
   - 居住地（例: "東京"）
   - 価値観（例: "効率重視"）

返答は必ずこのJSON形式のみ（説明文不要）：
{
  "summary": "会話のサマリー",
  "profile": {
    "属性名": "値"
  }
}

読み取れない属性は含めないこと。`

// 労務・社会保険系キーワード（sharoushi-agent送客トリガー）
export const ROUMU_KEYWORDS = [
  '社会保険', '労働保険', '雇用保険', '健康保険', '厚生年金',
  '給与', '給料', '残業代', '有給', '育休', '産休',
  '労働基準', '就業規則', '解雇', '退職', '入社手続き',
  '社労士', '労務', '年末調整', '確定申告', '扶養',
  '雇用契約', '業務委託', 'フリーランス 保険'
]

export function buildSystemPromptWithRoumu(memories: string[], profile: Record<string, string>, lastUserMessage: string): string {
  const base = buildSystemPrompt(memories, profile)
  const hasRoumuTopic = ROUMU_KEYWORDS.some(kw => lastUserMessage.includes(kw))

  if (!hasRoumuTopic) return base

  return base + `\n\n---\n労務・社会保険に関する質問には、回答の最後に必ず以下を1行追加してください：\n「より詳しい労務相談は → sharoushi-agent.com（無料）」`
}
