import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import PageDocEngine from '@/lib/page-doc-engine.js'
import { buildDocx } from '@/lib/docx.js'

// ============================================================================
// /api/roumu/page-doc (POST) — /roumu のカスハラ記事で「足す条文と順番」を Word でメールする（段2）
//
//   なぜ（2026-09-15・ディストリビューション戦略発注／Takeshi「全て最適解で進めて」）:
//     このドメインの訪問の8割は /roumu の上位2記事。そこにある確認シート（article_checksheet）は
//     8/25 以降 0件。一方、就業規則AI(サイト)の規定例ページで同じ交換（3つ選ぶ→条文と順番が
//     その場で出る→メールで Word）が段2の名前を 8件取っている。取れている交換をそのまま置く。
//
//   設計（サイト側 send-result-mail.js と同じ規律）:
//     - **本文はクライアントから受け取らない。** 受け取るのは email と3つの選択値だけで、
//       本文はサーバで PageDocEngine が組み直す（任意の本文を他人宛に撃てる中継にしない）
//     - 取るのはメールアドレス1つだけ。company_leads に source=app_page_doc・meta.slug で1行
//     - 期日リマインド（Blobs・二段階確認）はサイト側の仕組みなので、ここでは約束しない
//     - IP 単位の簡易レート制限＋honeypot（/api/company/leads と同じ）
// ============================================================================

export const runtime = 'nodejs'

const SOURCE = 'app_page_doc'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 置いてよい記事だけ受ける（slug を任意に書き込ませない）
const ALLOWED_SLUGS = new Set(['kasuhara-gimuka-2026', 'kashara-kiyaku-kisoku-kiji-rei'])

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 3
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) { hits.set(ip, arr); return true }
  arr.push(now); hits.set(ip, arr)
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.every(t => now - t >= WINDOW_MS)) hits.delete(k)
  return false
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  if (rateLimited(ip)) return NextResponse.json({ error: 'しばらく時間をおいて再度お試しください。' }, { status: 429 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 })
  if (typeof body.website === 'string' && body.website.trim() !== '') return NextResponse.json({ ok: true })

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'メールアドレスを半角で入れ直してください。' }, { status: 400 })
  }
  const slug = typeof body.slug === 'string' && ALLOWED_SLUGS.has(body.slug) ? body.slug : null
  if (!slug) return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 })

  const src = (body.values && typeof body.values === 'object' ? body.values : {}) as Record<string, unknown>
  const values: Record<string, string> = {}
  for (const k of Object.keys(PageDocEngine.LABELS.kitei)) values[k] = typeof src[k] === 'string' ? String(src[k]).slice(0, 12) : ''
  const text = PageDocEngine.build('kitei', values)
  if (!text) return NextResponse.json({ error: '上の3つを選んでから押してください。' }, { status: 400 })

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.DIGEST_FROM_EMAIL
  if (!RESEND_API_KEY || !FROM) {
    console.error('[roumu:page-doc] missing mail env')
    return NextResponse.json({ error: '一時的に送れません。画面の本文はそのまま使えます。' }, { status: 500 })
  }

  // 2026-09-15: 届出に使う書類（答えで1〜3枚）も添付する。画面ではその場でダウンロードさせている
  const formsText = PageDocEngine.buildForms(values)
  const formsList = PageDocEngine.forms('kitei', values)
  const files = formsList.map(f => f.id).join(',')

  const mailText = [
    text,
    '',
    formsText
      ? 'このメールに Word ファイル（.docx）を2つ添付しています。条文と順番のほかに、届出に使う書類（' + formsList.map(f => f.title).join('・') + '）です。'
      : 'このメールに Word ファイル（.docx）を添付しています。開いてそのまま社内の書式へ貼れます。',
    '同じ内容は記事の画面にも出ています: https://banto-roumu.com/roumu/' + slug,
    '条文例と解説: https://sharoushi-agent.com/kasuhara-shugyokisoku-kitei-guide.html',
    '',
    '──',
    'このメールは、記事の画面でご本人が入力したアドレスに1回だけ送っています。',
    '就業規則AI https://sharoushi-agent.com/',
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: PageDocEngine.SUBJECT.kitei,
        text: mailText,
        attachments: [{ filename: '足す条文と10月1日までの順番.docx', content: buildDocx(text).toString('base64') }].concat(
          formsText ? [{ filename: '届出の書類（' + formsList.map(f => f.title).join('・') + '）.docx', content: buildDocx(formsText).toString('base64') }] : [],
        ),
      }),
    })
    if (!res.ok) {
      console.error('[roumu:page-doc] Resend失敗', res.status, (await res.text()).slice(0, 200))
      return NextResponse.json({ error: '送れませんでした。時間をおいて試してください。画面の本文はそのまま残ります。' }, { status: 502 })
    }
  } catch (e) {
    console.error('[roumu:page-doc] Resend例外', (e as Error).message)
    return NextResponse.json({ error: '送れませんでした。時間をおいて試してください。画面の本文はそのまま残ります。' }, { status: 502 })
  }

  // 記帳（送信が通ってから）。失敗しても本人のメールは届いているので 200 を返し、ログに残す。
  let recorded = false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anon) {
    const supabase = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error } = await supabase.from('company_leads').insert({
      email, source: SOURCE, meta: { slug, size: values.size, union: values.union, rules: values.rules, offer: 'todoke3', files },
    })
    if (error) console.error('[roumu:page-doc] company_leads insert failed', { code: error.code, msg: error.message })
    else recorded = true
  } else {
    console.error('[roumu:page-doc] missing supabase env — lead not recorded')
  }
  return NextResponse.json({ ok: true, recorded })
}
