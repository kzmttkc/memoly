import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership, loadCompanyAttributes } from '@/lib/company'
import { suggestDeadlines } from '@/lib/deadlines'

// ============================================================================
// /api/company/deadlines — F4 期限レジストリ CRUD + サジェスト
//   会社が管理したい労務の期限（company_deadlines）を登録/一覧/更新/削除する。
//
//   権限（company_documents/ingest と同じ考え方: 期限＝会社の正式な予定）:
//     読取り(GET): メンバー全員 / 書込み(POST/PATCH/DELETE): admin のみ。
//     全操作 anon(=ユーザーJWT) クライアントで実行し、RLS を最終防衛線とする。
//     認可は attributes/route.ts の requireAdmin をそのまま踏襲（新ヘルパを作らない）。
//
//   fail-safe（document/ingest と同じ流儀）:
//     テーブル未適用（supabase/company_deadlines.sql 適用前）の環境では
//     GET は空一覧 / POST は 503 を返し、原因をエラーメッセージで明示する。
//
//   Phase1コンプラ: 期日(due_on)はユーザーが確定する（システムは日付を断定しない）。
//   LLM 呼び出しなし（サジェストは lib/deadlines.ts の決定的ルール）＝ rate-limit 対象外。
// ============================================================================

const MAX_TITLE = 120
const MAX_NOTE = 2000

// 一覧で返す共通の列（原文メモまで含む＝一覧編集に使うため）。
const SELECT_COLS =
  'id, title, note, due_on, recurrence, source, active, last_notified_offset, last_notified_due_on, updated_at'

/** YYYY-MM-DD 形式かつ実在日付か（Date 経由で 2月30日等を弾く）。 */
function isValidDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// GET ?companyId=...        — 自社の有効な期限（メンバー可・due_on 昇順）。
// GET ?companyId=&suggest=1 — 未登録のサジェスト候補を返す（DB書込みなし）。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = membership.role === 'admin'

  // --- サジェスト分岐: 属性から候補を導き、登録済み title を除外して返す ---
  if (req.nextUrl.searchParams.get('suggest') === '1') {
    const attrs = await loadCompanyAttributes(companyId)
    const candidates = suggestDeadlines(attrs)

    // 既存の title 集合（active/inactive 問わず＝一度登録した名称は再提案しない）。
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('company_deadlines')
      .select('title')
      .eq('company_id', companyId)
    // テーブル未適用でも UI を壊さない: 既存が引けなければ「既存なし」として全候補を出す。
    const existing = new Set((error ? [] : (data ?? [])).map(r => (r.title as string) ?? ''))
    const suggestions = candidates.filter(c => !existing.has(c.title))
    return NextResponse.json({ suggestions, isAdmin })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('company_deadlines')
    .select(SELECT_COLS)
    .eq('company_id', companyId)
    .eq('active', true)
    .order('due_on', { ascending: true })

  // テーブル未適用環境でも UI を壊さない: select 失敗時は空一覧（document/ingest と同じ流儀）。
  if (error) {
    console.error('[company:deadlines] select failed', error.message)
    return NextResponse.json({ deadlines: [], isAdmin })
  }
  return NextResponse.json({ deadlines: data ?? [], isAdmin })
}

