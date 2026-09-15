import { NextRequest, NextResponse } from 'next/server'
import PageDocEngine from '@/lib/page-doc-engine.js'
import { buildDocx } from '@/lib/docx.js'

// ============================================================================
// /api/roumu/page-doc/forms (POST) — /roumu の2記事: 届出に使う書類の Word をその場で返す（2026-09-15）
//
//   就業規則AI(サイト)の netlify/functions/page-doc-forms.js と同じ規律:
//     - 本文はクライアントから受け取らない。3問の答えだけで PageDocEngine.buildForms が組む
//     - 渡す書類は答えで決まる（10人未満に変更届、組合ありに選出記録を入れない）
//     - メールと記帳は /api/roumu/page-doc が担う。ここは Word を返すだけ
// ============================================================================

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_SLUGS = new Set(['kasuhara-gimuka-2026', 'kashara-kiyaku-kisoku-kiji-rei'])
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 6
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) { hits.set(ip, arr); return true }
  arr.push(now); hits.set(ip, arr)
  return false
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ error: 'しばらく時間をおいて試してください。' }, { status: 429 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 })
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'メールアドレスを半角で入れ直してください。' }, { status: 400 })
  }
  if (typeof body.slug !== 'string' || !ALLOWED_SLUGS.has(body.slug)) {
    return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 })
  }
  const src = (body.values && typeof body.values === 'object' ? body.values : {}) as Record<string, unknown>
  const values: Record<string, string> = {}
  for (const k of Object.keys(PageDocEngine.LABELS.kitei)) values[k] = typeof src[k] === 'string' ? String(src[k]).slice(0, 12) : ''
  const text = PageDocEngine.buildForms(values)
  if (!text) return NextResponse.json({ error: '上の3つを選んでから押してください。' }, { status: 400 })
  const list = PageDocEngine.forms('kitei', values)
  const name = '届出の書類（' + list.map(f => f.title).join('・') + '）.docx'
  return new NextResponse(new Uint8Array(buildDocx(text)), {
    status: 200,
    headers: {
      'Content-Type': DOCX,
      'Content-Disposition': `attachment; filename="todoke.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
      'X-Forms': list.map(f => f.id).join(','),
    },
  })
}
