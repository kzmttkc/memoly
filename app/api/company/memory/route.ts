import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentUser, getMembership, resolveDefaultCompany } from '@/lib/company'
import { extractCompanyFacts, extractCompanyMemory } from '@/lib/memory'

// ============================================================================
// /api/company/memory — 会社事実の抽出と admin 承認制の保存
//
//   POST:
//     会話から自社の労務事実を haiku で抽出し、company_memories(memory_type='rule')
//     に「承認待ち候補」として保存する。
//     ★ 自動で company_profiles へは昇格させない（admin承認制）。
//        承認は別経路（POST?action=approve）で admin が明示的に行う。
//     会話の要約(summary)も company_memories(memory_type='summary') に保存し、
//       次回チャットの記憶として効くようにする。
//
//   POST ?action=approve { companyId, key, value }:
//     admin のみ。抽出された rule 候補を company_profiles に正式昇格させる。
//
//   GET ?companyId=...&type=rule|summary:
//     会社の記憶一覧（承認待ち候補の確認用）。メンバー可。
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const action = req.nextUrl.searchParams.get('action')
  if (action === 'approve') return approveFact(req)
  if (action === 'decision') return captureDecision(req)

  const body = await req.json().catch(() => ({}))
  const { messages, companyId: bodyCompanyId } = body as {
    messages?: { role: string; content: string }[]
    companyId?: string
  }
  if (!messages?.length) return NextResponse.json({ ok: true })

  // 入力サイズ制限
  if (JSON.stringify(body).length > 50_000) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  // company_id 確定（指定があれば所属検証、無ければデフォルト会社）
  let companyId: string
  if (bodyCompanyId) {
    const m = await getMembership(bodyCompanyId)
    if (!m) return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
    companyId = m.companyId
  } else {
    const def = await resolveDefaultCompany()
    if (!def) return NextResponse.json({ error: 'NO_COMPANY' }, { status: 409 })
    companyId = def.companyId
  }

  // 2系統を並列抽出:
  //   (1) rule候補 = 自社の確定事実（admin承認制で company_profiles へ昇格）。従来どおり。
  //   (2) 記憶の縦深 = この相談の summary / topic / subject / 過去の自社判断(decision)。
  //       loadCompanyContext が「人ごと・判断ごと」に構造化注入するための土台。
  const [extraction, depth] = await Promise.all([
    extractCompanyFacts(messages),
    extractCompanyMemory(messages),
  ])
  const supabase = await createServerSupabaseClient()

  // (1) 抽出した自社事実を rule 候補として保存（承認待ち・company_profilesには昇格しない）
  let savedRules = 0
  for (const fact of extraction.facts) {
    const { error } = await supabase.from('company_memories').insert({
      company_id: companyId,
      summary: `${fact.key}：${fact.value}`,
      memory_type: 'rule',
    })
    if (!error) savedRules++
    else console.error('[company:memory] rule insert failed', error)
  }

  // (2) 縦深の保存。判断が下されていれば memory_type='decision'（過去の自社判断）として、
  //     そうでなければ memory_type='summary'（相談の記憶）として、topic/subject 付きで残す。
  //     抽出が degrade して summary も空なら何も保存しない（ノイズ行を作らない）。
  let savedSummary = 0
  let savedDecision = 0
  if (depth.summary || depth.decisionText) {
    if (depth.isDecision && depth.decisionText) {
      const { error } = await supabase.from('company_memories').insert({
        company_id: companyId,
        summary: depth.decisionText,
        memory_type: 'decision',
        topic: depth.topic || null,
        subject: depth.subject || null,
        decided_at: new Date().toISOString(),
      })
      if (!error) savedDecision++
      else console.error('[company:memory] decision insert failed', error)
    }
    // 判断の有無に関わらず、相談の流れ自体は summary として残す（subject別の状況追跡に効く）。
    if (depth.summary) {
      const { error } = await supabase.from('company_memories').insert({
        company_id: companyId,
        summary: depth.summary,
        memory_type: 'summary',
        topic: depth.topic || null,
        subject: depth.subject || null,
      })
      if (!error) savedSummary++
      else console.error('[company:memory] summary insert failed', error)
    }
  }

  return NextResponse.json({
    ok: true,
    extracted: extraction.facts,
    savedRuleCandidates: savedRules,
    savedSummary,
    savedDecision,
    degraded: extraction.degraded ?? depth.degraded ?? null,
    note: 'rule候補はadmin承認制。company_profilesへの昇格は /api/company/memory?action=approve で行う。',
  })
}

