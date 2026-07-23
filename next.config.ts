import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // $HOME直下の迷子package-lock.jsonをワークスペースルートと誤検出し
  // dev(Turbopack)がモジュール解決に失敗するため明示
  turbopack: {
    root: __dirname,
  },
  // JSバンドル削減: lucide-react はアイコンごとに named import しているが、
  //   optimizePackageImports でバレル経由の巻き込みを確実に切り、必要アイコンだけを
  //   個別モジュールとして取り込む（tree-shake の取りこぼしを防ぐ）。
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // 個人版Memolyの残骸URL閉鎖（2026-07-09 TOP10⑦衛生タスク）:
  //   /memory・/chat は会社スコープ移行前の個人版UI。既存ユーザー0のため
  //   保護（データ移行・案内）は不要で、直URLは会社ダッシュボードへ301で永久移転する。
  //   next.config の redirects は middleware より先に評価されるため、
  //   middleware の PROTECTED_PREFIXES からも外してある（到達しない）。
  async redirects() {
    return [
      { source: "/memory", destination: "/company", statusCode: 301 },
      { source: "/memory/:path*", destination: "/company", statusCode: 301 },
      { source: "/chat", destination: "/company", statusCode: 301 },
      { source: "/chat/:path*", destination: "/company", statusCode: 301 },
    ];
  },
  async headers() {
    // 外部許可ホスト群（enforce と report-only で共有）。
    //   plausible=解析 / clarity=セッションリプレイ(任意・env未設定なら未ロード) /
    //   sentry=エラー収集(任意・DSN未設定なら未送信)。ホスト許可だけでは何もロードしないため、
    //   先に列挙しておけば env 投入時に CSP 変更なしで有効化できる（no-op許可）。
    const scriptHosts = "https://plausible.io https://www.clarity.ms https://*.clarity.ms";
    const connectHosts =
      "https://*.supabase.co https://api.anthropic.com https://vitals.vercel-insights.com " +
      "https://plausible.io https://*.clarity.ms https://*.sentry.io https://*.ingest.sentry.io";

    // 現行(enforce): Next.js のフレームワーク製インラインscript/styleが残るため
    //   script-src/style-src の 'unsafe-inline' は当面維持（外すと即クラッシュ）。
    //   自前の実行可能インライン(plausible-init)は /plausible-init.js へ外部化済。
    //
    // ★nonce/strict-dynamic へ移行しない理由（2026-07-23 F03 判断・実測に基づく）:
    //   本アプリは /company 配下を含む全ページが静的プリレンダ（build 出力で ○ Static）。
    //   per-request nonce は静的HTMLに埋め込めず、移行には全ルートの動的レンダリング化
    //   （毎リクエストSSR＝速度・コスト退行を伴う大規模アーキテクチャ変更）が必要。
    //   hash 方式も Next のフレームワーク製インライン（self.__next_f.push …）が
    //   ページ・ビルドごとに変わるため列挙不能。よって script-src の 'unsafe-inline' は
    //   維持しつつ、次の「壊れない範囲の最大強化」を enforce する:
    //     - script-src-attr 'none': インラインイベントハンドラ(onclick=等)を全面禁止。
    //       属性注入型XSSの実行経路を塞ぐ（React は addEventListener 経由なので無影響）。
    //     - object-src 'none' / base-uri 'self' / form-action 'self' / frame-src 'none':
    //       プラグイン実行・<base>すり替え・フォーム送信先すり替え・iframe埋込を禁止
    //       （リポジトリ全走査で iframe / 外部フォーム送信は不使用と確認済み）。
    //     - upgrade-insecure-requests: 混在コンテンツを https へ昇格。
    //   'unsafe-inline' の完全撤去は、Next が静的ページの inline script hash 出力を
    //   標準サポートするか、動的化の意思決定をした時点で再評価する。
    const enforced = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${scriptHosts}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      `connect-src 'self' ${connectHosts}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    // 目標(report-only・並走): script-src/style-src から 'unsafe-inline' を外した厳格版。
    //   enforce しない＝画面は壊さない。違反は /api/csp-report に集まり、残るインラインの
    //   正体(=Next フレームワーク製)を定量化する。将来 nonce/strict-dynamic 方式へ移行する
    //   判断材料（静的ページの動的化トレードオフ）を測るための計測レーン。
    const reportOnly = [
      "default-src 'self'",
      `script-src 'self' ${scriptHosts}`,
      "script-src-attr 'none'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      `connect-src 'self' ${connectHosts}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS（F04・2026-07-23 明示化）: 従来は Vercel が既定付与する
          //   max-age=63072000 に暗黙依存していた。ホスティング既定への依存をやめ、
          //   includeSubDomains を付けてコードで明示する。
          //   サブドメイン実測（dig/curl 2026-07-23）: www=Vercel CNAME で https 正常
          //   （308→apex）。他に HTTP を話すサブドメインは存在しない（MX/DKIM は対象外）。
          //   preload は今回見送り: preload リストへの登録は取り消しがほぼ不可逆で、
          //   将来サブドメインで http が必要になった場合に全断リスクがあるため、
          //   運用が安定してから別途意思決定する。
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Reporting API(新形式)の宛先。report-only の report-to から参照。
          { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
          { key: "Content-Security-Policy", value: enforced },
          { key: "Content-Security-Policy-Report-Only", value: reportOnly },
        ],
      },
    ];
  },
};

export default nextConfig;
