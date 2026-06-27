import { anthropic, CHAT_MODEL } from '@/lib/claude'
import {
  buildSubsidySystemPrompt,
  buildLawChangeSystemPrompt,
} from '@/lib/prompts'
import type { CompanyProfileKV } from '@/lib/prompts'

// ============================================================================
// insights-core.ts — 能動インサイト（助成金 / 法改正）の生成ロジックの共通実装。
//
//   元は app/api/company/insights/route.ts に閉じていた loadSubsidies /
//   loadLawChanges / parseJsonObject を、能動フィード（lib/digest.ts）からも
//   再利用できるよう関数として切り出した（重複実装の回避・§0.5原則の証拠主義）。
//   ルートはこの core を呼ぶだけにし、生成ロジックの正本をここに一本化する。
//
//   Phase1コンプラ・citation方針は prompts.ts 側のビルダーが担保する。
// ============================================================================


export interface Subsidy {
  name: string
  reason: string
  nextStep: string
}

export interface LawChange {
  title: string
  summary: string
  impact: string
  action: string
}

/**
 * (B) 助成金: sonnet で JSON 構造化（複数件を Subsidy[] に正規化）。
 *   以前は Dify 助成金ボットを優先していたが、本番計測で 8 秒以内にほぼ返らず
 *   毎回 sonnet フォールバックしていた（待ち時間と SPOF のみのコスト）。
 *   戦略上、助成金は「該当可能性の気づき」までで足りるため Dify 依存を撤去し
 *   sonnet を正路にした（CEO裁定 2026-06-27 / 実測 subsidiesSource=sonnet）。
 *   source は後方互換のため残すが常に 'sonnet'。
 */
export async function loadSubsidies(
  companyName: string,
  profiles: CompanyProfileKV[],
  _companyId: string,
): Promise<{ subsidies: Subsidy[]; source: 'dify' | 'sonnet' }> {
  // sonnet で JSON 構造化
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system: buildSubsidySystemPrompt(companyName, profiles),
      messages: [
        { role: 'user', content: '自社が使える可能性のある助成金を、指定のJSON形式のみで返してください。' },
      ],
    })
    const raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const parsed = parseJsonObject(raw)
    const arr = Array.isArray(parsed?.subsidies) ? parsed!.subsidies : []
    const subsidies: Subsidy[] = arr
      .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
      .map(it => ({
        name: String(it.name ?? '').trim(),
        reason: String(it.reason ?? '').trim(),
        nextStep: String(it.nextStep ?? '').trim(),
      }))
      .filter(s => s.name)
    return { subsidies, source: 'sonnet' }
  } catch (e) {
    console.error('[insights-core] subsidy sonnet failed', (e as Error).message)
    return { subsidies: [], source: 'sonnet' }
  }
}

/**
 * (D) 法改正: sonnet で JSON 構造化（項目/概要/自社への影響/対応の方向性）。
 */
export async function loadLawChanges(
  companyName: string,
  profiles: CompanyProfileKV[],
): Promise<LawChange[]> {
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 3072,
      system: buildLawChangeSystemPrompt(companyName, profiles),
      messages: [
        { role: 'user', content: '自社に関係する労務法改正を、指定のJSON形式のみで返してください。' },
      ],
    })
    const raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const parsed = parseJsonObject(raw)
    const arr = Array.isArray(parsed?.lawChanges) ? parsed!.lawChanges : []
    return arr
      .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
      .map(it => ({
        title: String(it.title ?? '').trim(),
        summary: String(it.summary ?? '').trim(),
        impact: String(it.impact ?? '').trim(),
        action: String(it.action ?? '').trim(),
      }))
      .filter(l => l.title)
  } catch (e) {
    console.error('[insights-core] lawChange sonnet failed', (e as Error).message)
    return []
  }
}

/**
 * モデル出力から JSON オブジェクトを取り出してパースする。
 * コードフェンス付き・前後に説明がある場合に備え、最初の { 〜 最後の } を切り出す。
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}
