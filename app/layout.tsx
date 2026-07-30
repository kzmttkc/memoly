import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { Clarity } from "@/components/analytics/Clarity";

// 欧文/数字は Geist(latin・軽量)。日本語は OS標準フォント
// (Hiragino Sans / Noto Sans JP / Yu Gothic)に委ねる。
// 2026-07-23 W3.5d LCP修正: 従来の next/font Noto_Sans_JP(400/500/700) は
// unicode-range 分割で woff2 41本・795KiB(総転送の68%)がクリティカル
// チェーンに載り、/business の LCP 7.4s(Render Delay 92%)の主因だった
// (Lighthouse 12 mobile simulate 実測・output/0723/banto_cwv_report.md)。
// Android の標準日本語フォントは Noto Sans JP そのもの、macOS/iOS は
// Hiragino Sans のため、見た目の劣化は最小。Webフォントを再導入する場合は
// 遅延適用(post-load swap)にすること。
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://banto-roumu.com'
const TITLE = '番頭(Banto) — 会社を覚える労務AI'
const DESC = '会社の規程・労務の判断を、AIが覚えて最適解を提供。汎用AIは毎回説明が必要。番頭は自社の規程を完璧に記憶。企業ごとにデータを完全分離して保管。'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITLE,
  description: DESC,
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  // 2026-07-23 Takeshi承認ブランド(L01): ファビコン一式。/favicon.ico は
  // app/favicon.ico をNextが自動配信する。maskable は manifest.json 側で宣言。
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "番頭",
  },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: APP_URL,
    siteName: "番頭(Banto)",
    locale: "ja_JP",
    type: "website",
    images: [{ url: `${APP_URL}/og-banto-main.png`, width: 1200, height: 630, alt: "番頭(Banto)" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    site: "@takeshi_ai_jp",
    creator: "@takeshi_ai_jp",
    images: [`${APP_URL}/og-banto-main.png`],
  },
};

export const viewport: Viewport = {
  // 2026-07-23 Takeshi承認ブランド(G05): 藍 #243B6E
  themeColor: "#243B6E",
};

// 2026-07-29 CTO修正（UX監査Round4#1・最重要）: Round1(L1)で横スクロール
// 安全網として html/body に overflow-x-hidden を追加したが、CSSの仕様上
// overflow-x に visible 以外の値（hidden/auto/scroll）を指定すると、
// overflow-y を明示していなくても used value が自動的に auto へ変わる
// （html/body の両方が独立したスクロールコンテナ化する）。これにより
// /business ヘッダの position:sticky の基準スクロールポートが body の
// （実際にはスクロールしない）内部スクロール領域に固定され、実際のページ
// スクロールは html 側で起きるため、ヘッダが画面外へ完全に流れ去っていた
// （Round4監査ペルソナ2・3通りの手法で実測確認）。overflow-x: clip は同じ
// spec上のカップリング規則の対象外（overflow-y は visible のまま）で横スクロール
// 抑止効果は同一のため、hidden→clip に変更してsticky破壊を解消する。
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 2026-07-30 PMF修理#3のメモ: /business/en /privacy/en /terms/en は本文が全文英語だが、
    //   <html> を出せるのはこのルートレイアウト1か所だけで、ここを経路に応じて出し分けるには
    //   headers() を読む必要があり、そうすると全ルート（SSGの42ページ）が動的レンダリングに
    //   落ちる。恒久対応は複数ルートレイアウト（route group ごとの root layout）への分割で、
    //   影響が広いため別作業に切り出した。それまでの間、英語版は各ページの最外 div に
    //   lang="en" を宣言している（HTML仕様上、最も近い祖先の lang が有効になる）。
    <html lang="ja" className={`h-full overflow-x-clip ${geist.variable}`}>
      <head>
        <Script
          defer
          src="https://plausible.io/js/pa-zK4ObFABW1NCS-rSYTlSn.js"
          strategy="afterInteractive"
        />
        {/* Plausible 手動初期化。CSP強化(script-src脱unsafe-inline)に備え、
            実行可能インラインを /plausible-init.js へ外部化（'self'で許可）。 */}
        <Script src="/plausible-init.js" strategy="afterInteractive" />
        {/* 会社版ダークモードの FOUC 防止。/company 配下でのみ <html data-theme> を
            初回ペイント前に確定する（実行可能インラインは置かず外部化＝CSP整合）。 */}
        <Script src="/banto-theme-init.js" strategy="beforeInteractive" />
        {/* I10 PWA化: Service Worker 登録（インライン禁止のCSPに合わせ外部化）。 */}
        <Script src="/sw-register.js" strategy="afterInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "番頭 (Banto)",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: DESC,
              url: APP_URL,
              inLanguage: "ja",
              offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
              publisher: { "@type": "Organization", name: "KIZUNA Creation" },
            }),
          }}
        />
      </head>
      <body className="font-sans bg-gray-950 text-gray-100 min-h-screen overflow-x-clip">
        {children}
        <CookieBanner />
        <Clarity />
      </body>
    </html>
  );
}
