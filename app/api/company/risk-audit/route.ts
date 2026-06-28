import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { buildRiskAuditSystemPrompt, RISK_AUDIT_DISCLAIMER } from '@/lib/prompts'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
} from '@/lib/company'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan } from '@/lib/plans'

// ============================================================================
// /api/company/risk-audit — 提案C 労務リスク・セルフ監査スコア（集客/バイラル）
//   会社プロファイル（自社ルール）＋任意の簡易設問回答(body.answers)を起点に、
//   sonnet で自社の労務リスクを採点する。
//     - 総合スコア(0-100) + level
//     - カテゴリ別スコア（労働時間/賃金/休暇/就業規則/社会保険/育児・介護）
//     - 危ない上位3点（severity / why / fix）
//     - 一言サマリ
//   情報不足の項目は「減点」でなく「要確認」へ（薄いプロファイルで不当に低い点を
//   出してネガティブ体験にしない）。
//
//   フロー（既存 insights / document/review ルートと同一の流儀）:
//     1. ログイン確認 → company_id 確定（指定があれば所属検証、無ければ default）
//     2. company_profiles を読む（自社ルール）。body.answers をマージ要素として渡す
//     3. sonnet で JSON 構造化
//     4. Phase1 免責をコード強制付与して JSON 返却
//
//   Phase1コンプラ: 「社労士監修」「AI社労士」「法的精度」不使用・スコアは目安・条件形。
//   返却: { score, level, categories:[{name,score,note}],
//          topRisks:[{title,severity,why,fix}], summary, disclaimer }
// ============================================================================

interface Category {
  name: string
  score: number
  note: string
}

interface TopRisk {
  title: string
  severity: 'high' | 'medium' | 'low'
  why: string
  fix: string
}

// 必ず全件返す6カテゴリ（モデルが落としても順序・存在を保証するための骨格）。
const CATEGORY_NAMES = ['労働時間', '賃金', '休暇', '就業規則', '社会保険', '育児・介護']

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId, answers: bodyAnswers } = body as {
    companyId?: string
    answers?: Record<string, unknown> | { key: string; value: string }[]
  }

  // --- company_id 確定（plan を解決してから plan 連動の上限ガードを掛ける）---
  let companyId: string
  if (bodyCompanyId) {
    const membership = await getMembership(bodyCompanyId)
    if (!membership) {
      return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
    }
    companyId = membership.companyId
  } else {
    const def = await resolveDefaultCompany()
    if (!def) {
      return NextResponse.json(
        { error: 'NO_COMPANY', message: '会社が未登録です。まず会社を作成してください。' },
        { status: 409 },
      )
    }
    companyId = def.companyId
  }

  const companyMeta = await getMembership(companyId)
  const companyName = companyMeta?.name ?? '自社'
  const plan = resolvePlan(companyMeta?.plan).id

  // --- 日次利用上限ガード（plan連動・高コストsonnet前）。超過は429。DB未適用時はfail-open ---
  if (!(await checkAndIncrement(user.id, 'risk_audit', plan))) {
    return NextResponse.json(
      { error: '本日の利用上限に達しました。時間をおいてお試しください。' },
      { status: 429 },
    )
  }

  const ctx = await loadCompanyContext(companyId)
  const profiles = ctx.profiles
  const answers = normalizeAnswers(bodyAnswers)

  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 3072,
      system: buildRiskAuditSystemPrompt(companyName, profiles, answers),
      messages: [
        {
          role: 'user',
          content: '自社の労務リスクを採点し、指定のJSON形式のみで返してください。',
        },
      ],
    })
    const raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    const parsed = parseJsonObject(raw)

    const score = clampScore(parsed?.score)
    const categories = normalizeCategories(parsed?.categories)
    const topRisks = normalizeTopRisks(parsed?.topRisks)
    const level = normalizeLevel(parsed?.level, score)
    const summary = String(parsed?.summary ?? '').trim()

    // --- リスクスコアの書き戻し（#5集合知モート/TOP5 #2 悪化アラートの土台）---
    //   診断のたびに company_risk_scores に1行 insert＝時系列・集約の素になる。
    //   既に clamp(0-100) 済みの値を固定カテゴリ順（CATEGORY_NAMES）で列マッピングする。
    //   ベストエフォート（テーブル未適用・RLS失敗でも診断結果は必ず返す＝既存UX非破壊）。
    await saveRiskScore(companyId, score, categories)

    return NextResponse.json({
      score,
      level,
      categories,
      topRisks,
      summary,
      disclaimer: RISK_AUDIT_DISCLAIMER,
    })
  } catch (e) {
    console.error('[company:risk-audit] sonnet failed', (e as Error).message)
    return NextResponse.json(
      { error: '診断に失敗しました。時間をおいて再度お試しください。' },
      { status: 502 },
    )
  }
}

