'use client'

/**
 * Memoly 自前ファネル計測ヘルパー（Plausible カスタムイベント）
 *
 * - layout.tsx で読み込まれる window.plausible キューを使う（既存パターン踏襲）
 * - 計測の失敗が機能を壊さないよう、すべて try/catch で握りつぶす
 * - PII（メール本文・記憶内容）は props に入れない。件数・種別など非個人情報のみ
 */

type PlausibleProps = Record<string, string | number | boolean>

export function track(event: string, props?: PlausibleProps) {
  try {
    if (typeof window === 'undefined') return
    const decorated = withTtvProps(event, props)
    const plausible = (window as unknown as { plausible?: (e: string, opts?: { props: PlausibleProps }) => void }).plausible
    if (decorated) plausible?.(event, { props: decorated })
    else plausible?.(event)
  } catch {
    /* 計測失敗は無視。機能本体に影響させない */
  }
}

// ----------------------------------------------------------------------------
// TTV計測（W3.5b 2026-07-23）: signup完了→初回価値到達の経過秒。目標90秒。
//   - signup完了時刻は markSignupCompletedAt()（app/(auth)/signup が signup_completed
//     発火直前に呼ぶ）で localStorage に記録する。
//   - 到達点は「初回診断表示(risk_audit_completed)」「初回チャット送信完了
//     (chat_message_sent)」の2マイルストーン。risk/chat 側のコードには触らず、
//     既存イベントが track() を通る瞬間にこの計測libの中で props を足す
//     （W3.5c の risk/chat UI 変更と衝突しないよう読取をここへ集約）。
//   - 新イベントは作らない（既存イベント名に props を足す原則）。props は
//     低カーディナリティのバケットのみ: lt60s / 60_90s / 90_180s / 180s_plus。
//   - 各マイルストーンは初回のみ（localStorage でガード）。signup 時刻が無い
//     （計測実装前の登録・別ブラウザ・localStorage不可）場合は何も足さない。
// ----------------------------------------------------------------------------

const TTV_SIGNUP_AT_KEY = 'banto_signup_completed_at'
const TTV_FIRED_PREFIX = 'banto_ttv_fired_'

/** TTV到達点として扱う既存イベント → マイルストーン識別子（firedキー用） */
const TTV_MILESTONES: Record<string, string> = {
  risk_audit_completed: 'first_diagnosis',
  chat_message_sent: 'first_chat',
}

/** 経過秒→低カーディナリティのバケット（目標90秒: lt60s/60_90s が合格ゾーン） */
function ttvBucket(seconds: number): string {
  if (seconds < 60) return 'lt60s'
  if (seconds < 90) return '60_90s'
  if (seconds < 180) return '90_180s'
  return '180s_plus'
}

/** signup完了時刻を記録する（signup_completed 発火直前に app/(auth)/signup が呼ぶ）。 */
export function markSignupCompletedAt() {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(TTV_SIGNUP_AT_KEY, String(Date.now()))
  } catch {
    /* localStorage 不可は無視 */
  }
}

/**
 * TTV対象イベントなら ttv_bucket / ttv_seconds を props に足して返す。
 * 対象外・初回済み・signup時刻なしのときは props をそのまま返す（挙動不変）。
 */
function withTtvProps(event: string, props?: PlausibleProps): PlausibleProps | undefined {
  try {
    const milestone = TTV_MILESTONES[event]
    if (!milestone) return props
    const at = Number(localStorage.getItem(TTV_SIGNUP_AT_KEY))
    if (!Number.isFinite(at) || at <= 0) return props
    const firedKey = TTV_FIRED_PREFIX + milestone
    if (localStorage.getItem(firedKey)) return props
    localStorage.setItem(firedKey, new Date().toISOString())
    const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
    return { ...(props ?? {}), ttv_bucket: ttvBucket(seconds) }
  } catch {
    return props
  }
}

