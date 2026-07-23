import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/company'
import { authenticateApiKey } from '@/lib/api-keys'
import { checkAndIncrement } from '@/lib/rate-limit'

// ============================================================================
// GET /api/v1/memories — 公開API v1: 会社の記憶一覧（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   認証: Authorization: Bearer banto_sk_...（APIキー。発行は設定画面のadmin操作）。
//   read-only。書き込み系は提供しない（v1はread系から開始）。
//
//   スコープ強制: APIキー認証はユーザーJWTを持たないため RLS に乗れない。
//   service role で読み、**全クエリに .eq('company_id', auth.companyId) を必ず付ける**
//   ことでアプリ層が会社境界を強制する（lib/api-keys.ts の設計コメント参照）。
//
//   レート制限: 既存機構（memoly_increment_api_usage RPC）に相乗り。
//   カウンタ主体は会社ID・kind='api_v1'・上限はプラン連動（lib/plans.ts）。
//
//   ページング: created_at 降順 + cursor（前ページ末尾の created_at より過去を返す）。
//   仕様書: docs/API_V1.md
// ============================================================================

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'APIキーが無効か、失効しています。' } },
      { status: 401 },
    )
  }

  // レート制限（会社単位・日次・プラン連動）。
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
  const cursor = params.get('cursor')
  const memoryType = params.get('type') // 任意フィルタ: summary / decision / rule

  const admin = createAdminClient()
  let query = admin
    .from('company_memories')
    .select('id, summary, memory_type, topic, subject, decided_at, created_at')
    .eq('company_id', auth.companyId) // ★会社スコープ強制（絶対に外さない）
    .order('created_at', { ascending: false })
    .limit(limit + 1) // has_more 判定のため1件多く引く

  if (cursor) {
    // cursor は前ページ最終行の created_at(ISO)。不正値は 400。
    if (Number.isNaN(Date.parse(cursor))) {
      return NextResponse.json(
        { error: { code: 'invalid_cursor', message: 'cursor の形式が不正です。' } },
        { status: 400 },
      )
    }
    query = query.lt('created_at', cursor)
  }
  if (memoryType) query = query.eq('memory_type', memoryType)

  const { data, error } = await query
  if (error) {
    console.error('[api:v1:memories] select failed', error.code)
    return NextResponse.json(
      { error: { code: 'internal_error', message: '取得に失敗しました。時間をおいてお試しください。' } },
      { status: 500 },
    )
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    object: 'list',
    data: page.map(r => ({
      id: r.id,
      summary: r.summary,
      memory_type: r.memory_type,
      topic: r.topic ?? null,
      subject: r.subject ?? null,
      decided_at: r.decided_at ?? null,
      created_at: r.created_at,
    })),
    has_more: hasMore,
    next_cursor: hasMore ? page[page.length - 1].created_at : null,
  })
}