/**
 * 診断結果を company_risk_scores に1行 insert する（時系列・集約の土台）。
 *   CATEGORY_NAMES の固定順をDB列にマッピングする。値は既に clamp 済み。
 *   ★ベストエフォート: テーブル未適用/RLS失敗でも例外を投げず握り潰す
 *     （診断レスポンスは必ず返す＝既存 risk UX を一切壊さない）。
 *   ★ RLS 下の anon(=ユーザーJWT) で書く＝company_risk_scores_member_insert を通す
 *     （自社のみ insert 可・テナント分離を尊重）。
 */
async function saveRiskScore(
  companyId: string,
  overall: number,
  categories: Category[],
): Promise<void> {
  try {
    // CATEGORY_NAMES と同順の前提で名前引きする（モデルが順序を崩しても名前で確実に当てる）。
    const byName = new Map(categories.map(c => [c.name, c.score]))
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('company_risk_scores').insert({
      company_id: companyId,
      overall,
      cat_working_hours: byName.get('労働時間') ?? null,
      cat_wages: byName.get('賃金') ?? null,
      cat_leave: byName.get('休暇') ?? null,
      cat_work_rules: byName.get('就業規則') ?? null,
      cat_social_insurance: byName.get('社会保険') ?? null,
      cat_childcare: byName.get('育児・介護') ?? null,
    })
    if (error) console.error('[company:risk-audit] score insert failed (non-fatal)', error.message)
  } catch (e) {
    console.error('[company:risk-audit] score insert threw (non-fatal)', (e as Error).message)
  }
}

/**
 * body.answers を {key,value}[] に正規化する。
 * オブジェクト（{設問:回答}）でも配列（[{key,value}]）でも受ける。
 */
function normalizeAnswers(
  input: Record<string, unknown> | { key: string; value: string }[] | undefined,
): { key: string; value: string }[] {
  if (!input) return []
  if (Array.isArray(input)) {
    return input
      .filter((it): it is { key: string; value: string } => !!it && typeof it === 'object')
      .map(it => ({ key: String(it.key ?? '').trim(), value: String(it.value ?? '').trim() }))
      .filter(a => a.key && a.value)
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .map(([k, v]) => ({ key: String(k).trim(), value: String(v ?? '').trim() }))
      .filter(a => a.key && a.value)
  }
  return []
}

/** スコアを 0〜100 の整数に丸める。不正値は 50（中庸）にフォールバック。 */
function clampScore(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * カテゴリを正規化。6カテゴリの存在・順序を骨格で保証し、モデルが返した値を当てる。
 * モデルが落としたカテゴリは「情報不足のため要確認」のプレースホルダで埋める。
 */
function normalizeCategories(v: unknown): Category[] {
  const arr = Array.isArray(v) ? v : []
  const byName = new Map<string, Record<string, unknown>>()
  for (const it of arr) {
    if (it && typeof it === 'object') {
      const name = String((it as Record<string, unknown>).name ?? '').trim()
      if (name) byName.set(name, it as Record<string, unknown>)
    }
  }
  return CATEGORY_NAMES.map(name => {
    const hit = byName.get(name)
    if (hit) {
      return {
        name,
        score: clampScore(hit.score),
        note: String(hit.note ?? '').trim(),
      }
    }
    return { name, score: 60, note: '情報不足のため要確認' }
  })
}

function normalizeTopRisks(v: unknown): TopRisk[] {
  const arr = Array.isArray(v) ? v : []
  const allowed = new Set(['high', 'medium', 'low'])
  return arr
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map(it => {
      const sevRaw = String(it.severity ?? '').trim().toLowerCase()
      const severity = (allowed.has(sevRaw) ? sevRaw : 'medium') as TopRisk['severity']
      return {
        title: String(it.title ?? '').trim(),
        severity,
        why: String(it.why ?? '').trim(),
        fix: String(it.fix ?? '').trim(),
      }
    })
    .filter(r => r.title)
    .slice(0, 3)
}

/** level をモデル値から採用しつつ、未指定/不正なら score から導出する。 */
function normalizeLevel(v: unknown, score: number): string {
  const s = String(v ?? '').trim()
  if (s === '要注意' || s === '改善の余地あり' || s === 'おおむね良好') return s
  if (score >= 75) return 'おおむね良好'
  if (score >= 50) return '改善の余地あり'
  return '要注意'
}

/**
 * モデル出力から JSON オブジェクトを取り出してパースする。
 * コードフェンス付き・前後に説明がある場合に備え、最初の { 〜 最後の } を切り出す。
 */
function parseJsonObject(raw: string): Record<string, any> | null {
  if (!raw) return null
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(s.slice(start, end + 1)) as Record<string, any>
  } catch {
    return null
  }
}
