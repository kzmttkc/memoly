// ============================================================================
// 無料セルフ点検ツールの登録簿（SSOT）
//   /tools 一覧ページ・各ツールの相互リンク（ToolPageShell）・sitemap が
//   同じ一覧を参照するための単一の出所。ツールを増やすときはここに1件足せば、
//   一覧・相互リンク・サイトマップの3面が自動で揃う。
//
//   目的（2026-07-12・SEO内部リンク強化）: /tools/* 5本が内部リンク不足で
//   クロールされずインデックスされていない。ツール同士を相互リンクし、
//   一覧（ハブ）を新設して /business・/roumu から接続することで、
//   クロール経路を確立する（未インデックス解消と未発芽改善に同時に効く）。
//
//   Phase1 厳守:「社労士監修 / AI社労士 / 法的精度」不使用。断定的な個別助言を
//   しない。文言は誇大にせず、敬体で自然に。太字（markdown bold）は使わない。
// ============================================================================

export type ToolEntry = {
  /** /tools/{slug} */
  slug: string
  /** チップ・相互リンク用の短い呼び名 */
  label: string
  /** 一覧カードの見出し（そのツールで何ができるか） */
  name: string
  /** 一覧カードの一文説明（誇大にしない・敬体） */
  blurb: string
  /** 内容が対応する解説記事 /roumu/{slug}（相互リンクの参照用） */
  relatedRoumuSlug: string
}

export const TOOL_LIST: ToolEntry[] = [
  {
    slug: 'yukyu-5nichi-check',
    label: '年5日の有給取得義務',
    name: '年5日の有給取得義務をセルフ点検する',
    blurb:
      '基準日とこれまでに取得した日数を入れると、年5日の取得義務を満たしているか、あと何日必要か、期限はいつかを画面で確認できます。',
    relatedRoumuSlug: 'yukyu-5nichi-gimu',
  },
  {
    slug: '36kyotei-jougen-check',
    label: '36協定の上限',
    name: '36協定の時間外・休日労働の上限をセルフ点検する',
    blurb:
      '自社の残業の実績を分かる範囲で入れると、月45時間・年360時間や特別条項の上限に照らして、確認が要りそうな箇所を整理できます。',
    relatedRoumuSlug: '36kyotei-jougen',
  },
  {
    slug: 'zangyodai-check',
    label: '残業代の計算',
    name: '残業代の計算が合っているかセルフ点検する',
    blurb:
      '月給と残業・休日・深夜の時間数を入れると、法律の割増率で計算した最低ラインの目安がわかります。支払った額を入れれば差額も確認できます。',
    relatedRoumuSlug: 'roudou-jikan-kyakkanteki-haaku',
  },
  {
    slug: 'syaho-kanyu-taisho-check',
    label: 'パートの社会保険加入',
    name: 'パート従業員が社会保険の加入対象かセルフ点検する',
    blurb:
      '週の所定労働時間や賃金などを入れると、5つの加入要件に照らして、その従業員が社会保険の加入対象になるかを確認できます。',
    relatedRoumuSlug: 'kabe-106man-shanai-taiou',
  },
  {
    slug: 'jyunan-hatarakikata-check',
    label: '柔軟な働き方の措置',
    name: '柔軟な働き方を実現するための措置をセルフ点検する',
    blurb:
      '2025年10月に義務化された「柔軟な働き方を実現するための措置」について、自社が要件どおりに講じているかを整理できます。',
    relatedRoumuSlug: 'ikuji-kaigo-kaisei',
  },
]

export const TOOL_SLUGS = TOOL_LIST.map((t) => t.slug)

export function getTool(slug: string): ToolEntry | undefined {
  return TOOL_LIST.find((t) => t.slug === slug)
}
