import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { anthropic, CHAT_MODEL } from '@/lib/claude'
import { KASUHARA_MEASURES, normalizeVerdicts } from '@/lib/kasuhara/measures'
import { retryAfterSeconds, retainHits, ZURE_RL_MAX } from '@/lib/zure-rate-limit'

// ============================================================================
// /api/zure/kasuhara-gap (POST) — 就業規則本文 × カスハラ10措置の照合（登録不要）
// ----------------------------------------------------------------------------
// Kabau×番頭 1本化 Phase 2（V2 §3）。/zure の1枚の下段に出す「10措置 ○△×表」の裏側。
//
// プライバシー（/zure の約束「残す操作の前にサーバへ保存しない」に従属）:
//   受け取った本文は判定にだけ使い、**保存しない**。保存するのは10措置の判定
//   （○△×・条番号の参照・短い所見）だけ（supabase/kasuhara_assessments.sql 冒頭コメント）。
//
// 判定の性質（誤報是正ゲートの水準）:
//   出力は「該当する定めが規則の中に見つかったか」であって、適法性の判定ではない。
//   ×は「違法」ではなく「該当条文が見つからない」。この語り口を崩す文言をLLMに
//   書かせないため、note は短い事実描写に限定するようプロンプトで固定する。
//
// レート制限: /api/zure/extract と同じ窓（1時間・同一IP）。LLM 1呼び出し/リクエスト。
// ============================================================================

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_CHARS = 60_000
const rlHits = new Map<string, number[]>()

function takeRateLimit(ip: string): number | null {
  const now = Date.now()
  const arr = retainHits(rlHits.get(ip) ?? [], now)
  const wait = retryAfterSeconds(arr, now)
  if (wait !== null) {
    rlHits.set(ip, arr)
    return wait
  }
  arr.push(now)
  rlHits.set(ip, arr)
  if (rlHits.size > 5_000) {
    for (const [k, v] of rlHits) {
      if (retainHits(v, now).length === 0) rlHits.delete(k)
    }
  }
  return null
}

const GAP_TOOL = {
  name: 'report_gap',
  description: '就業規則・社内規程の本文をカスハラ10措置と照合した結果を報告する',
  input_schema: {
    type: 'object' as const,
    properties: {
      measures: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            n: { type: 'integer' as const, minimum: 1, maximum: 10 },
            verdict: { type: 'string' as const, enum: ['ok', 'weak', 'missing'] },
            evidence: { type: 'string' as const, description: '根拠となる条番号や見出し（例:「第23条」）。missing のときは空文字' },
            note: { type: 'string' as const, description: '判定の短い理由（60字以内・事実描写のみ）' },
          },
          required: ['n', 'verdict', 'evidence', 'note'],
        },
      },
    },
    required: ['measures'],
  },
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const wait = takeRateLimit(ip)
  if (wait !== null) {
    const minutes = Math.max(1, Math.ceil(wait / 60))
    return NextResponse.json(
      { error: `同じ回線から、1時間に${ZURE_RL_MAX}回までです。あと約${minutes}分してからお試しください。` },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    )
  }

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length < 50) {
    return NextResponse.json({ error: '照合できる本文がありません。先にファイルを置くか本文を貼ってください。' }, { status: 400 })
  }

  const clipped = text.slice(0, MAX_CHARS)
  const measureList = KASUHARA_MEASURES
    .map(m => `${m.n}. ${m.title} — 基準: ${m.criteria}`)
    .join('\n')

  let verdicts: ReturnType<typeof normalizeVerdicts> = null
  try {
    const res = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1500,
      tools: [GAP_TOOL],
      tool_choice: { type: 'tool', name: 'report_gap' },
      system: [
        'あなたは就業規則・社内規程の本文を、カスタマーハラスメント対策の10措置と照合する検査器です。',
        '各措置について、本文に該当する定めが「ある(ok)」「あるが基準の内容を満たさない・部分的(weak)」「見つからない(missing)」を判定します。',
        '規則は法律用語で書かれているとは限りません。趣旨が同じ定めは該当とみなします（例:「迷惑行為」「クレーム対応」等の表現）。',
        'evidence には根拠の条番号か見出しを本文の表記のまま書きます。missing は空文字。',
        'note は60字以内の事実描写に限定します。「違法」「義務違反」などの適法性判断は書きません。',
        'セクハラ・パワハラのみを対象とした条文は、顧客等（第三者）からの行為を対象としていなければカスハラ措置の根拠にしません。',
      ].join('\n'),
      messages: [{ role: 'user', content: `10措置と判定基準:\n${measureList}\n\n就業規則・社内規程の本文:\n${clipped}` }],
    })
    const toolUse = res.content.find(c => c.type === 'tool_use')
    verdicts = normalizeVerdicts(toolUse && toolUse.type === 'tool_use' ? toolUse.input : null)
  } catch (e) {
    console.error('[kasuhara-gap] LLM呼び出し失敗', { msg: (e as Error).message })
  }
  if (!verdicts) {
    return NextResponse.json({ error: '照合を完了できませんでした。時間をおいてもう一度お試しください。' }, { status: 502 })
  }

  // KPI用の記録（本文は保存しない・判定のみ）。失敗しても診断結果は返す（ベストエフォート）。
  let assessmentId: string | null = null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && service) {
      const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data } = await admin
        .from('kasuhara_assessments')
        .insert({ measures: verdicts })
        .select('id')
        .single()
      assessmentId = data?.id ?? null
    }
  } catch (e) {
    console.error('[kasuhara-gap] 記録に失敗（診断結果は返す）', { msg: (e as Error).message })
  }

  return NextResponse.json({
    assessmentId,
    measures: verdicts.map(v => {
      const def = KASUHARA_MEASURES.find(m => m.n === v.n)
      return { ...v, title: def?.title ?? '', guideHref: def?.guideHref ?? '' }
    }),
  })
}
