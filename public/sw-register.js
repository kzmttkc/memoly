// Service Worker 登録（I10 PWA化・2026-07-23）。
// CSP（script-src 'self'）に整合させるため、インラインでなく外部ファイルで登録する
// （plausible-init.js / banto-theme-init.js と同じ流儀）。
// ★このスクリプトは next/script afterInteractive で読み込まれ、window の load イベント
//   より後に実行されることがある。load リスナーだけだと永遠に発火しないため、
//   readyState を見て「すでに load 済みなら即登録」する（2026-07-23 実測で検出・修正）。
(function () {
  if (!('serviceWorker' in navigator)) return
  function register() {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // 登録失敗（プライベートブラウジング等）はアプリ動作に影響させない
    })
  }
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register)
  }
})()
