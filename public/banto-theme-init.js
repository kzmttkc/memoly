/*
 * banto-theme-init.js — 番頭 会社版のダークモード FOUC 防止（同期初期化）。
 * ----------------------------------------------------------------------------
 *   root layout から <Script strategy="beforeInteractive"> で読み込む。
 *   CSP強化(script-src 脱 unsafe-inline)に備え、実行可能インラインは置かず外部化する
 *   （/plausible-init.js と同じ流儀・'self' で許可）。
 *
 *   /company 配下でのみ <html data-theme="light|dark"> を初回ペイント前に確定する。
 *   保存値(localStorage 'banto-theme' = 'light'|'dark'|'system'、既定 system)を
 *   実効テーマへ解決して属性付与。CSS は [data-theme='dark'] .company-light に限定される
 *   ため、他ルートへ属性が付いても副作用はない（保険で pathname ガードも掛ける）。
 */
(function () {
  try {
    if (typeof location === 'undefined') return
    if (location.pathname.indexOf('/company') !== 0) return
    var pref = null
    try {
      pref = localStorage.getItem('banto-theme')
    } catch (e) {
      /* localStorage 不可（プライベート等）は system 扱い */
    }
    if (pref !== 'light' && pref !== 'dark') pref = 'system'
    var dark =
      pref === 'dark' ||
      (pref === 'system' &&
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch (e) {
    /* 何が起きても描画は止めない */
  }
})()
