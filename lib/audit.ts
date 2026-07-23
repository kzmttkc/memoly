import { createServerSupabaseClient } from '@/lib/supabase-server'

// ============================================================================
// audit.ts — 会社スコープの監査ログ書込みヘルパ（重要操作の証跡）。
// ----------------------------------------------------------------------------
//   規程削除・メンバー変更・記憶削除など「誰がいつ何をしたか」を company_audit_logs に
//   追記する。書込みは anon(=ユーザーJWT) クライアントで行い、RLS の WITH CHECK が
//   actor_user_id=auth.uid() を強制する（なりすまし記録の防止＝ lib/company.ts の流儀）。
//
//   ★ベストエフォート（非破壊が最優先）:
//     - migration 未適用（テーブル無し）・RLS 失敗・通信エラーでも例外を投げない。
//       監査ログの失敗で本体の操作（削除・招待など）を巻き添えにしない。
//       失敗は console.error に info 級で残すだけ（記録されないだけで機能は動く）。
// ============================================================================

export type AuditAction =
  | 'profile.delete' // 自社ルール(company_profiles)の削除
  | 'profile.update' // 自社ルールの更新
  | 'document.delete' // 取込規程(company_documents)の削除
  | 'member.invite' // 席の招待/追加（メンバー変更）
  | 'memory.rule.delete' // 記憶(rule候補)の削除（承認時の片付け含む）
  | 'data.export' // 会社データの一括エクスポート(JSON・admin操作)
  | 'integration.slack.update' // Slack Webhook の登録/変更（URLはmetadataに入れない）
  | 'integration.slack.delete' // Slack Webhook の解除
  | 'apikey.create' // 公開API v1 キーの発行（metadataはprefixのみ）
  | 'apikey.revoke' // 公開API v1 キーの失効

export interface AuditParams {
  companyId: string
  actorUserId: string
  action: AuditAction
  targetType?: string
  targetId?: string | null
  /** 非PII推奨の付随情報（例: { key: '所定労働時間' } / { role: 'member' }）。 */
  metadata?: Record<string, unknown>
}

/**
 * 監査ログを1行追記する。失敗しても投げない（呼び出し側の本処理を止めない）。
 */
export async function logCompanyAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.from('company_audit_logs').insert({
      company_id: params.companyId,
      actor_user_id: params.actorUserId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
    })
    if (error) {
      // テーブル未適用（migration前）は想定内。info 級に留め、本処理は継続。
      console.error('[audit] insert failed (non-fatal)', error.message)
    }
  } catch (e) {
    console.error('[audit] threw (non-fatal)', (e as Error).message)
  }
}
