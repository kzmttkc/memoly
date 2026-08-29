import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { toAnonymousStats } from '@/lib/gap-engine/engine/runGapSheet'
import type { GapSheet } from '@/lib/gap-engine/engine/types'

export const runtime = 'nodejs'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * 登録後「残す」用の骨格。
 * - 本文は匿名表に載せない
 * - gap_stats_anonymous へ item×status だけ upsert（表が無い環境では stats_skipped）
 * - 会社書類への本文保存は既存 /api/company/document/ingest を使う
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const sheet = body.sheet as GapSheet | undefined
  const text = String(body.text ?? '')
  if (!sheet?.blocks?.length || !text) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const sha = createHash('sha256').update(text).digest('hex')
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const rows = toAnonymousStats({
    industry: typeof body.industry === 'string' ? body.industry : undefined,
    headcountBand: typeof body.headcount_band === 'string' ? body.headcount_band : undefined,
    sheet,
    yyyymm,
  })

  const sb = admin()
  let statsUpserted = 0
  let statsSkipped: string | null = null

  if (!sb) {
    statsSkipped = 'no_service_role'
  } else {
    for (const row of rows) {
      const { data: existing, error: selErr } = await sb
        .from('gap_stats_anonymous')
        .select('n')
        .eq('yyyymm', row.yyyymm)
        .eq('industry', row.industry)
        .eq('headcount_band', row.headcount_band)
        .eq('item_id', row.item_id)
        .eq('status', row.status)
        .maybeSingle()

      if (selErr) {
        statsSkipped = selErr.message.includes('does not exist')
          ? 'table_missing'
          : selErr.message.slice(0, 120)
        break
      }

      const nextN = (existing?.n ?? 0) + 1
      const { error: upErr } = await sb.from('gap_stats_anonymous').upsert(
        {
          yyyymm: row.yyyymm,
          industry: row.industry,
          headcount_band: row.headcount_band,
          item_id: row.item_id,
          status: row.status,
          n: nextN,
        },
        { onConflict: 'yyyymm,industry,headcount_band,item_id,status' },
      )
      if (upErr) {
        statsSkipped = upErr.message.slice(0, 120)
        break
      }
      statsUpserted += 1
    }
  }

  return NextResponse.json({
    ok: true,
    text_sha256: sha,
    anonymous_rows: rows.length,
    stats_upserted: statsUpserted,
    stats_skipped: statsSkipped,
  })
}