// ----------------------------------------------------------------------------
// POST ?action=decision — イベント起点の「判断採取」フック（TOP5 #1・蓄積速度の核）
//   チャットUIで番頭が「この方針で記録しておきますか？」と促し、ユーザーが確定
//   （ワンタップ）したときだけ呼ばれる human-in-the-loop の保存導線。
//   ★自動保存しない（誤記憶防止）。ユーザーの明示確定が前提。
//   サーバ側は既存 extractCompanyMemory の1パスを再利用し、isDecision/decisionText を
//   優先して memory_type='decision' で構造化保存する（topic/subject/decided_at 付き）。
//   member でも保存可（RLS company_memories_member_insert＝相談の積み上げと同格）。
//
//   body: { companyId?, messages: {role,content}[], decisionText? }
//     - decisionText を明示で渡せばそれを判断文として使う（ユーザーが微修正した文）。
//     - 無ければ抽出結果の decisionText、それも無ければ summary を判断文に倒す。
// ----------------------------------------------------------------------------
async function captureDecision(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}))
  const { messages, companyId: bodyCompanyId, decisionText: overrideText } = body as {
    messages?: { role: string; content: string }[]
    companyId?: string
    decisionText?: string
  }
  if (!messages?.length) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }
  if (JSON.stringify(body).length > 50_000) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  // company_id 確定（指定があれば所属検証、無ければデフォルト会社）。POST 本体と同じ流儀。
  let companyId: string
  if (bodyCompanyId) {
    const m = await getMembership(bodyCompanyId)
    if (!m) return NextResponse.json({ error: 'この会社に所属していません' }, { status: 403 })
    companyId = m.companyId
  } else {
    const def = await resolveDefaultCompany()
    if (!def) return NextResponse.json({ error: 'NO_COMPANY' }, { status: 409 })
    companyId = def.companyId
  }

  // 既存の1パス抽出を再利用（LLMを増やさない）。topic/subject を拾うのが目的。
  const depth = await extractCompanyMemory(messages)

  // 判断文の決定: ユーザー微修正 > 抽出 decisionText > 抽出 summary。
  const trimmed = (s: string | undefined) => (typeof s === 'string' ? s.trim().slice(0, 1000) : '')
  const decisionText = trimmed(overrideText) || trimmed(depth.decisionText) || trimmed(depth.summary)
  if (!decisionText) {
    return NextResponse.json(
      { error: '記録できる判断内容が見つかりませんでした。' },
      { status: 422 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('company_memories').insert({
    company_id: companyId,
    summary: decisionText,
    memory_type: 'decision',
    topic: depth.topic || null,
    subject: depth.subject || null,
    decided_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[company:memory] decision capture insert failed', error)
    return NextResponse.json({ error: '記録に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    saved: 1,
    decision: {
      summary: decisionText,
      topic: depth.topic || null,
      subject: depth.subject || null,
    },
    degraded: depth.degraded ?? null,
  })
}

// admin のみ: rule 候補を company_profiles に正式昇格させる。
async function approveFact(req: NextRequest): Promise<NextResponse> {
  const { companyId, key, value, memoryId } = await req.json().catch(() => ({}))
  if (!companyId || typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }
  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみ承認できます' }, { status: 403 })
  }
  if (!key || typeof value !== 'string') {
    return NextResponse.json({ error: 'key と value が必要です' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // company_profiles へ upsert（昇格）
  const { data: profile, error } = await supabase
    .from('company_profiles')
    .upsert(
      { company_id: companyId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,key' },
    )
    .select('id, key, value')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 承認済みの rule 候補は片付ける（任意・memoryId指定時のみ）
  if (memoryId && typeof memoryId === 'string') {
    await supabase
      .from('company_memories')
      .delete()
      .eq('id', memoryId)
      .eq('company_id', companyId)
      .eq('memory_type', 'rule')
  }

  return NextResponse.json({ ok: true, profile })
}

// 会社の記憶一覧（承認待ち rule 候補 / summary）。メンバー可。
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  const membership = await getMembership(companyId)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type') // 'rule' | 'summary' | 'decision' | null(=all)
  const supabase = await createServerSupabaseClient()
  let q = supabase
    .from('company_memories')
    .select('id, summary, memory_type, topic, subject, decided_at, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (type === 'rule' || type === 'summary' || type === 'decision') q = q.eq('memory_type', type)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memories: data ?? [] })
}
