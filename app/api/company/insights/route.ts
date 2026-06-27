import { NextRequest, NextResponse } from 'next/server'
import { INSIGHTS_DISCLAIMER } from '@/lib/prompts'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
} from '@/lib/company'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan } from '@/lib/plans'
import { loadSubsidies, loadLawChanges } from '@/lib/insights-core'

// ============================================================================
// /api/company/insights — 能動インサイト（提案B 助成金 / 提案D 法改正）
//   会社プロファイル（業種/規模/状況）を起点に、オンデマンドで
//     (B) 自社が使える可能性のある助成金（Dify助成金ボット優先・sonnetフォールバック）
//     (D) 自社に関係する近時の労務法改正＋自社への影響（sonnet）
//   を構造化して返す。期日リマインダ配信は今回スコープ外（オンデマンド表示まで）。
//
//   生成ロジックは lib/insights-core.ts に切り出し済み（能動フィード lib/digest.ts と
//   共通化・重複実装を回避）。本ルートは認証/会社解決/レート制限/免責付与に専念する。
//
//   フロー（既存 chat / document ルートと同一の流儀）:
//     1. ログイン確認 → company_id 確定（指定があれば所属検証、無ければ default）
//     2. company_profiles を読む
//     3. (B)(D) を並列実行
//     4. Phase1 免責をコード強制で付与して JSON 返却
//
//   Phase1コンプラ: 「社労士監修」「AI社労士」「法的精度」不使用・条件形（プロンプトで強制）。
//   返却: { subsidies:[{name,reason,nextStep}], lawChanges:[{title,summary,impact,action}],
//          subsidiesSource:'dify'|'sonnet', disclaimer }
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId } = body as { companyId?: string }

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

  // --- 日次利用上限ガード（plan連動・高コストsonnet×2前）。超過は429。DB未適用時はfail-open ---
  if (!(await checkAndIncrement(user.id, 'insights', plan))) {
    return NextResponse.json(
      { error: '本日の利用上限に達しました。時間をおいてお試しください。' },
      { status: 429 },
    )
  }

  const ctx = await loadCompanyContext(companyId)
  const profiles = ctx.profiles

  // (B) 助成金 と (D) 法改正 を並列実行
  const [subsidyResult, lawChanges] = await Promise.all([
    loadSubsidies(companyName, profiles, companyId),
    loadLawChanges(companyName, profiles),
  ])

  return NextResponse.json({
    subsidies: subsidyResult.subsidies,
    subsidiesSource: subsidyResult.source,
    lawChanges,
    disclaimer: INSIGHTS_DISCLAIMER,
  })
}
