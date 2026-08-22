import { NextRequest, NextResponse } from 'next/server'
import { extractDocumentText } from '@/lib/document-extract'
import { buildZureSheet } from '@/lib/zure-sheet'
import { retryAfterSeconds, retainHits, ZURE_RL_MAX } from '@/lib/zure-rate-limit'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const wait = takeRateLimit(ip)
  if (wait !== null) {
    const minutes = Math.max(1, Math.ceil(wait / 60))
    return NextResponse.json(
      {
        error: `同じ回線から、1時間に${ZURE_RL_MAX}回までです。あと約${minutes}分してから、もう一度置いてください。`,
      },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    )
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'ファイルを選んでください。' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ファイルを選んでください。' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ファイルは8MBまでです。圧縮するか、テキストに書き出してください。' }, { status: 413 })
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const extracted = await extractDocumentText({
    buffer,
    filename: file.name,
    mime: file.type || 'application/octet-stream',
  })
  const sheet = buildZureSheet({
    filename: extracted.filename,
    text: extracted.text,
    unreadNote: extracted.unreadNote,
  })

  return NextResponse.json({
    filename: extracted.filename,
    text: extracted.text,
    unreadNote: extracted.unreadNote,
    sheet,
  })
}
