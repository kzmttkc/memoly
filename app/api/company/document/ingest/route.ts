import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { logCompanyAudit } from '@/lib/audit'
import { anthropic, MEMORY_MODEL } from '@/lib/claude'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan, upgradeAvailable } from '@/lib/plans'

// ============================================================================
// /api/company/document/ingest — F1 規程まるごと取込
//   看板「会社を覚える」と実体の一致: 就業規則などの規程を**原文まるごと**
//   会社の記憶（company_documents）として保存する経路。従来は
//   /document/review が 20,000字を受けてレビュー後に本文破棄しており、
//   規程の全文をKabauに記憶させる手段が無かった。
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
//   LLM 呼び出し（D22・2026-07-23 追加）:
//     初回取込では呼ばない（抽出は review 呼び出しに相乗り済み・コスト最小）。
//     **同名規程の再取込（＝改定）時のみ**、旧版との差分を行単位でローカル抽出し、
//     差分行だけを haiku（MEMORY_MODEL）へ渡して「何が変わったか」の要約を生成する。
//     要約は (a) レスポンス changeSummary で UI に表示、(b) company_memories
//     (memory_type='summary', topic='規程の改定') に保存＝以降の相談の記憶に効く。
//     要約の失敗・rate-limit 超過は取込本体を巻き戻さない（changeSummary=null で続行）。
//     rate-limit は document_review の枠に相乗り（新kind追加なし・plan連動）。
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
  if (guard.error) return guard.error

  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 100) : ''
  if (!cleanTitle) {
    return NextResponse.json({ error: '規程名（title）を入力してください' }, { status: 400 })
  }
  if (typeof documentText !== 'string' || documentText.trim().length < 10) {
    return NextResponse.json({ error: '取り込む規程テキストを貼り付けてください' }, { status: 400 })
  }

  const content = documentText.trim().slice(0, MAX_CONTENT)
  const supabase = await createServerSupabaseClient()

  // --- D22: 旧版の取得（差分要約の材料）。upsert が旧本文を上書きする前に読む。---
  //   初回取込では旧版が無い＝この後の LLM 呼び出しは発火しない（コスト最小）。
  //   select 失敗はベストエフォート（差分要約なしで取込本体を続行）。
  const { data: prevDoc } = await supabase
    .from('company_documents')
    .select('content')
    .eq('company_id', companyId as string)
    .eq('title', cleanTitle)
    .maybeSingle()
  const prevContent = typeof prevDoc?.content === 'string' ? prevDoc.content : null

  // --- プラン上限（documentCap）の強制 ---------------------------------------
  //   2026-07-30 継続利用監査（B-5）: それまで無料/有料の差は日次の回数上限だけで、
  //   無料の chat 20回/日は総務1人の実利用では到達せず、アップグレード圧が構造的に
  //   発生しなかった。Kabauの価値は「自社の規程を覚えていること」なので、価値そのもの
  //   ＝取り込める規程の本数を上限にする。
  //
  //   ★既存規程の差替え（＝規程改定）は上限に関係なく必ず通す。改定を止めると
  //     「古い規程で答え続ける」という最悪の状態を製品側が強制することになる。
  //     制限するのは **新規の規程を増やすとき** だけ。
  const planDef = resolvePlan(guard.membership.plan)
  if (!prevDoc && planDef.documentCap !== null) {
    const { count: docCount } = await supabase
      .from('company_documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId as string)

    if ((docCount ?? 0) >= planDef.documentCap) {
      return NextResponse.json(
        {
          error:
            `${planDef.displayName}で取り込める規程は${planDef.documentCap}本までです。` +
            `新しい規程を追加するには、プランのアップグレードをご検討ください` +
            `（取込済みの規程の差し替え・改定は上限に関係なく行えます）。`,
          code: 'DOCUMENT_CAP_REACHED',
          plan: planDef.id,
          documentCap: planDef.documentCap,
          upgradeAvailable: upgradeAvailable(planDef.id),
        },
        { status: 403 },
      )
    }
  }

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

  // --- D22: 規程改定の差分要約（旧版が存在し、本文が実際に変わったときのみ）---
  //   要約の失敗は取込本体の成功を巻き戻さない（changeSummary=null で返す）。
  let changeSummary: string | null = null
  if (prevContent !== null && prevContent !== content) {
    changeSummary = await summarizeRegulationChange({
      supabase,
      companyId: companyId as string,
      userId: guard.user.id,
      plan: resolvePlan(guard.membership.plan).id,
      title: cleanTitle,
      oldText: prevContent,
      newText: content,
    })
  }

  return NextResponse.json({ document: doc, savedProfiles, failedProfiles, changeSummary })
}

// DELETE { companyId, id } — 取込済み規程の削除。adminのみ。
export async function DELETE(req: NextRequest) {
  const { companyId, id } = await req.json().catch(() => ({}))
  const guard = await requireAdmin(companyId)
  if (guard.error) return guard.error
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
  // requireAdmin が検証済みの user を返すため再取得しない。
  await logCompanyAudit({
    companyId,
    actorUserId: guard.user.id,
    action: 'document.delete',
    targetType: 'company_document',
    targetId: id,
  })
  return NextResponse.json({ ok: true })
}

