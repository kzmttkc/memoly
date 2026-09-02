import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// /api/company/leads (POST) — 就業規則AI micro-CV リード受け口
//
//   役割: 公開LP(/business)の「就業規則チェックリストDL / 労務リスク3分診断」で
//         入力されたメールを company_leads に1行 INSERT する。本登録（会社作成）の
//         手前にある軽い micro-CV＝ファネルの漏れを塞ぐ。認証は不要（匿名訪問者）。
//
//   セキュリティ/設計:
//     - anon キーで INSERT する（service role を公開エンドポイントで使わない）。
//       テーブル側 RLS は anon に INSERT のみ許可し SELECT/UPDATE/DELETE を持たない
//       ＝この経路では「書けるが他者リードは読めない」。秘密(service role)を晒さない。
//     - PII 最小: 受け取るのは email と source(列挙) と任意の薄い meta のみ。
//       IP は保存しない（レート制限のメモリキーにのみ使い、永続化しない）。
//     - 簡易 spam/レート対策: IP単位の in-memory スライディング上限 + honeypot。
//       本番(サーバレス)では実体が分散しうるため厳密ではないが、素朴な連打/ボットの
//       一次防御として機能する（DB側にも email/source の CHECK 制約がある）。
//
//   Phase1: メール検証・保存のみ。社労士監修/AI社労士/法的精度の表現は扱わない。
// ============================================================================

export const runtime = 'nodejs'

// 受理する source（フック）の許可リスト。未知値は 'unknown' に丸める＝列の多様性を抑え、
// 集計を安定させる（Plausible props と同じ低カーディナリティの思想）。
const ALLOWED_SOURCES = new Set([
  'checklist_dl',   // 就業規則チェックリストDL
  'risk_diagnosis', // 労務リスク3分診断
  // 2026-07-30 PMF監査: 索引される42ページ（記事33本・ツール6本）に
  // メール獲得が1つも無く、company_leads が0行だった。配線は健全で、
  // 置き場所が /business の1箇所だけだったのが原因。記事末尾とツールの
  // 結果直後に同じ LeadCapture を差し込んだので、経路を区別できるようにする。
  // 許可リストに無い値は 'unknown' に丸められるため、ここを足さないと
  // どこから来たリードかが永久に分からない。
  'article_dl',     // 記事末尾（/roumu/*）の汎用PDF枠（現在は /tools と /business のみ）
  'tool_dl',        // 無料ツールの結果直後（/tools/*）
  // 2026-08-25 GTM段2（gtm-doctrine.md §2）: 上の 'article_dl'（全58記事に同じ
  // 労務引き継ぎPDFを出す枠）は lead_captured 実測0件/90日だった。対価を
  // 「その記事の論点で作った確認シート」に替え、記事ごとに meta.slug を持たせる。
  // lib/article-checksheet.ts の CHECKSHEET_SOURCE と同じ文字列であること
  // （不一致だと 'unknown' に丸められ、どの対価で取れたか分からなくなる）。
  'article_checksheet',
  // 2026-08-26 Kabau×番頭 1本化 Phase 1-2（V2設計 §6）: 静的サイト（sharoushi-agent.com）の
  // Netlify Forms 提出を、Netlify の submission-created イベント関数が本エンドポイントへ
  // サーバ間転送する。会員基盤・段2の数えを company_leads 1本にするための受け口。
  // 値は Netlify の form-name と1対1（転送側 netlify/functions/submission-created.js と一致必須）。
  'kabau_kasuhara_deadline', // 逆算スケジュール枠（規定例/マニュアルガイド・kasuhara-deadline-mail）
  'kabau_kasuhara_record',   // 10措置チェックの対応状況記録（kasuhara-record-mail）
  'kabau_tool_result',       // 計算ツールの結果送付（tool-result-mail）
  'kabau_page_doc',          // ページ内資料の送付（page-doc-mail）
  'kabau_updates',           // 更新案内オプトイン（email-updates）
  'kasuhara_gap',            // /zure の10措置照合（控えの送付・Phase 2）
  'kabau_invoice_request',   // パックLPの請求書払い申込（invoice-request・製品定義書 v3 §12.2）
  'unknown',
])

// メール形式の素朴な検証（DBの CHECK 制約と二重化）。RFC完全準拠は狙わず実用十分に。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// --- in-memory レート制限（IP単位・スライディングウィンドウ） ---
//   サーバレスではインスタンス毎にリセットされうるが、単一インスタンス内の連打は防ぐ。
//   グローバルに1つだけ Map を持つ（モジュールスコープ）。
const WINDOW_MS = 60_000 // 1分窓
const MAX_PER_WINDOW = 5 // 同一IPから1分あたり5件まで
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
  // 軽い掃除: Map が肥大しないよう、たまに古いIPを落とす。
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every(t => now - t >= WINDOW_MS)) hits.delete(k)
    }
  }
  return false
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  // 1. レート制限（IPは保存しない・メモリキーのみ）
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: 'しばらく時間をおいて再度お試しください。' }, { status: 429 })
  }

  // 2. 入力パース
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '不正なリクエストです。' }, { status: 400 })
  }

  // honeypot: 人間には見えない隠しフィールド(website)が埋まっていればボット。
  // 200 を返して攻撃者に検知させず、ただし保存はしない（サイレントドロップ）。
  if (typeof (body as Record<string, unknown>).website === 'string' &&
      (body as Record<string, string>).website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
    return NextResponse.json({ error: 'メールアドレスの形式をご確認ください。' }, { status: 400 })
  }

  const rawSource = typeof body.source === 'string' ? body.source : 'unknown'
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : 'unknown'

  // meta は薄い非個人メタのみ受理（診断バリアント等）。文字列値だけ・最大8キー・PIIなし。
  // email/name など個人情報になりうるキーは弾く（保存はトップレベル email のみ）。
  const meta: Record<string, string> = {}
  if (body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)) {
    const banned = new Set(['email', 'name', 'tel', 'phone', 'address'])
    for (const [k, v] of Object.entries(body.meta as Record<string, unknown>)) {
      if (Object.keys(meta).length >= 8) break
      if (banned.has(k.toLowerCase())) continue
      if (typeof v === 'string' && v.length <= 120) meta[k] = v
      else if (typeof v === 'number' || typeof v === 'boolean') meta[k] = String(v)
    }
  }

  // 3. anon キーで INSERT（RLS: anon は INSERT のみ可）。service role は使わない。
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error('[company:leads] missing supabase env')
    return NextResponse.json({ error: '一時的に受け付けできません。' }, { status: 500 })
  }

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase
    .from('company_leads')
    .insert({ email: rawEmail, source, meta })

  if (error) {
    // RLS 拒否・テーブル未適用・接続失敗など。詳細はログのみ（PIIを返さない）。
    console.error('[company:leads] insert failed', { source, code: error.code, msg: error.message })
    return NextResponse.json({ error: '送信に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
