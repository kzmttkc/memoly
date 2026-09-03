import { NextRequest, NextResponse } from 'next/server'
import { extractDocumentText } from '@/lib/document-extract'
import { buildZureSheet } from '@/lib/zure-sheet'
import { retryAfterSeconds, retainHits, ZURE_RL_MAX } from '@/lib/zure-rate-limit'
import { createAnthropicClient } from '@/lib/gap-engine/engine/anthropicClient'
import { runGapSheet, PROMPT_VERSION } from '@/lib/gap-engine/engine/runGapSheet'
import { redactPii } from '@/lib/gap-engine/anonymize/redact'
import { heuristicGapSheet } from '@/lib/gap-engine/fallback'
import { MEMORY_MODEL } from '@/lib/claude'
import type { GapSheet } from '@/lib/gap-engine/engine/types'

export const runtime = 'nodejs'
export const maxDuration = 60

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

async function buildGapSheet(args: {
  text: string
  filename: string
  pageCount: number | null
  unreadNote: string | null
}): Promise<{ sheet: GapSheet; engine: 'claude' | 'heuristic' }> {
  const pagesUnread: number[] = []
  const text = redactPii(args.text)
  const input = {
    text,
    pageCount: args.pageCount ?? undefined,
    pagesUnread,
    titleGuess: args.filename,
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (key && text.trim().length >= 80) {
    try {
      // 2026-09-04 実測（執行部の 5KB・32条サンプル）: sonnet は 4分割で 50.3秒・8分割でも 39.8秒と
      //   締切 42秒に張り付き、本番は毎回ヒューリスティックへ落ちていた（engine=heuristic ms=42020）。
      //   haiku は 4分割 33.2秒、正解データ 10/10（sonnet 9/10・41秒）。分割・締切・フォールバックの
      //   設計は変えず、モデルだけを haiku にする（製品定義 v3 §4-16「作り直さない」の範囲内）。
      const sheet = await runGapSheet(createAnthropicClient(key, MEMORY_MODEL), input)
      if (args.unreadNote) {
        sheet.summary.unread_note = [sheet.summary.unread_note, args.unreadNote]
          .filter(Boolean)
          .join(' ')
      }
      return { sheet, engine: 'claude' }
    } catch (e) {
      console.error('[zure/extract] runGapSheet failed, heuristic fallback', e)
    }
  }

  const sheet = heuristicGapSheet(input)
  if (args.unreadNote) {
    sheet.summary.unread_note = args.unreadNote
  }
  return { sheet, engine: 'heuristic' }
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

  const started = Date.now()
  const { sheet, engine } = await buildGapSheet({
    text: extracted.text,
    filename: extracted.filename,
    pageCount: extracted.pageCount,
    unreadNote: extracted.unreadNote,
  })

  // 既存 pending / 計測互換のため旧形も返す（UIは gapSheet を優先）
  const legacy = buildZureSheet({
    filename: extracted.filename,
    text: extracted.text,
    unreadNote: extracted.unreadNote,
  })

  return NextResponse.json({
    persisted: false,
    prompt_version: PROMPT_VERSION,
    engine,
    ms: Date.now() - started,
    filename: extracted.filename,
    text: extracted.text,
    unreadNote: extracted.unreadNote,
    sheet: legacy,
    gapSheet: sheet,
  })
}
