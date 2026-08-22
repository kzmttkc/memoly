import type { NextConfig } from "next";

// 2026-07-30 UX監査 #2（重大）: 料金を探す来訪者が素朴に叩くURLが全部404だった
//   （実測: /pricing /plans /price /ryokin いずれも404・出口は「トップへ戻る」1本）。
//   別名3本を単独の料金ページへ 308（恒久・メソッド保持）で寄せる。
//
//   ★ /pricing 自体はここに書かない。next.config の redirects はファイルシステムの
//     ルートより**先に**評価されるため、/pricing を source に書くと
//     app/pricing/page.tsx（別班が新設・実測200）が永久に到達不能になる。
//     万一 /pricing ページを廃止するときは、この定数を "/business#pricing" に
//     戻したうえで /pricing の 308 をここへ足すこと。
const PRICING_DESTINATION = "/pricing";

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'mammoth'],
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
      // 退会・データ管理の発見性是正（persona05/07）: 素朴に /account を叩く動線を
      //   AppShell 配下の /company/account へ寄せる。認証状態に依存する薄い利便リダイレクト
      //   のため 307（一時）にする（将来 URL 構成を変えても取り消せる）。
      { source: "/account", destination: "/company/account", statusCode: 307 },
      // 料金URLの取りこぼし回収（2026-07-30 UX監査 #2）。
      { source: "/plans", destination: PRICING_DESTINATION, statusCode: 308 },
      { source: "/price", destination: PRICING_DESTINATION, statusCode: 308 },
      { source: "/ryokin", destination: PRICING_DESTINATION, statusCode: 308 },
    ];
  },
  async headers() {
    // 外部許可ホスト群（enforce と report-only で共有）。
    //   plausible=解析（実際に発火・/security /privacy に開示済み）。
    //
    // ★clarity.ms / *.sentry.io は CSP から撤去した（2026-07-24 persona04 是正）。
    //   両者は env 未設定で現状 no-op（実データ送信ゼロ・本番HTMLに痕跡なし）だったが、
    //   /security・/privacy の委託先一覧に未記載のまま CSP だけ先行許可していた。
    //   「未使用ホストの先行許可」は攻撃面を無駄に広げるだけなので、有効化まで許可しない。
    //
    //   ⚠️再有効化ルール（将来 Clarity/Sentry を使うとき・必ず同時に行うこと）:
    //     1. scriptHosts / connectHosts に該当ホストを戻す。
    //        - Clarity: script-src に https://www.clarity.ms https://*.clarity.ms、
    //          connect-src に https://*.clarity.ms
    //        - Sentry:  connect-src に https://*.sentry.io https://*.ingest.sentry.io
    //     2. **同じPRで** app/security（委託先一覧）と app/privacy（第3条 提供先）に
    //        Microsoft Clarity / Sentry を追記する。開示追記なしに有効化すると開示違反になる。
    //     （関連コンポーネントは env 未設定なら no-op のまま残置＝components/analytics/Clarity.tsx,
    //       instrumentation.ts。CSPを戻すだけでは発火せず、env 投入で初めて動く。）
    const scriptHosts = "https://plausible.io";
    const connectHosts =
      "https://*.supabase.co https://api.anthropic.com https://vitals.vercel-insights.com " +
      "https://plausible.io";

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
    //
    // ★2026-08-13 実測（推測ではなく実験した。同じ検討を繰り返さないために残す）:
    //   前提の訂正: 「report-only を7日運用して violation 0 なら enforce へ昇格」という
    //   移行計画は**成立しない**。下の report-only は 2026-07-10 から本番で34日走っていて、
    //   Playwright で実測した違反数は 0 ではなく **/ 54件・/faq 23件・/security 16件・
    //   /login 8件（すべて script-src-elem の inline）**。正体は Next の RSC ペイロード
    //   (`self.__next_f.push(...)`) で、これは待っても消えない。時間の問題ではない。
    //
    //   nonce + strict-dynamic を worktree で実装して本番相当ビルドを起動し、
    //   ヘッダの nonce と HTML の nonce を同一レスポンス内で突き合わせた結果:
    //     動的レンダリング  /business(inline 60/nonce 54) /pricing(24/20) /company(10/8) … 一致
    //     静的プリレンダ    /faq(27/0) /security(18/0) /privacy(19/0) /roumu(38/0) … **不一致**
    //       （x-nextjs-cache: HIT ＝ ビルド時のHTMLをそのまま返すため nonce が入らない）
    //   つまり撤去には全ページの動的化が要る。番頭の最大の資産は /roumu 33本ほかの
    //   検索面（GSC 週418表示）で、これを毎リクエストSSRへ落とす代償は +2点に見合わない。
    //   ハッシュ列挙も検討したが、ページ×ビルドごとに変わる 18〜38 本を経路別ヘッダで
    //   配るのは「静かに壊れる」経路を新設するだけなので採らない。
    //
    //   **撤去の条件（これが満たされたら再評価する）**:
    //     (a) Next が静的プリレンダHTMLの inline script ハッシュを標準出力するようになる、
    //     (b) または /roumu・/blog を含む検索面の動的化を経営判断として受け入れる。
    //   それまでは 'unsafe-inline' を残す。tests/unit/csp-policy.test.ts が、
    //   nonce の配線が無いまま enforce から 'unsafe-inline' を外すことを機械で止める。
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
