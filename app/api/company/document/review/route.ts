import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { buildReviewSystemPrompt, REVIEW_DISCLAIMER } from '@/lib/prompts'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
} from '@/lib/company'
import { maybeAskDifyForQuery } from '@/lib/dify'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan } from '@/lib/plans'

// ============================================================================
// /api/company/document/review — 既存規程のAIレビュー（提案A=有料の核・後半）
//   ユーザーが貼った既存規程（就業規則・賃金規程など）を、会社プロファイル＋
//   現行労務法（令和7改正値）の観点で sonnet がレビューし、
//   「危ない条文/不足/古い規定」を構造化リストで返す。
//
//   Phase1コンプラ: 断定的個別法律判断を避け条件形（プロンプトで強制）。免責を必ず付す。
// ============================================================================

interface ReviewItem {
  severity: 'high' | 'medium' | 'low'
  category: string
  clause: string
  issue: string
  suggestion: string
}

const MAX_TEXT = 20_000

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { documentText, companyId: bodyCompanyId } = body as {
    documentText?: string
    companyId?: string
  }

  if (!documentText || typeof documentText !== 'string' || documentText.trim().length < 10) {
    return NextResponse.json(
      { error: 'レビューする規程テキストを貼り付けてください' },
      { status: 400 },
    )
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

  // --- 日次利用上限ガード（plan連動・高コストレビュー前）。超過は429。DB未適用時はfail-open ---
  if (!(await checkAndIncrement(user.id, 'document_review', plan))) {
    return NextResponse.json(
      { error: '本日の利用上限に達しました。時間をおいてお試しください。' },
      { status: 429 },
    )
  }

  const text = documentText.slice(0, MAX_TEXT)

  // 会社プロファイル + （規程内容に法令キーワードがあれば）Dify一次情報を並列取得
  const [ctx, difyContext] = await Promise.all([
    loadCompanyContext(companyId),
    maybeAskDifyForQuery(text.slice(0, 1000), companyId),
  ])

  const system = buildReviewSystemPrompt(companyName, ctx.profiles, difyContext)

  let raw = ''
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: 'user',
          content: `次の既存規程をレビューしてください。指定のJSON形式のみで返してください。\n\n----\n${text}\n----`,
        },
      ],
    })
    raw = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  } catch (e) {
    console.error('[company:document:review] sonnet failed', (e as Error).message)
    return NextResponse.json(
      { error: 'レビューに失敗しました。時間をおいて再度お試しください。' },
      { status: 502 },
    )
  }

  const parsed = parseReviewJson(raw)
  if (!parsed) {
    // パース失敗時は本文をそのまま返し、画面で全文表示できるようにする
    return NextResponse.json({
      items: [],
      summary: raw || 'レビュー結果を構造化できませんでした。',
      disclaimer: REVIEW_DISCLAIMER,
    })
  }

  return NextResponse.json({
    items: parsed.items,
    summary: parsed.summary,
    disclaimer: REVIEW_DISCLAIMER,
  })
}

/**
 * モデル出力から JSON を取り出してパースする。
 * コードフェンス付き・前後に説明がある場合に備え、最初の { 〜 最後の } を切り出す。
 */
function parseReviewJson(
  raw: string,
): { items: ReviewItem[]; summary: string } | null {
  if (!raw) return null
  let s = raw.trim()
  // ```json ... ``` のフェンスを除去
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const obj = JSON.parse(s.slice(start, end + 1)) as {
      items?: unknown
      summary?: unknown
    }
    const items: ReviewItem[] = Array.isArray(obj.items)
      ? obj.items
          .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
          .map(it => ({
            severity: normSeverity(it.severity),
            category: String(it.category ?? '指摘'),
            clause: String(it.clause ?? ''),
            issue: String(it.issue ?? ''),
            suggestion: String(it.suggestion ?? ''),
          }))
      : []
    const summary = typeof obj.summary === 'string' ? obj.summary : ''
    return { items, summary }
  } catch {
    return null
  }
}

function normSeverity(v: unknown): 'high' | 'medium' | 'low' {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'medium'
}
