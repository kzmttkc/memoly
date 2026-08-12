import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dbFailureDetail } from '@/lib/health-detail'

// ============================================================================
// /api/health — 外形監視・稼働確認用の軽量ヘルスチェック（P1）
//
//   用途: UptimeRobot 等の外形監視、デプロイ後スモーク、障害の一次切り分け。
//   設計方針:
//     - 認証不要（監視サービスが叩けるように）。ただし秘密値は一切返さない
//       （env は「設定されているか」の真偽だけ）。
//     - 軽量・高速。DB は anon キーで往復1回だけ（RLSで0件でも「到達=OK」と判定）。
//     - 正常=200 {status:"ok"} / DB不通など致命=503 {status:"error"}。
//       env 欠落など準異常=200 {status:"degraded"}（監視のダウン誤検知を避ける）。
//   ★キャッシュ厳禁（no-store）。CDN/ブラウザにヘルス結果を焼き付けない。
// ============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Check = { ok: boolean; detail?: string }

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, Check> = {}

  // 1) 必須環境変数の「存在」チェック（値は絶対に返さない）。
  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ]
  const missing = requiredEnv.filter((k) => !process.env[k])
  checks.env = { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(',')}` : undefined }

  // 1b) Stripe鍵のモード（live/test/none）。値は返さず接頭辞の判別だけ。
  //   2026-08-13 制度対応部: キット決済(AQ-023)の開通確認で「本番がtest鍵のまま」という
  //   静かな失敗モード（買えるのに金が動かない）を外形から検出可能にする。
  //   鍵のモードは publishable key としてクライアントに出る種類の情報で、秘密値ではない。
  const sk = process.env.STRIPE_SECRET_KEY ?? ''
  checks.stripe = {
    ok: sk.startsWith('sk_'),
    detail: sk.startsWith('sk_live') ? 'mode: live' : sk.startsWith('sk_test') ? 'mode: test' : 'missing',
  }

  // 2) DB 疎通（anon で往復1回。RLSで0件でも到達できれば健全）。
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anon) {
    try {
      const supabase = createClient(url, anon, { auth: { persistSession: false } })
      // head+count は本文を返さず、テーブルの往復のみ。RLSで0件でも error にはならない。
      const { error } = await supabase.from('companies').select('id', { head: true, count: 'exact' }).limit(1)
      checks.db = error ? { ok: false, detail: dbFailureDetail(error.message) } : { ok: true }
    } catch (e) {
      checks.db = { ok: false, detail: dbFailureDetail((e as Error)?.message) }
    }
  } else {
    checks.db = { ok: false, detail: 'supabase env missing' }
  }

  // 判定: DB不通は致命(503)。env欠落だけなら degraded(200)。
  const dbOk = checks.db.ok
  const allOk = Object.values(checks).every((c) => c.ok)
  const status = !dbOk ? 'error' : allOk ? 'ok' : 'degraded'
  const httpStatus = status === 'error' ? 503 : 200

  return NextResponse.json(
    {
      status,
      service: 'banto',
      ts: new Date().toISOString(),
      uptimeMs: Date.now() - startedAt,
      checks,
    },
    {
      status: httpStatus,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}
