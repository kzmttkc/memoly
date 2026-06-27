import { anthropic, MEMORY_MODEL } from './claude'
import { MEMORY_EXTRACTION_PROMPT } from './prompts'

export interface MemoryExtraction {
  summary: string
  profile: Record<string, string>
  /** 抽出が劣化した場合の理由（正常時はundefined）。呼び出し側で監視・計測に使う。 */
  degraded?: 'no_json' | 'parse_error' | 'api_error' | 'empty_response'
}

interface RawCompletion {
  text: string
  /** API呼び出し自体が失敗したか */
  apiError?: boolean
}

async function callExtraction(
  conversationText: string,
  prompt: string = MEMORY_EXTRACTION_PROMPT,
): Promise<RawCompletion> {
  try {
    const response = await anthropic.messages.create({
      model: MEMORY_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n---会話---\n${conversationText}`,
        },
      ],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return { text }
  } catch (e) {
    console.error('[memoly:extractMemory] Anthropic API呼び出し失敗', e)
    return { text: '', apiError: true }
  }
}

function tryParse(text: string): MemoryExtraction | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<MemoryExtraction>
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      profile:
        parsed.profile && typeof parsed.profile === 'object'
          ? (parsed.profile as Record<string, string>)
          : {},
    }
  } catch {
    return null
  }
}

/**
 * 会話から長期記憶（summary + profile）を抽出する。
 *
 * 製品の生命線。JSONパースに失敗しても「無言で空を返す」ことはしない:
 *  1. API失敗時は1回だけリトライ
 *  2. JSONが取れない/壊れている場合は console.error で明示ログ
 *  3. それでも summary が空なら、生テキストを summary に退避（記憶を失わない）
 *  4. degraded フラグを返し、呼び出し側がカウンタ/ログテーブルへ記録できるようにする
 */
export async function extractMemory(
  messages: { role: string; content: string }[]
): Promise<MemoryExtraction> {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'ユーザー' : 'AI'}：${m.content}`)
    .join('\n')

  // 1回目
  let raw = await callExtraction(conversationText)

  // API失敗なら1回だけリトライ
  if (raw.apiError) {
    console.warn('[memoly:extractMemory] API失敗のためリトライします')
    raw = await callExtraction(conversationText)
    if (raw.apiError) {
      console.error('[memoly:extractMemory] リトライも失敗。記憶抽出を断念', {
        sampleLen: conversationText.length,
      })
      return { summary: '', profile: {}, degraded: 'api_error' }
    }
  }

  if (!raw.text) {
    console.error('[memoly:extractMemory] 空のレスポンス（textブロックなし）')
    return { summary: '', profile: {}, degraded: 'empty_response' }
  }

  const parsed = tryParse(raw.text)

  if (parsed) {
    return parsed
  }

  // JSONが無い or 壊れている → 明示ログ + 生テキストをsummaryに退避
  const hasBrace = raw.text.includes('{')
  console.error('[memoly:extractMemory] JSON抽出に失敗。生テキストをsummaryへ退避', {
    reason: hasBrace ? 'parse_error' : 'no_json',
    preview: raw.text.slice(0, 200),
  })

  return {
    summary: raw.text.trim(),
    profile: {},
    degraded: hasBrace ? 'parse_error' : 'no_json',
  }
}

// ============================================================================
// 会社スコープの事実抽出（縦SaaS「会社を覚える労務AI」）
//   会話から「自社の労務事実」だけを抽出する。個人プロファイル抽出とは別系統。
//   抽出した事実は company_memories(memory_type='rule') に候補として積み、
//   admin が承認するまで company_profiles へは昇格させない（admin承認制）。
// ============================================================================

const COMPANY_FACT_PROMPT = `以下は、ある会社の従業員とAI労務アシスタントの会話です。
この会話から「その会社（自社）の労務に関する確定した事実」だけを抽出してください。

抽出してよいもの（例）:
- 従業員数（例: "従業員8名"）
- 業種（例: "製造業"）
- 36協定の締結状況（例: "36協定は未締結"）
- 残業の実態（例: "繁忙期は月60時間の残業がある"）
- 就業規則・賃金規程の有無や内容
- 各種制度の導入状況（育休/介護休業/在宅勤務など）

抽出してはいけないもの:
- 一般的な法令の説明（自社固有でない情報）
- AIの助言・推測・仮定（"〜すべき"、"〜かもしれない"）
- 個人のプライバシー情報

返答は必ず次のJSON形式のみ（説明文不要）。事実が無ければ facts は空配列にする：
{
  "facts": [
    { "key": "従業員数", "value": "8名" }
  ]
}`

export interface CompanyFact {
  key: string
  value: string
}

export interface CompanyFactExtraction {
  facts: CompanyFact[]
  degraded?: 'no_json' | 'parse_error' | 'api_error' | 'empty_response'
}

function tryParseCompanyFacts(text: string): CompanyFact[] | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { facts?: unknown }
    if (!Array.isArray(parsed.facts)) return []
    return parsed.facts
      .filter(
        (f): f is CompanyFact =>
          !!f && typeof (f as CompanyFact).key === 'string' && typeof (f as CompanyFact).value === 'string',
      )
      .map(f => ({ key: f.key.slice(0, 100), value: f.value.slice(0, 500) }))
  } catch {
    return null
  }
}

