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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://plausible.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://vitals.vercel-insights.com https://plausible.io",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
