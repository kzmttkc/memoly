import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/company'
import { authenticateApiKey } from '@/lib/api-keys'
import { checkAndIncrement } from '@/lib/rate-limit'

// ============================================================================
// GET /api/v1/deadlines — 公開API v1: 労務期限の一覧（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   認証・スコープ強制・レート制限は /api/v1/memories と同一の流儀:
//     - Bearer APIキー → lib/api-keys.ts で会社解決
//     - service role + .eq('company_id', auth.companyId) の必須付与
//     - kind='api_v1'（会社単位・日次・プラン連動）
//   期限は会社あたり高々数十件のため cursor は持たない（limit のみ）。
//   仕様書: docs/API_V1.md
// ============================================================================

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'APIキーが無効か、失効しています。' } },
      { status: 401 },
    )
  }

  const allowed = await checkAndIncrement(auth.companyId, 'api_v1', auth.plan)
  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: '本日のAPI利用上限に達しました。' } },
      { status: 429 },
    )
  }

  const params = req.nextUrl.searchParams
  const limitRaw = Number(params.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT) : DEFAULT_LIMIT
  // 既定は有効な期限のみ。all=1 で無効化済みも含める。
  const includeInactive = params.get('all') === '1'

  const admin = createAdminClient()
  let query = admin
    .from('company_deadlines')
    .select('id, title, note, due_on, recurrence, source, active, created_at, updated_at')
    .eq('company_id', auth.companyId) // ★会社スコープ強制（絶対に外さない）
    .order('due_on', { ascending: true })
    .limit(limit)
  if (!includeInactive) query = query.eq('active', true)

  const { data, error } = await query
  if (error) {
    console.error('[api:v1:deadlines] select failed', error.code)
    return NextResponse.json(
      { error: { code: 'internal_error', message: '取得に失敗しました。時間をおいてお試しください。' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    object: 'list',
    data: (data ?? []).map(r => ({
      id: r.id,
      title: r.title,
      note: r.note ?? null,
      due_on: r.due_on,
      recurrence: r.recurrence,
      source: r.source,
      active: r.active,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    has_more: false,
    next_cursor: null,
  })
}
