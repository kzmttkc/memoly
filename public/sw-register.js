// Service Worker 登録（I10 PWA化・2026-07-23）。
// CSP（script-src 'self'）に整合させるため、インラインでなく外部ファイルで登録する
// （plausible-init.js / banto-theme-init.js と同じ流儀）。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // 登録失敗（プライベートブラウジング等）はアプリ動作に影響させない
    })
  })
}
