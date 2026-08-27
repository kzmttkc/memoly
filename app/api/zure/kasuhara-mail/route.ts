import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { KASUHARA_MEASURES, normalizeVerdicts } from '@/lib/kasuhara/measures'
import { buildPolicyDraft } from '@/lib/kasuhara/policy'

// ============================================================================
// /api/zure/kasuhara-mail (POST) — 10措置診断の控えを本人へ送り、段2（名前）を預かる
// ----------------------------------------------------------------------------
// Kabau×番頭 1本化 Phase 2（V2 §3-4）。gtm-doctrine §2 の作法:
//   - 結果は画面に出し切っている（後送を約束しない）。ここで送るのは**同じ内容の控え**。
//   - 受け取るのはメールアドレス1つ。会社名は差し込みにだけ使い、保存しない。
//   - 本文はプレーンテキスト。件名・見出しはサーバ側で固定（中継悪用を作らない）。
// 記録: company_leads(source='kasuhara_gap') と assessment への lead_email 紐付け。
// メール送信は DIGEST_FROM_EMAIL 未設定なら送らない（黙ってサンドボックスへ落とさない・
// その場合も画面に全文が出ているため約束は破れない。クライアントには sent の真偽を返す）。
// ============================================================================

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  return false
}

function verdictMark(v: string): string {
  return v === 'ok' ? '○' : v === 'weak' ? '△' : '×'
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'しばらく時間をおいて再度お試しください。' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const assessmentId = typeof body?.assessmentId === 'string' ? body.assessmentId : ''
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim().slice(0, 60) : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'メールアドレスの形式をご確認ください。' }, { status: 400 })
  }
  if (!assessmentId) {
    return NextResponse.json({ error: '診断結果が見つかりません。もう一度照合してください。' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) {
    return NextResponse.json({ error: '一時的に受け付けできません。' }, { status: 500 })
  }
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: assessment } = await admin
    .from('kasuhara_assessments')
    .select('id, measures')
    .eq('id', assessmentId)
    .maybeSingle()
  if (!assessment) {
    return NextResponse.json({ error: '診断結果が見つかりません。もう一度照合してください。' }, { status: 404 })
  }
  const verdicts = normalizeVerdicts({ measures: assessment.measures })
  if (!verdicts) {
    return NextResponse.json({ error: '診断結果を読み出せませんでした。' }, { status: 500 })
  }

  // 段2: company_leads へ（既存の受け口と同じ形・meta は薄い非個人情報のみ）
  await admin.from('company_leads').insert({
    email,
    source: 'kasuhara_gap',
    meta: { assessment: assessmentId },
  })
  await admin
    .from('kasuhara_assessments')
    .update({ lead_email: email, policy_generated_at: new Date().toISOString() })
    .eq('id', assessmentId)

  // 控えメール（プレーンテキスト・画面に出ている内容と同一）
  let sent = false
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.DIGEST_FROM_EMAIL
  if (RESEND_API_KEY && FROM) {
    const table = verdicts
      .map(v => {
        const def = KASUHARA_MEASURES.find(m => m.n === v.n)
        const ev = v.evidence ? `（根拠: ${v.evidence}）` : ''
        return `${verdictMark(v.verdict)} 措置${v.n} ${def?.title ?? ''}${ev}${v.note ? `\n   ${v.note}` : ''}`
      })
      .join('\n')
    const draft = buildPolicyDraft({ companyName, verdicts })
    const text = [
      '就業規則 × カスハラ10措置の照合結果の控えです（画面に表示した内容と同じものです）。',
      '',
      '■ 10措置の判定（○=定めあり / △=部分的 / ×=見つからない）',
      table,
      '',
      draft,
      '',
      '──',
      '就業規則AI https://banto-roumu.com/zure',
      'このメールは、診断画面でご本人が入力したアドレスに1回だけ送信しています。',
    ].join('\n')
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'カスハラ10措置の照合結果（控え）| 就業規則AI',
          text,
        }),
      })
      sent = res.ok
      if (!res.ok) console.error('[kasuhara-mail] Resend失敗', res.status, (await res.text()).slice(0, 200))
    } catch (e) {
      console.error('[kasuhara-mail] Resend例外', (e as Error).message)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
