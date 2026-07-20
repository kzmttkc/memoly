import type { MetadataRoute } from 'next'
import { USECASE_SLUGS } from '@/lib/usecase'
import { TOOL_SLUGS } from '@/lib/tools'

// ============================================================================
// sitemap.xml — クローラに「index対象の公開URL」を明示する。
//   番頭の公開ルートのみ。/（=/businessへredirect）と /company 配下
//   （middlewareで認証保護＝307）は載せない。canonical は /business に統一。
//   /roumu（ハブ）＋ /roumu/* は検索意図LP（SSG・公開）。SSOT(lib/usecase.ts)から全列挙する。
//
//   lastModified の方針（2026-07-14 是正）: 以前は全URLに `new Date()`（ビルド時の現在時刻）を
//   出していた。これだとデプロイのたびに全URLの lastmod が一斉に「今」へ動き、Google は
//   lastmod を信頼せずクロール優先度の判定から外す（＝シグナルが実質無効化）。
//   そこで「そのURL群を実際に substantive に改訂した日」の固定値に置き換える。
//   クラスタの内容を実質的に改訂したら、対応する定数を手で更新する（コミット時に上げる）。
// ============================================================================
const BASE = 'https://banto-roumu.com'

// 各URL群の「最終の実質改訂日」（プロジェクト履歴の実在する改訂境界）。
//   内容を実質改訂したらここを上げる。ビルドごとには動かさない＝lastmod をクローラが信頼できる。
const REVISED = {
  business: '2026-07-13', // ヒーローH1のA/B・LPコピー反復
  tools: '2026-06-29', // 無料ツールクラスタ整備
  roumu: '2026-07-19', // 底面ファネル語「労務管理システム 費用 比較」LP追加
  legal: '2026-06-28', // privacy / terms
  tokushoho: '2026-07-20', // 特定商取引法に基づく表記を新設
} as const

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/business`, lastModified: REVISED.business, changeFrequency: 'weekly', priority: 1.0 },
    // 無料ツール一覧（ハブ）＋各ツール（SSOT: lib/tools.ts から全列挙）
    { url: `${BASE}/tools`, lastModified: REVISED.tools, changeFrequency: 'monthly', priority: 0.8 },
    ...TOOL_SLUGS.map((slug) => ({
      url: `${BASE}/tools/${slug}`,
      lastModified: REVISED.tools,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // 目的別の使い方（ハブ・キーストーン）＋各検索意図LP
    { url: `${BASE}/roumu`, lastModified: REVISED.roumu, changeFrequency: 'weekly', priority: 0.9 },
    ...USECASE_SLUGS.map((slug) => ({
      url: `${BASE}/roumu/${slug}`,
      lastModified: REVISED.roumu,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${BASE}/privacy`, lastModified: REVISED.legal, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: REVISED.legal, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/tokushoho`, lastModified: REVISED.tokushoho, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
