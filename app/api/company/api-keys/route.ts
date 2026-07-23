import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'
import { generateApiKey } from '@/lib/api-keys'

// ============================================================================
// /api/company/api-keys — 公開API v1 のAPIキー管理（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   admin が会社ごとのAPIキーを発行/一覧/失効する。
//     - 生キーは発行レスポンスで**一度だけ**返す（DBはSHA-256ハッシュのみ保存）。
//     - 一覧は prefix・作成日・最終利用・失効状態のみ（ハッシュも生キーも返さない）。
//     - 失効は revoked_at を立てる（行は消さない＝監査証跡）。
//   すべて anon(=ユーザーJWT) クライアントで実行し、RLS(admin限定)を最終防衛線とする。
// ============================================================================

const MAX_KEYS_PER_COMPANY = 10
const MAX_NAME = 60

const LIST_COLS = 'id, name, key_prefix, created_at, last_used_at, revoked_at'

// GET ?companyId= — キー一覧（admin のみ）。
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_api_keys')
    .select(LIST_COLS)
    .eq('company_id', companyId as string)
    .order('created_at', { ascending: false })

  // テーブル未適用でも UI を壊さない: 空一覧。
  if (error) {
    console.error('[company:api-keys] select failed (non-fatal)', error.code)
    return NextResponse.json({ keys: [] })
  }
  return NextResponse.json({ keys: data ?? [] })
}

// POST { companyId, name? } — キー発行（admin のみ）。生キーはこのレスポンス限り。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, name } = body as { companyId?: unknown; name?: unknown }

  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const cleanName =
    typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_NAME) : 'APIキー'

  const supabase = await createServerSupabaseClient()

  // 上限（乱発防止・失効済みも行として残るため全行で数える）。
  const { count } = await supabase
    .from('company_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId as string)
  if ((count ?? 0) >= MAX_KEYS_PER_COMPANY) {
    return NextResponse.json(
      { error: `APIキーは1社あたり${MAX_KEYS_PER_COMPANY}件までです。不要なキーを失効してください。` },
      { status: 400 },
    )
  }

  const user = await getCurrentUser()
  const generated = generateApiKey()
  const { data, error } = await supabase
    .from('company_api_keys')
    .insert({
      company_id: companyId as string,
      name: cleanName,
      key_prefix: generated.keyPrefix,
      key_hash: generated.keyHash,
      created_by: user?.id ?? null,
    })
    .select(LIST_COLS)
    .single()

  if (error || !data) {
    console.error('[company:api-keys] insert failed', error?.code)
    const notApplied = (error?.code ?? '') === '42P01'
    return NextResponse.json(
      {
        error: notApplied
          ? 'APIキーの保存先がまだ準備されていません。時間をおいてお試しください。'
          : 'APIキーの発行に失敗しました。時間をおいてお試しください。',
      },
      { status: notApplied ? 503 : 500 },
    )
  }

  if (user) {
    await logCompanyAudit({
      companyId: companyId as string,
      actorUserId: user.id,
      action: 'apikey.create',
      targetType: 'api_key',
      targetId: data.id as string,
      metadata: { prefix: generated.keyPrefix, name: cleanName },
    })
  }

  // plainKey はここで一度だけ返す（保存もログもしない）。
  return NextResponse.json({ key: data, plainKey: generated.plainKey })
}

// PATCH { companyId, id } — キー失効（admin のみ・冪等）。
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, id } = body as { companyId?: unknown; id?: unknown }

  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId as string)
    .is('revoked_at', null)
    .select(LIST_COLS)
    .maybeSingle()

  if (error) {
    console.error('[company:api-keys] revoke failed', error.code)
    return NextResponse.json({ error: '失効に失敗しました' }, { status: 500 })
  }
  if (!data) {
    // 既に失効済み or 存在しない: 冪等に成功扱い（現在の一覧を再取得してもらう）。
    return NextResponse.json({ ok: true, alreadyRevoked: true })
  }

  const user = await getCurrentUser()
  if (user) {
    await logCompanyAudit({
      companyId: companyId as string,
      actorUserId: user.id,
      action: 'apikey.revoke',
      targetType: 'api_key',
      targetId: id,
      metadata: { prefix: data.key_prefix as string },
    })
  }
  return NextResponse.json({ ok: true, key: data })
}

// 共通: ログイン + admin 所属を要求（deadlines/route.ts の requireAdmin と同型）。
async function requireAdmin(companyId: unknown): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
  }
  return null
}