/**
 * イベントの送出確定を待ってから画面遷移する。
 *   track() は window.plausible にキュー投入するだけ（fire-and-forget）。直後に
 *   router.push すると、ビーコンが送出される前に SPA 遷移が走り、キュー内イベントが
 *   破棄され得る。北極星（signup_completed）でこれが起きると登録が黙って計測漏れする。
 *   → Plausible の callback（送出完了で発火）で遷移し、届かない環境に備え timeout で
 *     必ず遷移する（計測より遷移の確実性を優先＝ユーザー体験は絶対に悪化させない）。
 */
export function trackThenNavigate(
  event: string,
  navigate: () => void,
  props?: PlausibleProps,
) {
  if (typeof window === 'undefined') {
    navigate()
    return
  }
  let done = false
  const go = () => {
    if (done) return
    done = true
    navigate()
  }
  try {
    const plausible = (window as unknown as {
      plausible?: (e: string, opts?: { props?: PlausibleProps; callback?: () => void }) => void
    }).plausible
    if (!plausible) {
      go()
      return
    }
    // 送出確定で遷移。届かない場合に備え 300ms で必ず遷移する保険。
    setTimeout(go, 300)
    plausible(event, { ...(props ? { props } : {}), callback: go })
  } catch {
    go()
  }
}

const RETURN_KEY = 'banto_first_visit'
const RETURN_FIRED_KEY = 'banto_returning_fired_on'

/**
 * 2026-07-23 ブランド移行: memoly_* → banto_*。
 * 旧キーの値が残っていれば新キーへ移し替えてから読む（初回訪問日を失うと
 * 既存訪問者が「初回」に巻き戻り returning_user 計測が欠落するため）。
 */
function migrateLegacyKey(newKey: string, legacyKey: string): string | null {
  const current = localStorage.getItem(newKey)
  if (current) return current
  const legacy = localStorage.getItem(legacyKey)
  if (legacy) {
    localStorage.setItem(newKey, legacy)
    localStorage.removeItem(legacyKey)
    return legacy
  }
  return null
}

/**
 * リテンション最小代理: 初回訪問日を localStorage に記録し、
 * 別日（暦日が異なる）にアクセスしたら returning_user を1回だけ発火する。
 * 同一日内の複数回ロードでは発火しない（リロード過剰計測を避ける）。
 */
export function trackReturningVisit() {
  try {
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD（ローカル基準で十分な粒度）
    const first = migrateLegacyKey(RETURN_KEY, 'memoly_first_visit')
    if (!first) {
      localStorage.setItem(RETURN_KEY, today)
      return
    }
    if (first !== today) {
      const lastFired = migrateLegacyKey(RETURN_FIRED_KEY, 'memoly_returning_fired_on')
      if (lastFired !== today) {
        localStorage.setItem(RETURN_FIRED_KEY, today)
        track('returning_user')
      }
    }
  } catch {
    /* localStorage 不可・計測失敗は無視 */
  }
}

// ----------------------------------------------------------------------------
// 収益コホート計装（撤退線＝2ヶ月継続率を見るためのイベント整合）
//   会社の課金ライフサイクルを Plausible カスタムイベントで揃える。これは後から
//   遡れない一次データなので、課金解禁(BILLING_ENABLED)前に名前と props 形を確定
//   させておく（解禁後すぐ正しいコホートが積み上がる）。
//
//   発火点の設計:
//     - subscription_started : checkout 成功で billing ページに戻ってきたとき
//       （?billing=success）。クライアントから1回だけ発火。plan を props に載せる。
//     - churned              : 解約フロー完走（または billing が canceled になった）時。
//     - payment_failed/recovered : サーバ(webhook)起点のため、Plausible の HTTP Events
//       API かサーバ計測が要る。本ヘルパは window.plausible 依存なので、当面は
//       「課金ページ表示時の status から派生計測」する trackBillingStatus を提供する
//       （past_due を観測したら payment_failed、past_due→active 復帰で payment_recovered）。
//   PII は載せない（plan/age_bucket など低カーディナリティのみ）。
// ----------------------------------------------------------------------------