/**
 * 会話から自社の労務事実を抽出する（haiku）。
 * 個人版 extractMemory と同じ堅牢性方針（API失敗1回リトライ・degradedフラグ）。
 */
export async function extractCompanyFacts(
  messages: { role: string; content: string }[],
): Promise<CompanyFactExtraction> {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? '社員' : 'AI'}：${m.content}`)
    .join('\n')

  let raw = await callExtraction(conversationText, COMPANY_FACT_PROMPT)
  if (raw.apiError) {
    raw = await callExtraction(conversationText, COMPANY_FACT_PROMPT)
    if (raw.apiError) {
      console.error('[memoly:extractCompanyFacts] リトライも失敗')
      return { facts: [], degraded: 'api_error' }
    }
  }
  if (!raw.text) return { facts: [], degraded: 'empty_response' }

  const facts = tryParseCompanyFacts(raw.text)
  if (facts) return { facts }

  const hasBrace = raw.text.includes('{')
  console.error('[memoly:extractCompanyFacts] JSON抽出に失敗', {
    reason: hasBrace ? 'parse_error' : 'no_json',
    preview: raw.text.slice(0, 200),
  })
  return { facts: [], degraded: hasBrace ? 'parse_error' : 'no_json' }
}

// ============================================================================
// 会社スコープの「記憶の縦深」抽出（PMFロードマップ §5〜6・番頭の最大差別化＝moat）
//   会話要約を「平板な1行」から、topic / subject(対象者) / 過去の自社判断(decision) まで
//   構造化して取り出す。これにより loadCompanyContext が
//     「貴社のAさんの件は前回こう決めましたが今回も同じ方針で？」
//   と返せるだけの土台を持つ。個人版 extractMemory・rule候補抽出 extractCompanyFacts は
//   一切変更せず、別系統で追加する（抽出失敗時は summary のみへ graceful degrade）。
// ============================================================================

const COMPANY_MEMORY_DEPTH_PROMPT = `以下は、ある会社の従業員とAI労務アシスタントの会話です。
この会話を、その会社の「継続記憶」として残すために、次の項目をJSONで抽出してください。

抽出する項目:
1. summary: この会話で何を相談し、どうなったかを1〜2文で（自社の文脈として後から読んで分かるように）。
2. topic: 相談の主トピックを短いラベルで1つ（例「育休」「36協定」「固定残業代」「有給取得義務」）。判別できなければ空文字。
3. subject: 相談の対象となった人・グループのラベル（例「パート全般」「Aさん(育休中)」「営業部」）。
   ★個人を特定する生の氏名・住所・マイナンバー等は書かないこと。イニシャルや役割＋文脈のラベルにすること。
   対象が会社全体・特定の人がいない場合は空文字。
