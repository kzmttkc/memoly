import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'

// ============================================================================
// /api/company/document/ingest — F1 規程まるごと取込
//   看板「会社を覚える」と実体の一致: 就業規則などの規程を**原文まるごと**
//   会社の記憶（company_documents）として保存する経路。従来は
//   /document/review が 20,000字を受けてレビュー後に本文破棄しており、
//   規程の全文を番頭に記憶させる手段が無かった。
//
//   フロー（documents ページのレビュータブから）:
//     1. レビュー応答に含まれる自社ルール候補(companyFacts)をユーザーが取捨選択
//     2. 本ルート POST が (a) 規程原文を company_documents に upsert（同名は差替え）
//        (b) 承認済みルールを company_profiles に upsert
//     3. 以降のチャットは lib/company.ts loadRelevantRuleExcerpts が関連条文の
//        原文抜粋を system に注入する（「自社の規程では第◯条に〜」と答えられる）
//
//   権限（company_profiles と同じ考え方: 規程＝会社の正式ルール）:
//     読取り(GET): メンバー全員 / 書込み(POST)・削除(DELETE): admin のみ。
//     全操作 anon(=ユーザーJWT) クライアントで実行し、RLS を最終防衛線とする。
//
//   LLM 呼び出しなし（抽出は review 呼び出しに相乗り済み）＝ rate-limit 対象外。
//   テーブル未適用（supabase/company_documents.sql 適用前）の環境では
//   GET は空一覧 / POST は 503 を返し、原因をエラーメッセージで明示する。
// ============================================================================

// 原文の最大文字数。review の 20,000字より広く取る（就業規則全文は 2〜6万字が普通）。
// DB 側 CHECK(200,000) より狭い＝アプリ層が先に止める。
const MAX_CONTENT = 100_000
// 一括登録できる自社ルール候補の上限（review 側の抽出上限12件より余裕を持たせる）。
const MAX_PROFILES = 20

interface IngestProfile {
  key: string
  value: string
}

// GET ?companyId=... — 取込済み規程の一覧（メンバー可・原文は返さず軽量メタのみ）。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_documents')
    .select('id, title, doc_type, char_count, updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })

  // テーブル未適用環境でも UI を壊さない: select 失敗時は空一覧（attributes と同じ流儀）。
  if (error) {
    console.error('[company:document:ingest] select failed', error.message)
    return NextResponse.json({ documents: [] })
  }
  return NextResponse.json({ documents: data ?? [] })
}

// POST { companyId, title, docType?, documentText, profiles? } — 取込。adminのみ。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, title, docType, documentText, profiles } = body as {
    companyId?: unknown
    title?: unknown
    docType?: unknown
    documentText?: unknown
    profiles?: unknown
  }

  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 100) : ''
  if (!cleanTitle) {
    return NextResponse.json({ error: '規程名（title）を入力してください' }, { status: 400 })
  }
  if (typeof documentText !== 'string' || documentText.trim().length < 10) {
    return NextResponse.json({ error: '取り込む規程テキストを貼り付けてください' }, { status: 400 })
  }

  const content = documentText.trim().slice(0, MAX_CONTENT)
  const supabase = await createServerSupabaseClient()

  // --- (a) 規程原文を upsert（同じ規程名は差替え＝規程改定時の再取込を自然にする）---
  const now = new Date().toISOString()
  const { data: doc, error: docErr } = await supabase
    .from('company_documents')
    .upsert(
      {
        company_id: companyId as string,
        title: cleanTitle,
        doc_type: typeof docType === 'string' ? docType.trim().slice(0, 50) || null : null,
        content,
        char_count: content.length,
        updated_at: now,
      },
      { onConflict: 'company_id,title' },
    )
    .select('id, title, doc_type, char_count, updated_at')
    .single()

  if (docErr || !doc) {
    console.error('[company:document:ingest] upsert failed', docErr?.message)
    // テーブル未適用は運用側の適用漏れ＝ユーザー起因でないことをメッセージで区別する。
    const notApplied = (docErr?.message ?? '').includes('company_documents')
    return NextResponse.json(
      {
        error: notApplied
          ? '規程の保存先がまだ準備されていません。時間をおいてお試しください。'
          : '規程の取込に失敗しました。時間をおいてお試しください。',
      },
      { status: notApplied ? 503 : 500 },
    )
  }

  // --- (b) 承認済みの自社ルール候補を company_profiles へ upsert（ベストエフォート）---
  //   規程原文の保存が主目的なので、ルール側の一部失敗で全体を巻き戻さない。
  //   失敗件数は返して UI がトーストで知らせる。
  let savedProfiles = 0
  let failedProfiles = 0
  if (Array.isArray(profiles)) {
    const clean: IngestProfile[] = profiles
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map(p => ({
        key: String(p.key ?? '').trim().slice(0, 100),
        value: String(p.value ?? '').trim().slice(0, 500),
      }))
      .filter(p => p.key && p.value)
      .slice(0, MAX_PROFILES)

    for (const p of clean) {
      const { error } = await supabase
        .from('company_profiles')
        .upsert(
          { company_id: companyId as string, key: p.key, value: p.value, updated_at: now },
          { onConflict: 'company_id,key' },
        )
      if (error) {
        failedProfiles++
        console.error('[company:document:ingest] profile upsert failed', p.key, error.message)
      } else {
        savedProfiles++
      }
    }
  }

  return NextResponse.json({ document: doc, savedProfiles, failedProfiles })
}

// DELETE { companyId, id } — 取込済み規程の削除。adminのみ。
export async function DELETE(req: NextRequest) {
  const { companyId, id } = await req.json().catch(() => ({}))
  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('company_documents')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  // 生の error.message を返さない（deadlines と同じく汎用文＝情報漏えい面を揃える）。
  if (error) {
    console.error('[company:document] delete failed', error.message)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  // 監査ログ（重要操作: 取込規程の削除）。ベストエフォート。
  const actor = await getCurrentUser()
  if (actor) {
    await logCompanyAudit({
      companyId,
      actorUserId: actor.id,
      action: 'document.delete',
      targetType: 'company_document',
      targetId: id,
    })
  }
  return NextResponse.json({ ok: true })
}

// 共通: ログイン + admin 所属を要求（profile route と同じ流儀）。
async function requireAdmin(companyId: unknown): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ取込できます' }, { status: 403 })
  }
  return null
}
