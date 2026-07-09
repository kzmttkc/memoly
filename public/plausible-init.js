// Plausible 手動初期化スタブ（旧: app/layout.tsx のインライン <Script id="plausible-init">）。
// CSP から script-src の 'unsafe-inline' を将来外すため、自前の実行可能インラインを
// 外部ファイル化した（このファイルは 'self' で許可される）。挙動は従来と同一。
window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments) };
plausible.init = plausible.init || function () {};
plausible.init();