// POST { companyId, title, due_on, note?, recurrence?, source? } — 登録。adminのみ。
//   同一 (company_id,title,due_on) は upsert で差替え（重複登録を自然に防ぐ）。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, title, due_on, note, recurrence, source } = body as {
    companyId?: unknown
    title?: unknown
    due_on?: unknown
    note?: unknown
    recurrence?: unknown
    source?: unknown
  }

  const guard = await requireAdmin(companyId)
  if (guard) return guard

  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, MAX_TITLE) : ''
  if (!cleanTitle) {
    return NextResponse.json({ error: '期限の名称を入力してください' }, { status: 400 })
  }
  if (!isValidDateStr(due_on)) {
    return NextResponse.json({ error: '期日を YYYY-MM-DD 形式で入力してください' }, { status: 400 })
  }
  const cleanNote =
    typeof note === 'string' && note.trim() ? note.trim().slice(0, MAX_NOTE) : null
  const cleanRecurrence = recurrence === 'none' ? 'none' : 'yearly'
  const cleanSource = source === 'suggested' ? 'suggested' : 'manual'

  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('company_deadlines')
    .upsert(
      {
        company_id: companyId as string,
        title: cleanTitle,
        due_on,
        note: cleanNote,
        recurrence: cleanRecurrence,
        source: cleanSource,
        active: true,
        updated_at: now,
      },
      { onConflict: 'company_id,title,due_on' },
    )
    .select(SELECT_COLS)
    .single()

  if (error || !data) {
    console.error('[company:deadlines] upsert failed', error?.message)
    // テーブル未適用は運用側の適用漏れ＝ユーザー起因でないことを区別する（document/ingest と同型）。
    const notApplied = (error?.message ?? '').includes('company_deadlines') ||
      (error?.code ?? '') === '42P01'
    return NextResponse.json(
      {
        error: notApplied
          ? '期限の保存先がまだ準備されていません。時間をおいてお試しください。'
          : '期限の登録に失敗しました。時間をおいてお試しください。',
      },
      { status: notApplied ? 503 : 500 },
    )
  }
  return NextResponse.json({ deadline: data })
}

// PATCH { companyId, id, due_on?, note?, active?, recurrence?, done? } — 更新。adminのみ。
//   done=true（「済みにする」）: due_on を+1年に繰り上げ、通知状態をリセットして再武装する。
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { companyId, id, due_on, note, active, recurrence, done } = body as {
    companyId?: unknown
    id?: unknown
    due_on?: unknown
    note?: unknown
    active?: unknown
    recurrence?: unknown
    done?: unknown
  }

  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (done === true) {
    // 「済みにする」: 現在の due_on を1年後へ繰り上げ、通知状態をクリア（再通知を解禁）。
    const { data: cur, error: curErr } = await supabase
      .from('company_deadlines')
      .select('due_on')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (curErr || !cur) {
      return NextResponse.json({ error: '対象の期限が見つかりません' }, { status: 404 })
    }
    update.due_on = addOneYear(cur.due_on as string)
    update.last_notified_offset = null
    update.last_notified_due_on = null
  } else {
    if (due_on !== undefined) {
      if (!isValidDateStr(due_on)) {
        return NextResponse.json({ error: '期日を YYYY-MM-DD 形式で入力してください' }, { status: 400 })
      }
      update.due_on = due_on
      // 期日を手で変えたら通知状態もリセット（新しい期日で改めて通知できるように）。
      update.last_notified_offset = null
      update.last_notified_due_on = null
    }
    if (note !== undefined) {
      update.note =
        typeof note === 'string' && note.trim() ? note.trim().slice(0, MAX_NOTE) : null
    }
    if (active !== undefined) update.active = active === true
    if (recurrence !== undefined) update.recurrence = recurrence === 'none' ? 'none' : 'yearly'
  }

  const { data, error } = await supabase
    .from('company_deadlines')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(SELECT_COLS)
    .single()

  if (error || !data) {
    console.error('[company:deadlines] update failed', error?.message)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ deadline: data })
}

// DELETE ?companyId=&id= — 削除。adminのみ。
export async function DELETE(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const id = req.nextUrl.searchParams.get('id')
  const guard = await requireAdmin(companyId)
  if (guard) return guard
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('company_deadlines')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId as string)

  // 生の error.message を返さない（他ハンドラと同じく汎用文＝情報漏えい面を揃える）。
  if (error) {
    console.error('[company:deadlines] delete failed', error.message)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/** YYYY-MM-DD を1年後の YYYY-MM-DD へ（うるう日 2/29 は 2/28 に丸める）。 */
function addOneYear(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const nextYear = y + 1
  // 2/29 → 翌年に2/29が無ければ2/28へ丸める（Date のロールオーバーを避け明示的に判定）。
  const daysInMonth = new Date(Date.UTC(nextYear, m, 0)).getUTCDate()
  const day = Math.min(d, daysInMonth)
  const mm = String(m).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${nextYear}-${mm}-${dd}`
}

// 共通: ログイン + admin 所属を要求（attributes/route.ts の requireAdmin をコピー）。
async function requireAdmin(companyId: unknown): Promise<NextResponse | null> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ編集できます' }, { status: 403 })
  }
  return null
}
