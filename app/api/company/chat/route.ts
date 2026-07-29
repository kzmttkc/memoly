import { NextRequest, NextResponse } from 'next/server'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { buildCompanySystemPrompt } from '@/lib/prompts'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  getCurrentUser,
  getMembership,
  resolveDefaultCompany,
  loadCompanyContext,
  loadRelevantRuleExcerpts,
} from '@/lib/company'
import { maybeAskDifyForQuery } from '@/lib/dify'
import { checkAndIncrement } from '@/lib/rate-limit'
import { resolvePlan, rateLimitBody } from '@/lib/plans'
import { detectDecisionConflicts } from '@/lib/decision-conflict'
import { embeddingEnabled } from '@/lib/embedding'
import { buildRecalledMemory, serializeRecalledMemory } from '@/lib/recall'

// ============================================================================
// /api/company/chat — 会社スコープのチャット
//   個人版 /api/chat は変更せず、会社版を別ルートとして追加する。
//
//   フロー:
//     1. ログイン確認 → company_id 確定（body.companyId 指定があれば所属検証、
//        無ければ resolveDefaultCompany。未所属は「会社作成へ」エラー）
//     2. company_profiles（自社ルール）+ 直近 company_memories を system に注入
//     3. 質問に法令キーワードがあれば Dify で固い一次情報を引き system に同梱
//     4. sonnet でストリーミング応答
//     5. 会話/メッセージを company_conversations / company_messages に
//        RLS 下の anon(=ユーザーJWT) で保存（テナント分離を尊重）
//
//   返却: text/plain ストリーム。会話IDは X-Conversation-Id ヘッダで返す。
// ============================================================================

