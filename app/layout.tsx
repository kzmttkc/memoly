import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { CookieBanner } from "@/components/ui/CookieBanner";

const geist = Geist({ subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://memoly-chat.vercel.app'
const DESC = '毎回ゼロから説明しなくていい。会話のたびにAIがあなたのことを深く覚えていくパーソナルAIアシスタント。'

export const metadata: Metadata = {
  title: "Memoly — あなたのことを覚えているAI",
  description: DESC,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Memoly",
  },
  openGraph: {
    title: "Memoly — あなたのことを覚えているAI",
    description: DESC,
    url: APP_URL,
    siteName: "Memoly",
    locale: "ja_JP",
    type: "website",
    images: [{ url: `${APP_URL}/og-image.png`, width: 1200, height: 630, alt: "Memoly" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Memoly — あなたのことを覚えているAI",
    description: DESC,
    site: "@takeshi_ai_jp",
    creator: "@takeshi_ai_jp",
    images: [`${APP_URL}/og-image.png`],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
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
      </head>
      <body className={`${geist.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
