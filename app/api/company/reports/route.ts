import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import {
  buildReportSystemPrompt,
  REPORT_DISCLAIMER,
  buildSharoushiMemoSystemPrompt,
  SHAROUSHI_MEMO_DISCLAIMER,
} from '@/lib/prompts'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
  loadCompanyAttributes,
} from '@/lib/company'
import { buildReportBody, buildSharoushiMemoBody } from '@/lib/report'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan } from '@/lib/plans'

// ============================================================================
// /api/company/reports — F6「経営者向け1枚報告」/ F5「社労士連携メモ」生成
// ----------------------------------------------------------------------------
//   番頭が覚えている会社データ（属性・自社ルール・規程・期限・過去の判断）を、
//   mode に応じて2通りの整理にして返す:
//     - mode='owner'（既定・F6）    ＝経営者本人が1枚で把握できる要約。
//     - mode='sharoushi'（F5）      ＝会社が相談する社労士（プロ）に渡す下準備メモ。
//   どちらも「事実はコード側で決定的に組み立て、LLM は前書き/むすびの短文のみ」の
//   同一硬化パターンを共有する（同じ5ソース・同じ認可・fail-safe・rate-limit）。
//
//   設計の要（ハルシネーション防止）:
//     1. 事実（数値・期限・規程名・件数）は lib/report.ts が「コード側で」組み立てる。
//     2. LLM（sonnet）は前書き/むすびを足して体裁を整える役に限定する。
//        LLM 呼び出しに失敗しても、決定的に組んだ body をそのまま返す（fail-open）。
//
//   権限（deadlines/documents と同じ考え方）:
//     生成(POST): メンバー全員可（自社データの整理＝全席の価値）。
//     全読取り anon(=ユーザーJWT) クライアントで実行し RLS を最終防衛線にする。
//
//   fail-safe: 期限/規程テーブル未適用・データ空でも壊れない（空欄は「未登録」表示）。
//
//   Phase1コンプラ: 「社労士監修」「AI社労士」「法的精度」不使用・断定/命令/診断をしない・
//     期日はユーザー確定分のみ・免責(REPORT_DISCLAIMER)を必ず末尾に付す。
//   rate-limit は書類生成と同コスト帯のため既存 'document_generate' バケットを再利用する
//     （PlanFeatureLimits を広げず既存の上限に相乗り）。
// ============================================================================

/** JST の当日を YYYY-MM-DD で返す（期限の残日数計算の基準日）。 */
function todayJst(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 3600 * 1000)
  return jst.toISOString().slice(0, 10)
}

/**
 * LLM が返す前書き/むすび（短文・事実を含まない前提）を安全化する。
 *   文字列以外は空に落とし、強調記号(* # `)を除去、空白を畳み、長さを上限で切る。
 *   事実(数値・期限・規程名)は body 側にしか無く、この短文には載らない設計。
 */
function sanitizeAside(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[*#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { companyId: bodyCompanyId, mode: bodyMode } = body as {
    companyId?: string
    mode?: string
  }
  // mode は 'owner'（F6・既定）か 'sharoushi'（F5）。未知の値は既定の owner に落とす。
  const mode: 'owner' | 'sharoushi' = bodyMode === 'sharoushi' ? 'sharoushi' : 'owner'

  // --- company_id 確定（generate ルートと同じパターン） ---
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

  // --- 日次利用上限ガード（書類生成と同バケット・fail-open）---
  if (!(await checkAndIncrement(user.id, 'document_generate', plan))) {
    return NextResponse.json(
      { error: '本日の利用上限に達しました。利用回数は日本時間の午前9時にリセットされます。' },
      { status: 429 },
    )
  }

  const today = todayJst()

  // --- 事実ソースを並列取得（いずれも fail-safe: 失敗/未適用でも空で続行） ---
  const supabase = await createServerSupabaseClient()
  const [context, attrs, docsRes, dlRes] = await Promise.all([
    loadCompanyContext(companyId),
    loadCompanyAttributes(companyId),
    // 規程一覧（軽量メタのみ・原文は取らない）。未適用でも壊さない。
    supabase
      .from('company_documents')
      .select('title, doc_type, updated_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false }),
    // 近い期限（今日以降・有効・昇順）。未適用でも壊さない。
    supabase
      .from('company_deadlines')
      .select('title, due_on, note')
      .eq('company_id', companyId)
      .eq('active', true)
      .gte('due_on', today)
      .order('due_on', { ascending: true })
      .limit(6),
  ])

  if (docsRes.error) {
    console.error('[company:reports] documents select failed (non-fatal)', docsRes.error.message)
  }
  if (dlRes.error) {
    console.error('[company:reports] deadlines select failed (non-fatal)', dlRes.error.message)
  }

  const documents = (docsRes.error ? [] : docsRes.data ?? []).map(d => ({
    title: (d.title as string) ?? '',
    docType: (d.doc_type as string | null) ?? null,
    updatedAt: (d.updated_at as string) ?? '',
  }))
  const deadlines = (dlRes.error ? [] : dlRes.data ?? []).map(d => ({
    title: (d.title as string) ?? '',
    dueOn: (d.due_on as string) ?? '',
    note: (d.note as string | null) ?? null,
  }))

  // --- 事実の骨格をコードで確定（LLM 非依存＝創作の余地なし） ---
  //     mode により F6（経営者まとめ）か F5（社労士メモ）の決定的アセンブラを選ぶ。
  //     どちらも同じ5ソースを渡し、事実はこのコード層だけで確定する。
  const reportBody =
    mode === 'sharoushi'
      ? buildSharoushiMemoBody({ companyName, attrs, context, documents, deadlines, today })
      : buildReportBody({ companyName, attrs, context, documents, deadlines, today })

  const systemPrompt =
    mode === 'sharoushi'
      ? buildSharoushiMemoSystemPrompt(companyName)
      : buildReportSystemPrompt(companyName)
  const disclaimer = mode === 'sharoushi' ? SHAROUSHI_MEMO_DISCLAIMER : REPORT_DISCLAIMER

  // --- 体裁整形: LLM には前書き/むすびの短文(JSON)だけを返させる。
  //     事実(reportBody)は LLM を一切通さず、ここでコード側が
  //     `前書き＋body＋むすび` を連結する＝LLM が本文の事実を書き換える経路が構造的に無い。
  let intro = ''
  let outro = ''
  try {
    const resp = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `次の「本文」に添える前書きとむすびを JSON で返してください。本文は書き写さないでください。\n\n${reportBody}`,
        },
      ],
    })
    const raw = resp.content.find(b => b.type === 'text')?.text ?? ''
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0]) as { intro?: unknown; outro?: unknown }
      intro = sanitizeAside(parsed.intro)
      outro = sanitizeAside(parsed.outro)
    }
  } catch (e) {
    console.error('[company:reports] polish failed (fallback to deterministic)', (e as Error).message)
  }

  const source: 'sonnet' | 'deterministic' = intro || outro ? 'sonnet' : 'deterministic'
  // 事実は必ずコード側の reportBody を使う（前書き/むすびは事実を含まない短文のみ）。
  const text = [intro, reportBody, outro].filter(Boolean).join('\n\n')

  // Phase1 免責を必ず末尾に付す（mode に応じた免責文）。
  const finalText = `${text}\n\n---\n${disclaimer}`

  return NextResponse.json({ text: finalText, source, mode, generatedAt: today })
}
