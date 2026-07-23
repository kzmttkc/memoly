import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/company'
import { resolvePlan, type PlanId } from '@/lib/plans'

// ============================================================================
// api-keys.ts — 公開API v1 のAPIキー発行・認証ヘルパ（E08・2026-07-23）
// ----------------------------------------------------------------------------
//   キー形式: banto_sk_<hex 40文字>（乱数20バイト）。
//   保存: SHA-256(hex) の key_hash と表示用 key_prefix のみ（生キーは発行時に
//   一度だけ返し、DBにもログにも残さない）。
//
//   認証フロー（/api/v1/*）:
//     Authorization: Bearer banto_sk_... → SHA-256 → company_api_keys を
//     service role で引く（revoked_at IS NULL のみ有効）→ company を解決。
//     RLS はユーザーJWT前提のため、v1 はアプリ層で company_id スコープを強制する
//     （全クエリに .eq('company_id', auth.companyId) を必ず付ける）。
// ============================================================================

const KEY_PREFIX = 'banto_sk_'
const KEY_RANDOM_BYTES = 20 // hex 40文字
const PREFIX_DISPLAY_LEN = KEY_PREFIX.length + 6 // 表示は banto_sk_ + 先頭6文字

export interface GeneratedApiKey {
  /** 生キー（発行レスポンスで一度だけ見せる）。 */
  plainKey: string
  /** 一覧表示用の先頭部分。 */
  keyPrefix: string
  /** DBに保存するSHA-256(hex)。 */
  keyHash: string
}

/** APIキーを新規生成する（保存はハッシュのみ）。 */
export function generateApiKey(): GeneratedApiKey {
  const plainKey = KEY_PREFIX + randomBytes(KEY_RANDOM_BYTES).toString('hex')
  return {
    plainKey,
    keyPrefix: plainKey.slice(0, PREFIX_DISPLAY_LEN),
    keyHash: hashApiKey(plainKey),
  }
}

/** 生キー → SHA-256(hex)。認証時・発行時の両方でこの1関数を使う。 */
export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey, 'utf8').digest('hex')
}

/** hex文字列同士の定数時間比較（長さ不一致は即false）。 */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length || ba.length === 0) return false
  return timingSafeEqual(ba, bb)
}

export interface ApiKeyAuth {
  companyId: string
  keyId: string
  plan: PlanId
}

/**
 * /api/v1/* の Bearer 認証。成功で ApiKeyAuth、失敗で null。
 *   - service role で key_hash 照合（DB側 UNIQUE 索引で1行ルックアップ）。
 *   - last_used_at はベストエフォート更新（失敗しても認証は成立）。
 *   - 生キー・ハッシュはログに出さない。
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth | null> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice('Bearer '.length).trim()
  if (!token.startsWith(KEY_PREFIX) || token.length > 100) return null

  const tokenHash = hashApiKey(token)

  try {
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('company_api_keys')
      .select('id, company_id, key_hash, revoked_at')
      .eq('key_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle()
    if (error || !row) return null

    // DB の eq 一致に加えて定数時間比較で再確認（多層防御・照合器の差異に依存しない）。
    if (!safeEqualHex(row.key_hash as string, tokenHash)) return null

    // 会社の plan（レート制限の上限解決に使う）。引けなければ free 相当で絞る。
    const { data: company } = await admin
      .from('companies')
      .select('plan')
      .eq('id', row.company_id)
      .maybeSingle()

    // last_used_at はベストエフォート（await するが失敗は無視）。
    await admin
      .from('company_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id)
      .then(() => undefined, () => undefined)

    return {
      companyId: row.company_id as string,
      keyId: row.id as string,
      plan: resolvePlan(company?.plan as string | undefined).id,
    }
  } catch (e) {
    console.error('[api-keys] authenticate threw', (e as Error).name)
    return null
  }
}