/** 課金が確定（checkout 成功）したことを1回だけ計測する。重複発火はガードしない
 *  （呼び出し側で ?billing=success を1度だけ消費する想定）。plan は低カーディナリティ。 */
export function trackSubscriptionStarted(plan: string) {
  track('subscription_started', { plan })
}

/** 解約が確定したことを計測する（解約フロー完走 or billing canceled 観測）。 */
export function trackChurned(plan: string, reason: 'voluntary' | 'payment_failed' = 'voluntary') {
  track('churned', { plan, reason })
}

const BILLING_STATUS_KEY = 'banto_billing_last_status'

/**
 * 課金ステータスの遷移から payment_failed / payment_recovered を派生計測する。
 *   webhook はサーバ側でユーザーの window が無いため Plausible を直接叩けない。
 *   そこで「会社の課金ページ/シェルを開いたとき観測した status」を localStorage に
 *   保持し、前回との差分で遷移イベントを1回だけ発火する（過剰計測を避ける）。
 *     - active|trialing → past_due  : payment_failed
 *     - past_due       → active     : payment_recovered
 *     - * → canceled                : churned（reason 不明なので voluntary 既定）
 *   これにより撤退線（2ヶ月継続率）を出すためのイベントが揃う。
 */
export function trackBillingStatus(status: string, plan: string) {
  try {
    if (typeof window === 'undefined') return
    const prev = localStorage.getItem(BILLING_STATUS_KEY)
    if (prev === status) return // 変化なし＝計測しない
    localStorage.setItem(BILLING_STATUS_KEY, status)
    if (!prev) return // 初回観測は基準値の記録のみ（遷移ではない）
    if ((prev === 'active' || prev === 'trialing') && status === 'past_due') {
      track('payment_failed', { plan })
    } else if (prev === 'past_due' && (status === 'active' || status === 'trialing')) {
      track('payment_recovered', { plan })
    } else if (status === 'canceled') {
      track('churned', { plan, reason: 'voluntary' })
    }
  } catch {
    /* localStorage 不可・計測失敗は無視 */
  }
}

const COMPANY_FIRST_KEY = 'banto_company_first_seen'
const COMPANY_HEARTBEAT_KEY = 'banto_company_heartbeat_on'

/** account_age(日) を低カーディナリティのバケットに正規化（Plausible props 向け）。 */
function ageBucket(days: number): string {
  if (days <= 0) return 'd0'
  if (days === 1) return 'd1'
  if (days <= 3) return 'd2_3'
  if (days <= 7) return 'd4_7'
  if (days <= 14) return 'd8_14'
  if (days <= 30) return 'd15_30'
  return 'd31plus'
}

/**
 * 番頭(会社版)の cohort heartbeat。記憶moatの生死＝「使うほど離れない＝日齢が
 * 進んでも戻ってくるか」を測る一次データ。継続率は時系列を遡れないため早期計装
 * そのものが資産（後から作れない）。
 *
 * - 初回アクセス日を localStorage に記録し、以降の暦日アクセスで1日1回だけ
 *   company_heartbeat を発火（リロード過剰計測を避ける）。
 * - props は account_age_days（数値）と age_bucket（低カーディナリティ文字列）。
 *   PIIは一切載せない（件数・日齢のみ）。会社IDやユーザーIDも送らない。
 */
export function trackCompanyHeartbeat() {
  try {
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    let first = localStorage.getItem(COMPANY_FIRST_KEY)
    if (!first) {
      localStorage.setItem(COMPANY_FIRST_KEY, today)
      first = today
    }
    const lastFired = localStorage.getItem(COMPANY_HEARTBEAT_KEY)
    if (lastFired === today) return // 当日は計測済み
    localStorage.setItem(COMPANY_HEARTBEAT_KEY, today)
    const ageDays = Math.max(
      0,
      Math.round((Date.parse(today) - Date.parse(first)) / 86_400_000),
    )
    track('company_heartbeat', {
      account_age_days: ageDays,
      age_bucket: ageBucket(ageDays),
    })
  } catch {
    /* localStorage 不可・計測失敗は無視 */
  }
}
