import type { Metadata } from 'next'

// ============================================================================
// 無料セルフ点検ツール 共通シャーシ（SEO/構造化データ部）
//   実在2ツール（yukyu-5nichi-check / 36kyotei-jougen-check）の page.tsx から
//   文字どおり共通だった部分だけを抽出した。新ツールは「コンテンツ差分だけ」
//   （タイトル・説明文・FAQ・featureList）を渡せば同じ品質のヘッダが揃う。
//
//   共通化の範囲（実在2本の実態から抽出・先回り設計はしない）:
//     - metadata: title / description / canonical / OGP / twitter（構造は完全一致だった）
//     - JSON-LD: FAQPage / BreadcrumbList / SoftwareApplication(price:0)
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。
//   評価系(aggregateRating/review)は実データ無しのため一切持たせない（捏造禁止）。
// ============================================================================

export const TOOLS_BASE = 'https://banto-roumu.com'

export type ToolFaq = { q: string; a: string }

export function toolUrl(slug: string): string {
  return `${TOOLS_BASE}/tools/${slug}`
}

export type ToolSeoDef = {
  /** /tools/{slug} */
  slug: string
  /** <title> / og:title / twitter:title（3か所共通だったため1つ） */
  title: string
  /** meta description */
  description: string
  /** og:description（既存2本とも meta と文面を変えていたため別プロパティ） */
  ogDescription: string
  /** twitter:description（同上・短め） */
  twitterDescription: string
  /** og:image の alt（ツール名） */
  ogImageAlt: string
}

export function buildToolMetadata(def: ToolSeoDef): Metadata {
  const url = toolUrl(def.slug)
  return {
    title: def.title,
    description: def.description,
    alternates: { canonical: url },
    openGraph: {
      title: def.title,
      description: def.ogDescription,
      url,
      siteName: '番頭(Banto)',
      locale: 'ja_JP',
      type: 'website',
      images: [{ url: `${TOOLS_BASE}/og-image.png`, width: 1200, height: 630, alt: def.ogImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: def.title,
      description: def.twitterDescription,
      images: [`${TOOLS_BASE}/og-image.png`],
    },
  }
}

export type ToolJsonLdDef = {
  slug: string
  /** BreadcrumbList 末端のツール名 */
  breadcrumbName: string
  /** SoftwareApplication.name（可視H1と一致させる） */
  name: string
  /** SoftwareApplication.description（可視リード文と一致させる） */
  description: string
  /** SoftwareApplication.featureList（可視ページ内容と一致させる） */
  featureList: string[]
  /** FAQPage（本文FAQと共用＝可視一致） */
  faqs: ToolFaq[]
}

/** FAQPage / BreadcrumbList / SoftwareApplication(price:0) の3点セットを返す。 */
export function buildToolJsonLd(def: ToolJsonLdDef): Record<string, unknown>[] {
  const url = toolUrl(def.slug)

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: def.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '番頭(Banto)', item: `${TOOLS_BASE}/business` },
      { '@type': 'ListItem', position: 2, name: '無料ツール', item: url },
      { '@type': 'ListItem', position: 3, name: def.breadcrumbName, item: url },
    ],
  }

  // SoftwareApplication（無料Webツールの価格シグナル）。
  //   @id/url をツール固有URLにして global の SaaS エンティティと衝突させない。
  //   name/description/featureList は可視ページ内容と一致させる（Google構造化=可視一致要件）。
  const softwareAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': url,
    url,
    name: def.name,
    description: def.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    featureList: def.featureList,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
  }

  return [faqJsonLd, breadcrumbJsonLd, softwareAppJsonLd]
}
