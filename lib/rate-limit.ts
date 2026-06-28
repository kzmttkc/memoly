import { createAdminClient } from '@/lib/company'
import { limitFor, PlanId, PlanFeatureLimits } from '@/lib/plans'

// ============================================================================
// rate-limit.ts — ユーザー単位・日次・種別(kind)別のLLM系API利用上限ガード。
//
//   目的:
//     高コストのsonnet系API（chat / document/generate / document/review /
//     insights / risk-audit）を、認証済みユーザーが無制限に連打できてしまう
//     問題への防御。各route の LLM 呼び出し前に checkAndIncrement を1回呼ぶ。
//
//   plan 連動（2026-06-27 課金結線で追加）:
//     上限は **プラン依存**。lib/plans.ts の limitFor(planId, kind) を正本とし、
//     無料モニター(free)は低め、有料(starter/standard/shigyo)ほど高い。
//     これが「無料/有料境界をコードで強制する」実体（表示だけにしない）。
//     呼び出し側は会社の plan を渡す（未指定は free 相当に倒す＝安全側で絞る）。
//
//   仕組み:
//     - service role（RLSバイパス）で RPC memoly_increment_api_usage を呼び、
//       当日カウンタを原子的に +1 して新しい値を取得する。
//     - 新しいカウントが limit を超えたら false（=呼び出し側で429を返す）。
//
//   安全側の設計（fail-open / DBエラー時のみ）:
//     - テーブル/関数がまだDBに無い・service role未設定・RPC失敗 等の場合は
//       「カウントできなくてもサービスは止めない」ために true を返す。
//       上限が一時的に効かないことより、本機能が課金導線を巻き添えで落とす方が
//       事業損失が大きいため、安全側＝通す（エラーはログに残す）。
//       ※ これは「DBが落ちている」例外時の挙動。plan による上限そのものは
//         DBが健全な限り常に強制される。
// ============================================================================

export type ApiKind = keyof PlanFeatureLimits

// 後方互換: plan 不明時のフォールバック上限（= free プランの上限）。
// 旧来 DAILY_LIMITS を参照していた箇所が壊れないよう残す（free 連動に変更）。
export const DAILY_LIMITS: Record<ApiKind, number> = {
  chat: limitFor('free', 'chat'),
  document_generate: limitFor('free', 'document_generate'),
  document_review: limitFor('free', 'document_review'),
  insights: limitFor('free', 'insights'),
  risk_audit: limitFor('free', 'risk_audit'),
}

/**
 * 当日のユーザー×kindコール数を +1 し、上限内なら true / 超過なら false を返す。
 *
 * @param userId 認証済みユーザーID
 * @param kind   API種別
 * @param planId 会社プラン（未指定は 'free' = 最も絞られた上限。安全側）
 * @returns      true=続行可 / false=上限超過(429)。DBエラー時は fail-open で true。
 *
 * 上限は plan 連動: limitFor(planId, kind)。明示 limit を渡したい高度な用途のため
 * 第4引数 limitOverride も残すが、通常は planId 経由で解決する。
 */
export async function checkAndIncrement(
  userId: string,
  kind: ApiKind,
  planId: PlanId = 'free',
  limitOverride?: number,
): Promise<boolean> {
  const limit = typeof limitOverride === 'number' ? limitOverride : limitFor(planId, kind)
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('memoly_increment_api_usage', {
      p_user_id: userId,
      p_kind: kind,
    })

    if (error) {
      // テーブル/関数未適用・権限不足など。サービスは止めない（fail-open）。
      console.error('[rate-limit] increment RPC failed (fail-open)', {
        kind,
        err: error.message,
      })
      return true
    }

    const count = typeof data === 'number' ? data : Number(data)
    if (!Number.isFinite(count)) {
      // 想定外の戻り。カウントできない＝止めない。
      console.error('[rate-limit] unexpected RPC result (fail-open)', { kind, data })
      return true
    }

    return count <= limit
  } catch (e) {
    // service role未設定（createAdminClientの env undefined）等の例外も fail-open。
    console.error('[rate-limit] guard threw (fail-open)', {
      kind,
      err: (e as Error).message,
    })
    return true
  }
}