4. isDecision: この会話で「自社としての方針・対応の判断」が実際に下されたなら true、単なる質問・情報提供のみなら false。
5. decisionText: isDecision が true のときだけ、その「下した判断」を1文で（例「Aさんの育休は法定どおり1歳まで、延長は申請ベースで対応する方針にした」）。false のときは空文字。

返答は必ず次のJSON形式のみ（説明文・コードフェンス不要）：
{
  "summary": "…",
  "topic": "…",
  "subject": "…",
  "isDecision": false,
  "decisionText": ""
}

注意:
- 一般的な法令の説明そのものは summary に長々と書かない（自社の文脈・やり取りの結果を中心に）。
- 確証が持てない項目は空文字／false にする（創作しない）。`

export interface CompanyMemoryDepth {
  summary: string
  topic: string
  subject: string
  isDecision: boolean
  decisionText: string
  degraded?: 'no_json' | 'parse_error' | 'api_error' | 'empty_response'
}

function tryParseCompanyMemoryDepth(text: string): CompanyMemoryDepth | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const p = JSON.parse(jsonMatch[0]) as Partial<CompanyMemoryDepth>
    const str = (v: unknown, max: number) =>
      typeof v === 'string' ? v.trim().slice(0, max) : ''
    const isDecision = p.isDecision === true
    return {
      summary: str(p.summary, 1000),
      topic: str(p.topic, 100),
      subject: str(p.subject, 200),
      isDecision,
      // 判断でなければ decisionText は無視（空に倒す）。
      decisionText: isDecision ? str(p.decisionText, 1000) : '',
    }
  } catch {
    return null
  }
}

/**
 * 会話から「会社の継続記憶」を構造化抽出する（haiku/sonnet 1パス）。
 *   summary に加え topic / subject / isDecision / decisionText を返す。
 *   個人版 extractMemory と同じ堅牢性方針（API失敗1回リトライ・degradedフラグ・
 *   JSON取得不能時は生テキストを summary に退避＝記憶を失わない）。
 *   ＝抽出が劣化しても呼び出し側は「従来どおり summary だけ保存」に degrade できる。
 */
export async function extractCompanyMemory(
  messages: { role: string; content: string }[],
): Promise<CompanyMemoryDepth> {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? '社員' : 'AI'}：${m.content}`)
    .join('\n')

  let raw = await callExtraction(conversationText, COMPANY_MEMORY_DEPTH_PROMPT)
  if (raw.apiError) {
    raw = await callExtraction(conversationText, COMPANY_MEMORY_DEPTH_PROMPT)
    if (raw.apiError) {
      console.error('[memoly:extractCompanyMemory] リトライも失敗')
      return { summary: '', topic: '', subject: '', isDecision: false, decisionText: '', degraded: 'api_error' }
    }
  }
  if (!raw.text) {
    return { summary: '', topic: '', subject: '', isDecision: false, decisionText: '', degraded: 'empty_response' }
  }

  const parsed = tryParseCompanyMemoryDepth(raw.text)
  if (parsed) return parsed

  // JSONが取れない/壊れている → 生テキストを summary に退避（記憶を失わない）。
  const hasBrace = raw.text.includes('{')
  console.error('[memoly:extractCompanyMemory] JSON抽出に失敗。生テキストをsummaryへ退避', {
    reason: hasBrace ? 'parse_error' : 'no_json',
    preview: raw.text.slice(0, 200),
  })
  return {
    summary: raw.text.trim().slice(0, 1000),
    topic: '',
    subject: '',
    isDecision: false,
    decisionText: '',
    degraded: hasBrace ? 'parse_error' : 'no_json',
  }
}

// テキストをembeddingに変換（Supabase pgvectorへ保存用）
// Note: OpenAI embedding or use simple text search as fallback in MVP
//
// ★ pgvector セマンティック検索の将来差し込み点（今回は未配線）:
//   embeddingプロバイダ（Voyage=有料/Takeshi承認 or ローカル）が揃ったら、
//   ここで会話/クエリを embedding 化し、loadCompanyContext の「関連記憶の選択」を
//   recency+キーワードからコサイン類似度に差し替える。
//   保存先列・索引は supabase/company_memory_depth.sql の §4 を解禁する。
export function cosineSimilarityQuery(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
