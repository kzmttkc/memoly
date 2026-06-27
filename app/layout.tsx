import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { CookieBanner } from "@/components/ui/CookieBanner";

// 欧文/数字は Geist、日本語は Noto Sans JP。両方を CSS 変数で公開し
// globals.css の --font-sans フォールバックスタックから参照する。
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-jp",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://memoly-chat.vercel.app'
const TITLE = '番頭(Banto) — 会社を覚える労務AI'
const DESC = '会社の規程・労務の判断を、AIが覚えて最適解を提供。汎用AIは毎回説明が必要。番頭は自社の規程を完璧に記憶。企業ごとにデータを完全分離して保管。'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITLE,
  description: DESC,
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
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
    images: [{ url: `${APP_URL}/og-image.png`, width: 1200, height: 630, alt: "番頭(Banto)" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    site: "@takeshi_ai_jp",
    creator: "@takeshi_ai_jp",
    images: [`${APP_URL}/og-image.png`],
  },
};

export const viewport: Viewport = {
  themeColor: "#324a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`h-full ${geist.variable} ${notoSansJP.variable}`}>
      <head>
        <Script
          defer
          src="https://plausible.io/js/pa-zK4ObFABW1NCS-rSYTlSn.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">{`
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};
          plausible.init=plausible.init||function(){};
        `}</Script>
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
              publisher: { "@type": "Organization", name: "Kizuna Creation" },
            }),
          }}
        />
      </head>
      <body className="font-sans bg-gray-950 text-gray-100 min-h-screen">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
