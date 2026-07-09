import type { MetadataRoute } from 'next'
import { USECASE_SLUGS } from '@/lib/usecase'

// ============================================================================
// sitemap.xml — クローラに「index対象の公開URL」を明示する。
//   番頭の公開ルートのみ。/（=/businessへredirect）と /company 配下
//   （middlewareで認証保護＝307）は載せない。canonical は /business に統一。
//   /roumu/* は検索意図LP（SSG・公開）。SSOT(lib/usecase.ts)から全列挙する。
// ============================================================================
const BASE = 'https://banto-roumu.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/business`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/tools/yukyu-5nichi-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/tools/36kyotei-jougen-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/tools/zangyodai-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/tools/syaho-kanyu-taisho-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/tools/jyunan-hatarakikata-check`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    ...USECASE_SLUGS.map((slug) => ({
      url: `${BASE}/roumu/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
