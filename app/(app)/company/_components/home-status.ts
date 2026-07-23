'use client'

// ============================================================================
// home-status.ts — /api/company/home-status の共有フェッチ（モジュールキャッシュ）。
//   ホームには home-status を読むコンポーネントが複数ある（HomeEngagement と
//   TimeSavedEstimate）。素朴に各自 fetch すると同一APIを1画面で2回叩き、
//   DBのcountクエリも倍になる。ここで in-flight Promise を短TTLで共有し、
//   1画面1リクエストに保つ（機能追加でホームのAPI負荷を増やさない）。
// ============================================================================

export interface HomeStatus {
  risk: {
    count: number
    latest: { overall: number; at: string } | null
    previous: { overall: number; at: string } | null
  }
  ruleDocs: number
  /** C10: company_memories の総件数（活性化v2「記憶1件+相談1回」の判定素材）。 */
  memories: number
  consult: { userMessageCount: number; consultDays: number; streak: number }
  deadlines: { id: string; title: string; dueOn: string }[]
}

const TTL_MS = 30_000
const cache = new Map<string, { at: number; promise: Promise<HomeStatus> }>()

/** home-status を取得する（同一 companyId は 30秒間、同一 Promise を共有）。 */
export function fetchHomeStatus(companyId: string): Promise<HomeStatus> {
  const hit = cache.get(companyId)
  const now = Date.now()
  if (hit && now - hit.at < TTL_MS) return hit.promise
  const promise = fetch(`/api/company/home-status?companyId=${companyId}`).then(res =>
    res.ok ? (res.json() as Promise<HomeStatus>) : Promise.reject(new Error(String(res.status))),
  )
  // 失敗した Promise をキャッシュに残すと30秒間ホームが全滅するため、失敗時は即座に破棄。
  promise.catch(() => {
    const cur = cache.get(companyId)
    if (cur && cur.promise === promise) cache.delete(companyId)
  })
  cache.set(companyId, { at: now, promise })
  return promise
}
