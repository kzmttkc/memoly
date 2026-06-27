import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import {
  buildDocumentGenSystemPrompt,
  buildDocumentGenDifyQuery,
  DOCUMENT_DISCLAIMER,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/prompts'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
} from '@/lib/company'
import { generateDocumentViaDify } from '@/lib/dify'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan } from '@/lib/plans'

// ============================================================================
// /api/company/document/generate — 書類ドラフト生成（提案A=有料の核・前半）
//   会社プロファイル（自社ルール）を前提に、選択された書類のドラフトを生成する。
//
//   フロー:
//     1. ログイン確認 → company_id 確定（既存 chat ルートと同じパターン）
//     2. company_profiles を読む
//     3. 該当の生成系Difyボットに「会社プロファイル＋依頼」を投げてドラフト取得
//        Dify不可（対応ボット無し/鍵無し/失敗）→ sonnet で会社プロファイル＋一般ひな型から生成
//     4. Phase1免責を必ず末尾に付して text を返す（保存はしない＝P1）
//
//   Phase1コンプラ: 「社労士監修」「AI社労士」「法的精度」不使用・条件形（プロンプトで強制）。
// ============================================================================

const SUPPORTED_TYPES = Object.keys(DOCUMENT_TYPE_LABELS)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { documentType, companyId: bodyCompanyId } = body as {
    documentType?: string
    companyId?: string
  }

  if (!documentType || typeof documentType !== 'string') {
    return NextResponse.json({ error: 'documentType が必要です' }, { status: 400 })
  }
  if (!SUPPORTED_TYPES.includes(documentType)) {
    return NextResponse.json(
      { error: `未対応の書類種別です（対応: ${SUPPORTED_TYPES.join(' / ')}）` },
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

  // --- 日次利用上限ガード（plan連動・高コスト生成前）。超過は429。DB未適用時はfail-open ---
  if (!(await checkAndIncrement(user.id, 'document_generate', plan))) {
    return NextResponse.json(
      { error: '本日の利用上限に達しました。時間をおいてお試しください。' },
      { status: 429 },
    )
  }

  const ctx = await loadCompanyContext(companyId)
  const profiles = ctx.profiles

  // --- ドラフト生成: Dify生成ボット優先 → 失敗時 sonnet フォールバック ---
  let draft = ''
  let source: 'dify' | 'sonnet' = 'sonnet'

  const difyQuery = buildDocumentGenDifyQuery(companyName, documentType, profiles)
  const difyResult = await generateDocumentViaDify(documentType, difyQuery, companyId)

  if (difyResult && difyResult.answer.trim().length > 80) {
    draft = difyResult.answer.trim()
    source = 'dify'
  } else {
    // フォールバック: sonnet で会社プロファイル＋一般ひな型からドラフト生成
    const system = buildDocumentGenSystemPrompt(companyName, documentType, profiles)
    try {
      const resp = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 4096,
        system,
        messages: [
          {
            role: 'user',
            content: `${DOCUMENT_TYPE_LABELS[documentType]}のドラフトを、自社の前提に沿って本文だけ作成してください。`,
          },
        ],
      })
      draft = resp.content.find(b => b.type === 'text')?.text?.trim() ?? ''
    } catch (e) {
      console.error('[company:document:generate] sonnet failed', (e as Error).message)
      return NextResponse.json(
        { error: 'ドラフト生成に失敗しました。時間をおいて再度お試しください。' },
        { status: 502 },
      )
    }
  }

  if (!draft) {
    return NextResponse.json({ error: 'ドラフトを生成できませんでした' }, { status: 502 })
  }

  // Phase1 免責を必ず末尾に付す
  const text = `${draft}\n\n---\n${DOCUMENT_DISCLAIMER}`

  return NextResponse.json({
    documentType,
    text,
    source,
  })
}
