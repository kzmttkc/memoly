import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getMembership, resolveDefaultCompany } from '@/lib/company'
import { loadHandoverSummary } from '@/lib/handover'

// ============================================================================
// /api/company/handover — 「会社の記憶 引き継ぎビュー」のデータ取得（TOP5 #4）
//   担当交代/承継時に「会社の記憶を引き継ぐ」ための集約サマリーを返す。
//     - 確定した自社ルール + 過去の主要判断 + 関係者ごとの状況 + 現行リスク要点。
//   LLM を呼ばない（既存の決定的データを束ねるだけ）。読取りは RLS 下 anon＝自社のみ。
//
//   フロー（既存 digest/memory ルートと同一の流儀）:
//     1. ログイン確認 → company_id 確定（指定があれば所属検証、無ければ default）
//     2. loadHandoverSummary で集約して返す
//
//   GET ?companyId=... を採用（読取り専用・冪等・記憶ページからのフェッチに合わせる）。
//   返却: { companyName, rules, decisions, people, risk }
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bodyCompanyId = req.nextUrl.searchParams.get('companyId')

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

  const summary = await loadHandoverSummary(companyId)

  return NextResponse.json({ companyName, ...summary })
}
