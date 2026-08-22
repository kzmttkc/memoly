export const ZURE_RL_WINDOW_MS = 60 * 60 * 1000
export const ZURE_RL_MAX = 8

export function retryAfterSeconds(hits: number[], now: number): number | null {
  const recent = hits.filter(t => now - t < ZURE_RL_WINDOW_MS)
  if (recent.length < ZURE_RL_MAX) return null
  const oldest = Math.min(...recent)
  return Math.max(1, Math.ceil((oldest + ZURE_RL_WINDOW_MS - now) / 1000))
}

export function retainHits(hits: number[], now: number): number[] {
  return hits.filter(t => now - t < ZURE_RL_WINDOW_MS)
}

export function retryUntilMs(retryAfterHeader: string | null, now: number): number | null {
  if (!retryAfterHeader) return null
  const sec = Number(retryAfterHeader)
  if (!Number.isFinite(sec) || sec <= 0) return null
  return now + sec * 1000
}

export function retryWaitMessage(retryUntil: number, now: number): string | null {
  if (now >= retryUntil) return null
  const minutes = Math.max(1, Math.ceil((retryUntil - now) / 60_000))
  return `同じ回線から、1時間に${ZURE_RL_MAX}回までです。あと約${minutes}分してから、もう一度置いてください。`
}
