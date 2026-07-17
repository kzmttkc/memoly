// Plausible 手動初期化スタブ（旧: app/layout.tsx のインライン <Script id="plausible-init">）。
// CSP から script-src の 'unsafe-inline' を将来外すため、自前の実行可能インラインを
// 外部ファイル化した（このファイルは 'self' で許可される）。
//
// 2026-07-17 修正（計測欠落バグ・CTO 実測）:
//   旧実装は `plausible.init = plausible.init || function () {}; plausible.init();` だった。
//   これは本スクリプトが pa-*.js より先に実行された場合（＝キャッシュが冷たい初回訪問で
//   高頻度に起きる。同一オリジンの本ファイルの方が remote の plausible.io より速い）に
//   「何もしない init」を自前で埋め込み、それを呼んで終わっていた。
//   pa-*.js は末尾で `window.plausible = window.plausible || {}, plausible.o && S(plausible.o),
//   plausible.init = S` を実行する＝ plausible.o が無いと自動 init せず、実 init(S) は
//   代入されるだけで誰も呼ばない。結果 window.plausible はキュー投入スタブのまま残り、
//   pageview もカスタムイベントも1本も送信されずキューに死蔵された（実測: 冷キャッシュで
//   約1/6〜1/3 のセッションが計測を全喪失。初回訪問者ほど当たりやすい＝登録ファネルの
//   母数が過少計上されていた）。
//
//   修正方針＝ロード順のどちらでも実 init に必ず到達させる:
//     - pa-*.js が先着 → plausible.init は実体(S)。そのまま呼ぶ。
//     - 本ファイルが先着 → plausible.o に設定を置く。pa-*.js がロード時に自動で S(o) を
//       呼び、スタブのキュー(q)を drain してから window.plausible を実体へ差し替える。
//   no-op を自前で代入しないことが肝（実 init を握り潰さない）。
(function () {
  var w = window;

  // 実スクリプトより先に track() が呼ばれても落ちないよう、必ず「呼べる」スタブを用意する。
  // pa-*.js が先着していた場合 window.plausible は {}（関数でない）なので、その場合も
  // 関数スタブへ差し替えつつ、既に載っている init / o は引き継ぐ（実体を失わない）。
  if (typeof w.plausible !== 'function') {
    var prev = w.plausible;
    w.plausible = function () { (w.plausible.q = w.plausible.q || []).push(arguments) };
    if (prev && prev.q) w.plausible.q = prev.q;
    if (prev && prev.init) w.plausible.init = prev.init;
    if (prev && prev.o) w.plausible.o = prev.o;
  }

  if (typeof w.plausible.init === 'function') {
    // pa-*.js が先にロード済み＝これは実 init(S)。呼べばキューを drain して実体化する。
    w.plausible.init();
  } else {
    // pa-*.js は未ロード。設定を置いておけば、ロード時に自動で init される
    // （pa-*.js 末尾の `plausible.o && S(plausible.o)`）。no-op init は絶対に置かない。
    w.plausible.o = w.plausible.o || {};
  }
})();
