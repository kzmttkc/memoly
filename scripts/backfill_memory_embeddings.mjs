// ============================================================================
// backfill_memory_embeddings.mjs — 既存 company_memories の埋め込みバックフィル（P1-1）
// ----------------------------------------------------------------------------
// 目的: セマンティック検索 migration（company_memory_semantic.sql）適用後、
//   embedding が NULL の既存記憶（summary / decision）を OpenAI で埋めて、
//   過去の記憶も意味検索の対象にする。
//
// 冪等: embedding IS NULL の行だけを対象にする。途中で止めても再実行で続きから埋まる。
// 非破壊: summary/decision の embedding 列だけを更新する（本文・他列は一切触らない）。
//
// 実行（手動タスク・Takeshi領域＝APIキー投入後）:
//   1. company_memory_semantic.sql を本番Supabaseに適用済みであること
//   2. .env.local に OPENAI_API_KEY を設定済みであること（課金発生・Takeshi承認済み範囲）
//   3. cd ~/memoly && node scripts/backfill_memory_embeddings.mjs
//   ※ 本番Vercelには不要（これはDBへの一括埋め込み。ランタイムはアプリが随時埋める）。
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of readFileSync(join(__dir, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = env.OPENAI_API_KEY
if (!URL || !SERVICE) throw new Error('env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY 未設定。キー投入後に実行してください（graceful: 未設定なら埋め込みは行われません）。')

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536
const BATCH = 50 // 1回の embedding API 入力件数

const db = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

async function embedBatch(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`OpenAI embeddings failed: ${res.status} ${body?.error?.message ?? ''}`)
  }
  const json = await res.json()
  return (json.data ?? []).map(d => d.embedding)
}

async function main() {
  let totalUpdated = 0
  let round = 0
  // embedding IS NULL の summary/decision を件数分だけ順に処理する。
  for (;;) {
    const { data: rows, error } = await db
      .from('company_memories')
      .select('id, summary')
      .in('memory_type', ['summary', 'decision'])
      .is('embedding', null)
      .not('summary', 'is', null)
      .limit(BATCH)
    if (error) throw new Error(`select failed: ${error.message}`)
    if (!rows || rows.length === 0) break

    const texts = rows.map(r => String(r.summary ?? '').slice(0, 8000))
    const embeddings = await embedBatch(texts)

    for (let i = 0; i < rows.length; i++) {
      const emb = embeddings[i]
      if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIM) {
        console.error(`[backfill] skip id=${rows[i].id} (bad embedding dim=${emb?.length})`)
        continue
      }
      const literal = `[${emb.join(',')}]`
      const { error: upErr } = await db
        .from('company_memories')
        .update({ embedding: literal })
        .eq('id', rows[i].id)
      if (upErr) console.error(`[backfill] update failed id=${rows[i].id}: ${upErr.message}`)
      else totalUpdated++
    }
    round++
    console.log(`[backfill] round ${round}: processed ${rows.length}, total updated ${totalUpdated}`)
  }
  console.log(`[backfill] done. total updated = ${totalUpdated}`)
}

main().catch(e => {
  console.error('[backfill] fatal:', e.message)
  process.exit(1)
})
