import type { MetadataRoute } from 'next'

// ============================================================================
// robots.txt — クロール許可/不許可とsitemapの所在を伝える。
//   認証保護ルート（/company /chat /memory）とAPIはindex不要のためdisallow。
//   公開LP（/business /privacy /terms）はallow。
//
//   2026-08-09 SEO/AEO/LLMO監査: 従来は `userAgent: '*'` 1本のみで、主要AI
//   クローラー（GPTBot/ChatGPT-User/anthropic-ai/ClaudeBot/PerplexityBot/
//   Google-Extended/Applebot-Extended）への明示的なallowが0件だった。
//   ワイルドカードのallow '/' は上記も暗黙に許可してはいるが、LLM回答への
//   引用（LLMO）を狙う以上、将来デフォルトdisallow方針に振れた場合の
//   フェイルセーフとして各UAを明示する。disallow対象は全UA共通。
// ============================================================================
const DISALLOW = ['/company/', '/chat', '/memory', '/api/']
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'anthropic-ai',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://banto-roumu.com/sitemap.xml',
    host: 'https://banto-roumu.com',
  }
}
