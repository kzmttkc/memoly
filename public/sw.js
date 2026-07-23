// ============================================================================
// sw.js — 番頭(Banto) Service Worker（I10 PWA化・2026-07-23）
// ----------------------------------------------------------------------------
// 最小構成の方針（過剰なライブラリを入れない・Next.jsの生成物を壊さない）:
//   - プリキャッシュ: オフラインページ + アイコン等の不変静的アセットのみ。
//   - /_next/static/**（内容ハッシュ付き＝不変）: cache-first。
//   - /api/**: network-only（キャッシュしない。認証・レート制限・鮮度を壊さない）。
//   - ページ遷移(navigate): network-first。オフライン時は /offline.html を返す。
//   - その他はブラウザ既定に任せる（fetchを握らない＝安全側）。
// キャッシュ名の版数を上げると旧キャッシュは activate で掃除される。
// ============================================================================

const CACHE_VERSION = 'banto-v1'
const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 外部（Supabase/Plausible等）は触らない

  // API は network-only（オフライン時は素直に失敗させ、アプリ側のエラーハンドリングに任せる）
  if (url.pathname.startsWith('/api/')) return

  // Next の不変静的アセット: cache-first（内容ハッシュ付きファイル名＝安全に永続化できる）
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        cached =>
          cached ||
          fetch(req).then(res => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE_VERSION).then(cache => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // ページ遷移: network-first。オフライン時のみ簡易オフラインページへフォールバック
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/offline.html').then(cached => cached || Response.error()),
      ),
    )
    return
  }

  // プリキャッシュ済みの静的ファイル（アイコン等）: cache-first
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)))
  }
})