// ----------------------------------------------------------------------------
// D22: 規程改定の差分要約
//   旧版・新版の本文から行単位の差分（追加行/削除行）をローカルで抽出し、
//   **差分行だけ**を MEMORY_MODEL(haiku) に渡して敬体・プレーンテキストの要約を作る。
//   全文2本を LLM に投げない＝規程は最大10万字あるためコストを差分量に比例させる。
//   生成した要約は company_memories(memory_type='summary', topic='規程の改定') に
//   保存し、以降のチャットの記憶注入（loadCompanyContext）で参照可能にする。
//   失敗時（rate-limit超過・API失敗・差分ゼロ）は null を返し、取込本体は成功のまま。
// ----------------------------------------------------------------------------

// LLM に渡す差分の上限（片側）。就業規則の通常改定は数条文＝十分収まる。
const MAX_DIFF_CHARS = 6000

function diffLines(oldText: string, newText: string): { added: string[]; removed: string[] } {
  const toLines = (t: string) =>
    t.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const oldLines = toLines(oldText)
  const newLines = toLines(newText)
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  // 集合差分（順序保持）。条文の移動は追加+削除の両方に出るが、要約用途では
  // 「その条文に触れた変更がある」ことが伝われば十分＝LCSまでは持ち込まない。
  return {
    added: newLines.filter(l => !oldSet.has(l)),
    removed: oldLines.filter(l => !newSet.has(l)),
  }
}

function capJoin(lines: string[], cap: number): string {
  let out = ''
  for (const l of lines) {
    if (out.length + l.length + 1 > cap) {
      out += '\n（以下省略）'
      break
    }
    out += (out ? '\n' : '') + l
  }
  return out
}

async function summarizeRegulationChange(args: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  companyId: string
  userId: string
  plan: ReturnType<typeof resolvePlan>['id']
  title: string
  oldText: string
  newText: string
}): Promise<string | null> {
  const { supabase, companyId, userId, plan, title, oldText, newText } = args

  const { added, removed } = diffLines(oldText, newText)
  // 実質差分なし（空白・改行の整形のみ）は LLM を呼ばない。
  if (added.length === 0 && removed.length === 0) return null

  // rate-limit: document_review の枠に相乗り（規程処理系として同じ費目・plan連動）。
  // 超過しても取込本体は成功済み＝要約だけ静かに省略する（429で取込を壊さない）。
  if (!(await checkAndIncrement(userId, 'document_review', plan))) {
    console.warn('[company:document:ingest] change summary skipped (rate limited)')
    return null
  }

  const prompt = `会社の規程「${title}」が改定されました。以下は改定前後の本文を行単位で比較した差分です。

【削除された行（旧版にのみあった記述）】
${capJoin(removed, MAX_DIFF_CHARS) || '（なし）'}

【追加された行（新版で加わった記述）】
${capJoin(added, MAX_DIFF_CHARS) || '（なし）'}

この差分から「何が変わったか」を、従業員に伝わる敬体の日本語で2〜5文に要約してください。
守ること:
- 差分から読み取れる変更のみを述べる。推測・評価・助言は書かない。
- Markdown記法（見出し・箇条書き記号・強調記号）は使わず、プレーンテキストの文章のみで書く。
- 数値（時間・日数・金額など）の変更は旧値と新値を明記する。
要約本文のみを出力してください。`

  try {
    const res = await anthropic.messages.create({
      model: MEMORY_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    // text ブロック抽出は lib/memory.ts callExtraction と同じ流儀。
    const raw = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const text = raw
      // 指示違反の保険: 強調・見出し・箇条書き記号を軽く除去（公開面のMarkdown禁止と同じ流儀）。
      .replace(/\*\*|__/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/^[-*・]\s+/gm, '')
      .trim()
    if (!text) return null

    const summary = text.slice(0, 1000)

    // 会社の記憶へ保存（ベストエフォート・失敗しても要約表示は生かす）。
    // anon(=ユーザーJWT)クライアント＝RLSが最終防衛線（member insert 可・adminは当然可）。
    const { error } = await supabase.from('company_memories').insert({
      company_id: companyId,
      summary: `規程「${title}」の改定：${summary}`.slice(0, 1000),
      memory_type: 'summary',
      topic: '規程の改定',
    })
    if (error) {
      console.error('[company:document:ingest] change summary memory insert failed', error.message)
    }
    return summary
  } catch (e) {
    console.error('[company:document:ingest] change summary generation failed', (e as Error).message)
    return null
  }
}

// 共通: ログイン + admin 所属を要求（profile route と同じ流儀）。
//   D22: 差分要約の rate-limit（user.id）と plan 解決（membership.plan）に使うため、
//   検証済みの user / membership も返す（呼び出し側の再取得を不要にする）。
type AdminGuard =
  | { error: NextResponse; user?: undefined; membership?: undefined }
  | { error: null; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; membership: NonNullable<Awaited<ReturnType<typeof getMembership>>> }

async function requireAdmin(companyId: unknown): Promise<AdminGuard> {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!companyId || typeof companyId !== 'string') {
    return { error: NextResponse.json({ error: 'companyId required' }, { status: 400 }) }
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return { error: NextResponse.json({ error: '管理者のみ取込できます' }, { status: 403 }) }
  }
  return { error: null, user, membership }
}
