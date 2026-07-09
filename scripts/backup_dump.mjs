// ============================================================================
// backup_dump.mjs — 番頭(Banto) 論理バックアップ（読取専用・service role）
// ----------------------------------------------------------------------------
// 目的:
//   Supabase 無料枠には「マネージドな日次バックアップ / PITR」が付かない（Pro以上の機能）。
//   そのため、番頭の本番テーブルを service role で読み出し、ローカルに NDJSON で
//   ダンプするのが実効的なバックアップ手段になる。復旧手順は docs/BANTO_BACKUP_RESTORE.md。
//
// 安全性（このスクリプトは絶対に書き込まない）:
//   - REST(PostgREST) の GET のみを使用。INSERT/UPDATE/DELETE/DDL は一切発行しない。
//   - service role キーは .env.local からのみ読む（引数・stdout に出さない）。
//   - 出力は ./backups/<UTC timestamp>/ 配下（.gitignore 済＝秘密データを git に載せない）。
//
// 使い方:
//   node scripts/backup_dump.mjs                # 全テーブルをダンプ
//   node scripts/backup_dump.mjs --dry-run      # 各テーブルの件数だけ確認（本文は書かない）
//   TABLES=companies,company_members node scripts/backup_dump.mjs   # テーブル限定
//   OUT_DIR=/path node scripts/backup_dump.mjs  # 出力先を上書き
//
// 出力物:
//   backups/<ts>/<table>.ndjson  … 1行1レコード（大きくてもストリームで扱える）
//   backups/<ts>/_manifest.json  … テーブル別件数・所要・スキーマ版・整合チェック用
// ============================================================================
import { readFileSync, mkdirSync, createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry-run')

// --- .env.local を素朴にパース（dotenv 非依存・既存 e2e と同じ流儀） ---
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SERVICE) {
  console.error('[backup_dump] .env.local に SUPABASE URL / SERVICE ROLE が必要です')
  process.exit(1)
}

// 番頭(SaaS本体)の全テーブル。memoly_* は旧個人版（原則空）だが完全性のため含める。
// ※ auth.users(認証)は PostgREST 経由では取得しない（別系統。復旧手順は runbook 参照）。
const CORE_TABLES = [
  // --- 番頭 SaaS 本体（会社スコープ） ---
  'companies',
  'company_members',
  'company_profiles',
  'company_attributes',
  'company_memories',
  'company_conversations',
  'company_messages',
  'company_documents',
  'company_deadlines',
  'company_leads',
  'company_digests',
  'company_risk_scores',
  'company_audit_logs',
  'company_billing_events',
  // --- 旧個人版 Memoly（凍結・原則空） ---
  'memoly_users',
  'memoly_profiles',
  'memoly_memories',
  'memoly_conversations',
  'memoly_messages',
  'memoly_reports',
  'memoly_api_usage',
  'memoly_extraction_logs',
]
const TABLES = process.env.TABLES ? process.env.TABLES.split(',').map(s => s.trim()).filter(Boolean) : CORE_TABLES

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_DIR = process.env.OUT_DIR ?? join(ROOT, 'backups', stamp)

const headers = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` }
const PAGE = 1000

// テーブル全件を PostgREST の Range ページングで取得（GET のみ）。
async function dumpTable(table, sink) {
  let from = 0
  let total = 0
  for (;;) {
    const to = from + PAGE - 1
    const url = `${SB_URL}/rest/v1/${table}?select=*`
    const res = await fetch(url, {
      headers: { ...headers, Range: `${from}-${to}`, 'Range-Unit': 'items', Prefer: 'count=exact' },
    })
    if (res.status === 404) {
      const err = new Error('table absent (404)')
      err.absent = true
      throw err
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${table}: HTTP ${res.status} ${body.slice(0, 200)}`)
    }
    const rows = await res.json()
    for (const row of rows) if (sink) sink.write(JSON.stringify(row) + '\n')
    total += rows.length
    // content-range: "0-999/1234" → 総件数を掴む。末尾ページで停止。
    const cr = res.headers.get('content-range') || ''
    const grand = Number((cr.split('/')[1] || '').trim()) || total
    if (rows.length < PAGE || total >= grand) return { total, grand }
    from += PAGE
  }
}

const manifest = { generatedAt: new Date().toISOString(), project: SB_URL, dryRun: DRY, tables: {} }
if (!DRY) mkdirSync(OUT_DIR, { recursive: true })

let failed = 0
for (const table of TABLES) {
  const t0 = Date.now()
  try {
    if (DRY) {
      // HEAD count のみ（本文を読まない・列名に依存しないよう select=*）。
      const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, {
        method: 'HEAD',
        headers: { ...headers, Range: '0-0', 'Range-Unit': 'items', Prefer: 'count=exact' },
      })
      if (res.status === 404) {
        // テーブル未適用（マイグレーション未反映）。バックアップ対象外として警告のみ。
        manifest.tables[table] = { skipped: true, reason: 'table absent (404)', ms: Date.now() - t0, ok: true }
        console.log(`  [dry] ${table}: SKIP (未適用/404)`)
      } else {
        const cr = res.headers.get('content-range') || ''
        const grand = Number((cr.split('/')[1] || '').trim()) || 0
        manifest.tables[table] = { rows: grand, ms: Date.now() - t0, ok: res.ok }
        console.log(`  [dry] ${table}: ${res.ok ? grand + ' rows' : 'HTTP ' + res.status}`)
        if (!res.ok) failed++
      }
    } else {
      const sink = createWriteStream(join(OUT_DIR, `${table}.ndjson`))
      const { total } = await dumpTable(table, sink)
      await new Promise((r) => sink.end(r))
      manifest.tables[table] = { rows: total, ms: Date.now() - t0, ok: true }
      console.log(`  dumped ${table}: ${total} rows (${Date.now() - t0}ms)`)
    }
  } catch (e) {
    if (e && e.absent) {
      // 未適用テーブルはバックアップ対象外（警告のみ・失敗に数えない）。
      manifest.tables[table] = { skipped: true, reason: 'table absent (404)', ms: Date.now() - t0, ok: true }
      console.log(`  SKIP ${table}: 未適用/404`)
    } else {
      failed++
      manifest.tables[table] = { error: (e && e.message) || String(e), ms: Date.now() - t0, ok: false }
      console.error(`  FAIL ${table}: ${(e && e.message) || e}`)
    }
  }
}

if (!DRY) {
  const mf = createWriteStream(join(OUT_DIR, '_manifest.json'))
  mf.write(JSON.stringify(manifest, null, 2))
  await new Promise((r) => mf.end(r))
  console.log(`\n[backup_dump] 完了: ${OUT_DIR}`)
} else {
  console.log('\n[backup_dump] dry-run 完了（本文は書いていません）')
}
console.log(`[backup_dump] tables=${TABLES.length} failed=${failed}`)
process.exit(failed > 0 ? 1 : 0)
