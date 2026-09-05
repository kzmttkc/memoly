// ずれ1枚の一時控え。登録前はサーバに残さない。
//   sessionStorage に加え、確認メールでタブが変わっても同じブラウザなら残るよう
//   localStorage にも 24 時間だけ控える。

export const PENDING_ZURE_KEY = 'banto_pending_zure'
export const PENDING_ZURE_TTL_MS = 24 * 60 * 60 * 1000
const TTL_MS = PENDING_ZURE_TTL_MS

export interface PendingZure {
  filename: string
  text: string
  unreadNote: string | null
  /** gap-engine の1枚。無い古い控えは UI 側で再生成する */
  gapSheet?: unknown
  /**
   * カスハラ10措置の照合結果（○△×）。
   * 2026-09-05 まで控えていたのは gapSheet だけで、開き直すと34項目は戻るのに
   * 10措置と規程追補案は16秒かけて回し直しだった。同じ控えに併せて残す。
   */
  measures?: unknown
  /** 規程追補案の差し込みに使う会社名。画面内だけで使い、サーバへは送らない。 */
  companyName?: string
  savedAt?: number
}

export function pendingRemainingHours(
  pending: Pick<PendingZure, 'savedAt'>,
  now = Date.now(),
): number | null {
  if (typeof pending.savedAt !== 'number') return null
  const left = PENDING_ZURE_TTL_MS - (now - pending.savedAt)
  if (left <= 0) return null
  return Math.max(1, Math.ceil(left / (60 * 60 * 1000)))
}

export function parsePendingRaw(raw: string | null, now = Date.now()): PendingZure | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingZure
    if (typeof parsed.filename !== 'string' || typeof parsed.text !== 'string') return null
    if (typeof parsed.savedAt === 'number' && now - parsed.savedAt > TTL_MS) return null
    return {
      filename: parsed.filename.slice(0, 200),
      text: parsed.text.slice(0, 100_000),
      unreadNote: typeof parsed.unreadNote === 'string' ? parsed.unreadNote : null,
      gapSheet: parsed.gapSheet,
      measures: Array.isArray(parsed.measures) ? parsed.measures : undefined,
      companyName:
        typeof parsed.companyName === 'string' ? parsed.companyName.slice(0, 60) : undefined,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : undefined,
    }
  } catch {
    return null
  }
}

export function readPendingFromStores(
  stores: Array<{ getItem(key: string): string | null }>,
  now = Date.now(),
): PendingZure | null {
  for (const store of stores) {
    try {
      const parsed = parsePendingRaw(store.getItem(PENDING_ZURE_KEY), now)
      if (parsed) return parsed
    } catch {
      /* 次の控えへ */
    }
  }
  return null
}

export function writePendingToStores(
  stores: Array<{ setItem(key: string, value: string): void }>,
  pending: PendingZure,
): boolean {
  const payload = JSON.stringify({ ...pending, savedAt: pending.savedAt ?? Date.now() })
  let any = false
  for (const store of stores) {
    try {
      store.setItem(PENDING_ZURE_KEY, payload)
      any = true
    } catch {
      /* 容量超過 */
    }
  }
  return any
}

export function clearPendingFromStores(stores: Array<{ removeItem(key: string): void }>): void {
  for (const store of stores) {
    try {
      store.removeItem(PENDING_ZURE_KEY)
    } catch {
      /* ignore */
    }
  }
}

function browserStores(): Array<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> {
  if (typeof window === 'undefined') return []
  const stores: Array<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> = []
  try {
    stores.push(sessionStorage)
  } catch {
    /* private mode */
  }
  try {
    stores.push(localStorage)
  } catch {
    /* private mode */
  }
  return stores
}

export function savePendingZure(pending: PendingZure): boolean {
  return writePendingToStores(browserStores(), pending)
}

export function readPendingZure(): PendingZure | null {
  return readPendingFromStores(browserStores())
}

/**
 * 既存の控えに項目を足す（本文・1枚は消さない）。
 * 控えが無ければ何もしない——本文の無い控えを作ると復元側で判別できなくなるため。
 */
export function updatePendingZure(patch: Partial<PendingZure>): boolean {
  const current = readPendingZure()
  if (!current) return false
  return writePendingToStores(browserStores(), { ...current, ...patch, savedAt: current.savedAt })
}

export function clearPendingZure(): void {
  clearPendingFromStores(browserStores())
}

export function documentTextFromPending(pending: PendingZure): string {
  const t = pending.text.trim()
  if (t) return t
  return `【未読】${pending.unreadNote ?? '本文を取れませんでした。'}`
}

export async function ingestPendingZure(companyId: string): Promise<boolean> {
  const pending = readPendingZure()
  if (!pending) return false
  const res = await fetch('/api/company/document/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId,
      title: pending.filename.replace(/\.[^.]+$/, '').slice(0, 100) || '就業規則',
      docType: '就業規則',
      documentText: documentTextFromPending(pending),
    }),
  })
  if (res.ok) clearPendingZure()
  return res.ok
}
