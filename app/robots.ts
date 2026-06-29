import type { MetadataRoute } from 'next'

// ============================================================================
// robots.txt — クロール許可/不許可とsitemapの所在を伝える。
//   認証保護ルート（/company /chat /memory）とAPIはindex不要のためdisallow。
//   公開LP（/business /privacy /terms）はallow。
// ============================================================================
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/company/', '/chat', '/memory', '/api/'],
    },
    sitemap: 'https://banto-roumu.com/sitemap.xml',
    host: 'https://banto-roumu.com',
  }
}