const MAX_MEMORIES = 10

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, companyId: bodyCompanyId, conversationId } = body as {
    messages?: { role: string; content: string }[]
    companyId?: string
    conversationId?: string
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // --- company_id 確定（plan を解決してから plan 連動の上限ガードを掛けるため先に行う）---
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
      // 未所属 → 会社作成へ誘導（フロントが /api/company POST に飛ばす）
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

  // --- 日次利用上限ガード（plan連動・高コストsonnet呼び出し前）。超過は429。DB未適用時はfail-open ---
  if (!(await checkAndIncrement(user.id, 'chat', plan))) {
    return NextResponse.json(rateLimitBody(plan), { status: 429 })
  }

  // 入力のサニタイズ（長さ制限）
  const sanitizedMessages = messages.slice(-50).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: String(m.content).slice(0, 4000),
  }))
  const lastUserMessage =
    sanitizedMessages.findLast(m => m.role === 'user')?.content ?? ''

  // --- 会社コンテキスト + 規程原文の関連抜粋 + Dify 一次情報 を並列取得 ---
  //   loadCompanyContext に lastUserMessage を渡し、今回の相談に関連する記憶を
  //   recency+キーワードで優先選択する（縦深: 過去の自社判断・人ごとの状況を含む）。
  //   loadRelevantRuleExcerpts は F1 規程まるごと取込: 取込済み規程（就業規則等）から
  //   関連条文の原文抜粋を引く（未取込/テーブル未適用なら空＝既存挙動と同一）。
  const [ctx, ruleExcerpts, difyContext] = await Promise.all([
    loadCompanyContext(companyId, MAX_MEMORIES, lastUserMessage),
    loadRelevantRuleExcerpts(companyId, lastUserMessage),
    maybeAskDifyForQuery(lastUserMessage, companyId),
  ])

  // 過去判断 × 最新法令の確認対象を決定的に検知（LLM不要）。今回の相談に関連トピックが
  //   出たとき、番頭が「過去判断が最新改正より古い可能性」を断定せず指摘できるよう注入する。
  const decisionConflicts = detectDecisionConflicts(ctx.decisions).map(c => ({
    topicLabel: c.topicLabel,
    decisionSummary: c.decisionSummary,
    decidedAt: c.decidedAt,
    factLabel: c.fact.label,
    factEffectiveDate: c.fact.effectiveDate,
  }))

  const system = buildCompanySystemPrompt(
    companyName,
    ctx.profiles,
    ctx.memories,
    difyContext,
    lastUserMessage,
    ctx.decisions,
    ctx.peopleSituations,
    decisionConflicts,
    ruleExcerpts,
  )

  // 記憶想起の可視化（革新性の体感化）: この相談で system に注入した「自社の記憶」を
  //   非PIIのラベル要約にして、レスポンスヘッダ X-Recalled-Memory で先に返す。
  //   ヘッダはストリーム本文より前にクライアントへ届くため、回答が流れ始めるのと同時に
  //   「この相談で参照した自社の記憶」を提示できる（逐次可視化）。セマンティックが
  //   未有効でも、キーワード＋recency で想起した分をそのまま可視化する。
  const recalledHeader = serializeRecalledMemory(
    buildRecalledMemory(ctx, ruleExcerpts, embeddingEnabled() && Boolean(lastUserMessage)),
  )

  const supabase = await createServerSupabaseClient()

  // --- 会話レコードを用意（指定が無ければ新規作成）。RLS下のanonで書く。 ---
  let validConvId: string | null = null
  if (conversationId) {
    // 指定された会話が自社のものか軽く検証（他社会話への混入防止）
    const { data: conv } = await supabase
      .from('company_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (conv) validConvId = conv.id
  }
  if (!validConvId) {
    const title = lastUserMessage.slice(0, 30) || '新しい相談'
    const { data: created, error: convErr } = await supabase
      .from('company_conversations')
      .insert({ company_id: companyId, user_id: user.id, title })
      .select('id')
      .single()
    if (convErr || !created) {
      console.error('[company:chat] conversation insert failed', convErr)
      return NextResponse.json({ error: '会話の作成に失敗しました' }, { status: 500 })
    }
    validConvId = created.id
  }
  // ここで validConvId は必ず確定（上の分岐で必ず代入される）。以降は非nullで扱う。
  if (!validConvId) {
    return NextResponse.json({ error: '会話の作成に失敗しました' }, { status: 500 })
  }
  const conversationIdFinal: string = validConvId

  // ユーザーメッセージを保存
  await supabase.from('company_messages').insert({
    conversation_id: conversationIdFinal,
    role: 'user',
    content: lastUserMessage,
  })

  // --- prompt caching（粗利改善）---
  //   system には会社コンテキスト（自社ルール/過去判断/関係者状況/確定ファクト/法令一次情報）を
  //   毎ターン丸ごと注入している。これは同一会話の往復で（ほぼ）不変の大きな前置きなので、
  //   Anthropic prompt caching の cache_control を system 末尾ブロックに付け、2ターン目以降の
  //   入力トークン課金を圧縮する（キャッシュヒット時は入力単価が大幅減）。
  //   注意点と安全策:
  //     - system を string→単一 text ブロック配列に変える（messages 本体は不変）。
  //     - cache の最小トークン要件に満たない短い system はヒットせず「素通り」になるだけで
  //       挙動は変わらない（キャッシュは課金最適化であって正しさには影響しない）。
  //     - userQuery 連動で system は会話ごとに変わるが、同一会話内の連続ターンでは安定し、
  //       直近プレフィクスのヒットで効く。完全一致でなくても前方一致分は再利用される。
  // 2026-07-30 可用性監査: この呼び出しは try の外にあり、接続時の 429/529/ネットワーク断が
  //   ハンドラを貫通して素の 500 になっていた（下の try はストリーム消費側だけを守っている）。
  //   ユーザーの発言は既に保存済みなので、画面上は「質問だけ飲み込まれた」状態になる。
  //   製品で最も叩かれるルートなので、接続段でも必ず日本語で理由が返るようにする。
  let stream: ReturnType<typeof anthropic.messages.stream>
  try {
    stream = anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: sanitizedMessages,
    })
  } catch (e) {
    console.error('[company:chat] anthropic stream の開始に失敗', e)
    return NextResponse.json(
      {
        error:
          'AIの応答を開始できませんでした。時間をおいてもう一度お試しください。' +
          '続く場合は support@banto-roumu.com までご連絡ください。',
        code: 'AI_UNAVAILABLE',
      },
      { status: 503 },
    )
  }

  const readable = new ReadableStream({
    async start(controller) {
      let full = ''
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } catch {
        controller.enqueue(new TextEncoder().encode('\n\n[エラーが発生しました。もう一度お試しください]'))
      } finally {
        // assistant 応答を保存（ベストエフォート・失敗してもストリームは閉じる）
        if (full) {
          await supabase
            .from('company_messages')
            .insert({ conversation_id: conversationIdFinal, role: 'assistant', content: full })
            .then(({ error }) => {
              if (error) console.error('[company:chat] assistant message insert failed', error)
            })
          await supabase
            .from('company_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationIdFinal)
        }
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Conversation-Id': conversationIdFinal,
      // 想起サマリ（非PII・URLエンコード済JSON）。空想起のときはヘッダを付けない。
      ...(recalledHeader ? { 'X-Recalled-Memory': recalledHeader } : {}),
    },
  })
}
