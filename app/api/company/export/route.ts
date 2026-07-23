import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'

// ============================================================================
// /api/company/export — 会社データの一括エクスポート(JSON)（F10・2026-07-23）
// ----------------------------------------------------------------------------
//   目的: 「データはお客様のもの」を実装で担保する（ロックイン不安の解消・
//   GDPR/個情法のデータポータビリティ要請への実務対応）。設定画面(/company/billing)
//   から admin がワンクリックで自社データ一式を JSON ダウンロードできる。
//
//   設計:
//     - GET ?companyId=...（読取り専用・冪等）。
//     - admin のみ（会社データ全量＝相談履歴を含む機微データのため、member には出さない。
//       member 個人のデータ持ち出し経路を増やさない）。
//     - 読取りは anon(=ユーザーJWT) クライアント: RLS が会社スコープを二重に強制する
//       （アプリ層の membership 検証と RLS の二層防御＝既存ルートの流儀）。
//     - LLM は呼ばない（DB の決定的データを束ねるだけ・低コスト）。
//     - 実行は監査ログ(data.export)に記録する（全量持ち出しは追跡すべき重要操作）。
//     - 上限: 各テーブル最大 5,000 行（現実の利用規模の百倍以上。異常な巨大化での
//       メモリ暴発だけを防ぐ安全弁。超えた場合は truncated フラグで明示）。
// ============================================================================

const ROW_LIMIT = 5000

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) {
    return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
  }
  if (membership.role !== 'admin') {
    return NextResponse.json(
      { error: 'データエクスポートは管理者のみ実行できます' },
      { status: 403 },
    )
  }

  const supabase = await createServerSupabaseClient()

  // 会社スコープの主要データを並列取得（すべて RLS 下・会社IDで絞る）。
  const [profiles, memories, documents, deadlines, conversations] = await Promise.all([
    supabase
      .from('company_profiles')
      .select('key, value, updated_at')
      .eq('company_id', companyId)
      .order('key')
      .limit(ROW_LIMIT),
    supabase
      .from('company_memories')
      .select('summary, memory_type, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('company_documents')
      .select('title, doc_type, content, char_count, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('company_deadlines')
      .select('title, note, due_on, recurrence, source, active, created_at')
      .eq('company_id', companyId)
      .order('due_on', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('company_conversations')
      .select('id, title, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT),
  ])

  const firstError =
    profiles.error ?? memories.error ?? documents.error ?? deadlines.error ?? conversations.error
  if (firstError) {
    console.error('[company:export] fetch failed', firstError.message)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }

  // 相談履歴の本文（会話ごとのメッセージ）。会話IDで一括取得して束ねる。
  const convIds = (conversations.data ?? []).map((c) => c.id)
  let messagesByConv = new Map<string, { role: string; content: string; created_at: string }[]>()
  if (convIds.length > 0) {
    const { data: msgs, error: msgErr } = await supabase
      .from('company_messages')
      .select('conversation_id, role, content, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true })
      .limit(ROW_LIMIT)
    if (msgErr) {
      console.error('[company:export] messages fetch failed', msgErr.message)
      return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
    }
    messagesByConv = (msgs ?? []).reduce((map, m) => {
      const arr = map.get(m.conversation_id) ?? []
      arr.push({ role: m.role, content: m.content, created_at: m.created_at })
      map.set(m.conversation_id, arr)
      return map
    }, messagesByConv)
  }

  const payload = {
    format: 'banto-company-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    company: { id: companyId, name: membership.name ?? null },
    rules: profiles.data ?? [], // 自社ルール（会社の記憶・確定値）
    memories: memories.data ?? [], // 相談から抽出された長期記憶
    documents: documents.data ?? [], // 取込済み規程の原文
    deadlines: deadlines.data ?? [], // 労務の期限
    conversations: (conversations.data ?? []).map((c) => ({
      title: c.title,
      created_at: c.created_at,
      messages: messagesByConv.get(c.id) ?? [],
    })),
    truncated:
      (profiles.data?.length ?? 0) >= ROW_LIMIT ||
      (memories.data?.length ?? 0) >= ROW_LIMIT ||
      (documents.data?.length ?? 0) >= ROW_LIMIT ||
      (deadlines.data?.length ?? 0) >= ROW_LIMIT ||
      (conversations.data?.length ?? 0) >= ROW_LIMIT,
  }

  // 監査ログ（重要操作: 全量エクスポート）。件数のみ記録・本文は入れない（非PII運用）。
  await logCompanyAudit({
    companyId,
    actorUserId: user.id,
    action: 'data.export',
    targetType: 'company',
    targetId: companyId,
    metadata: {
      rules: payload.rules.length,
      memories: payload.memories.length,
      documents: payload.documents.length,
      deadlines: payload.deadlines.length,
      conversations: payload.conversations.length,
    },
  })

  const filename = `banto-export-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
