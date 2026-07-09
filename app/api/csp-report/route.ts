import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// /api/csp-report — CSP違反レポートの受け口（Report-Only 並走の計測用・P0#6）
//
//   背景: script-src の 'unsafe-inline' を安全に外すため、まず厳格ポリシーを
//     Content-Security-Policy-Report-Only で「並走」させ、実際に何が違反するかを
//     測る（enforce しない＝絶対に画面を壊さない）。next.config.ts の
//     report-uri / report-to がここに POST してくる。
//
//   設計:
//     - 認証不要・副作用なし・常に 204。ブラウザは report-uri(旧) / report-to(新) の
//       2形式で送るため、両方の JSON 形を受ける。
//     - ログ肥大を避けるためディレクティブ単位で軽く要約して console に出す
//       （Vercel のログに残り、Sentry 導入後はそちらにも寄せられる）。
//     - 本文が壊れていても握りつぶして 204（監視・攻撃の的にしない）。
// ============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Violation = {
  documentUri?: string
  violatedDirective?: string
  effectiveDirective?: string
  blockedUri?: string
}

function normalize(body: unknown): Violation[] {
  const out: Violation[] = []
  if (!body || typeof body !== 'object') return out
  // 旧形式: { "csp-report": {...} }
  const legacy = (body as Record<string, unknown>)['csp-report']
  if (legacy && typeof legacy === 'object') {
    const r = legacy as Record<string, string>
    out.push({
      documentUri: r['document-uri'],
      violatedDirective: r['violated-directive'],
      effectiveDirective: r['effective-directive'],
      blockedUri: r['blocked-uri'],
    })
    return out
  }
  // 新形式(Reporting API): [{ type:"csp-violation", body:{...} }, ...]
  const arr = Array.isArray(body) ? body : [body]
  for (const item of arr) {
    const b = (item as Record<string, unknown>)?.body as Record<string, string> | undefined
    if (b) {
      out.push({
        documentUri: b.documentURL,
        violatedDirective: b.violatedDirective,
        effectiveDirective: b.effectiveDirective,
        blockedUri: b.blockedURL,
      })
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    for (const v of normalize(body)) {
      const dir = v.effectiveDirective || v.violatedDirective || 'unknown'
      // ブロック元は origin までに丸めて PII/クエリを残さない。
      let blocked = v.blockedUri || 'inline'
      try {
        if (blocked.startsWith('http')) blocked = new URL(blocked).origin
      } catch {}
      console.warn(`[csp-report] directive=${dir} blocked=${blocked} doc=${v.documentUri ?? ''}`)
    }
  } catch {
    // 壊れたレポートは無視（常に 204）。
  }
  return new NextResponse(null, { status: 204 })
}
