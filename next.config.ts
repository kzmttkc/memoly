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
    const enforced = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${scriptHosts}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      `connect-src 'self' ${connectHosts}`,
      "frame-ancestors 'none'",
    ].join("; ");

    // 目標(report-only・並走): script-src/style-src から 'unsafe-inline' を外した厳格版。
    //   enforce しない＝画面は壊さない。違反は /api/csp-report に集まり、残るインラインの
    //   正体(=Next フレームワーク製)を定量化する。将来 nonce/strict-dynamic 方式へ移行する
    //   判断材料（静的ページの動的化トレードオフ）を測るための計測レーン。
    const reportOnly = [
      "default-src 'self'",
      `script-src 'self' ${scriptHosts}`,
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      `connect-src 'self' ${connectHosts}`,
      "frame-ancestors 'none'",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
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
