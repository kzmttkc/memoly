import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getMembership } from '@/lib/company'
import { extractDocumentText } from '@/lib/document-extract'

// ============================================================================
// /api/company/document/extract — 規程ファイルから本文を取り出す
//   取込本体（ingest）はテキストのまま。ここでは PDF / Word / テキストを本文にする。
//   取れなかった分は unreadNote で返す（空の台帳にしない）。
// ============================================================================

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form required' }, { status: 400 })

  const companyId = String(form.get('companyId') ?? '')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const membership = await getMembership(companyId)
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: '管理者のみファイルを取り込めます' }, { status: 403 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ファイルを選んでください' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ファイルは8MBまでです' }, { status: 413 })
  }

  const buffer = new Uint8Array(await file.arrayBuffer())
  const extracted = await extractDocumentText({
    buffer,
    filename: file.name,
    mime: file.type || 'application/octet-stream',
  })

  return NextResponse.json(extracted)
}
