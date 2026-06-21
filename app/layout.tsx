import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://memoly-chat.vercel.app'

export const metadata: Metadata = {
  title: "Memoly — あなたのことを覚えているAI",
  description: "毎回ゼロから説明しなくていい。会話のたびにAIがあなたのことを深く覚えていくパーソナルAIアシスタント。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Memoly",
  },
  openGraph: {
    title: "Memoly — あなたのことを覚えているAI",
    description: "毎回ゼロから説明しなくていい。会話のたびにAIがあなたのことを深く覚えていくパーソナルAIアシスタント。",
    url: APP_URL,
    siteName: "Memoly",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memoly — あなたのことを覚えているAI",
    description: "毎回ゼロから説明しなくていい。会話のたびにAIがあなたのことを深く覚えていくパーソナルAIアシスタント。",
    site: "@takeshi_ai_jp",
    creator: "@takeshi_ai_jp",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${geist.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
