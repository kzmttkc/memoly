import { NextRequest, NextResponse } from 'next/server'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
} from '@/lib/company'
import { getOrGenerateDigest } from '@/lib/digest'
import { resolvePlan } from '@/lib/plans'

// ============================================================================
// /api/company/digest — 「今週、自社に関係する変更」能動フィード
//   会社プロファイルに照らして対象になりうる法改正・助成金を、会社×ISO週で
//   キャッシュして返す（受け身→能動の起点・リテンション）。
//
//   コスト制御: 生成は会社×週で1回。当週キャッシュがあれば LLM を呼ばない。
//   未生成かつ生成上限超過時は 429。生成は lib/digest.ts 内で rate-limit を通す。
//
//   空状態(TTV): プロファイルが「最低限（業種/人数 など）」すら無い会社では LLM を
//   走らせず、profileEmpty=true を返して UI を「まず自社のことを教えてください」CTA
//   一本に倒す（主要アクション1つ原則・無駄な生成コストも防ぐ）。
//
//   返却:
//     成功 : { period, cached, profileEmpty:false, cards, subsidiesSource,
//              generatedAt, disclaimer, humanReview }
//     空   : { profileEmpty:true, profileCount }
//     エラー: { error } + 4xx/5xx
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId } = body as { companyId?: string }

  // --- company_id 確定（既存ルートと同一の流儀）---
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

  // --- 空状態(TTV): 最低限のプロファイルが無ければ生成せず CTA へ倒す ---
  //   フィードは「自社プロファイルで対象判定」が生命線。空のままLLMを走らせると
  //   汎用ニュース配信になり差別化が死ぬ。閾値=プロファイル1件以上を「最低限あり」とする。
  const ctx = await loadCompanyContext(companyId)
  const profileCount = ctx.profiles.length
  if (profileCount === 0) {
    return NextResponse.json({ profileEmpty: true, profileCount: 0 })
  }

  // --- フィード取得（キャッシュ優先・lazy生成）---
  const result = await getOrGenerateDigest(companyId, companyName, user.id, plan)
  if (!result) {
    return NextResponse.json(
      { error: '本日の生成上限に達しました。時間をおいてお試しください。' },
      { status: 429 },
    )
  }

  return NextResponse.json({
    profileEmpty: false,
    profileCount,
    period: result.period,
    cached: result.cached,
    cards: result.payload.cards,
    subsidiesSource: result.payload.subsidiesSource,
    generatedAt: result.payload.generatedAt,
    disclaimer: result.payload.disclaimer,
    humanReview: result.payload.humanReview,
  })
}
