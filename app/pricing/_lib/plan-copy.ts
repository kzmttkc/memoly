import { PLANS } from '@/lib/plans'

// ============================================================================
// PLAN_COPY — 料金カードの訴求コピー（/pricing と /business#pricing の共有SSOT）
// ----------------------------------------------------------------------------
//   2026-07-30 PMF修理#1で app/business/page.tsx からここへ移設した。
//   単独の料金ページ /pricing を新設するにあたり、同じ内容を2枚のページで
//   二重管理すると「LPの価格」と「料金ページの価格」が将来必ずずれる。
//   金額・席数・上限は従来どおり lib/plans.ts（課金の正本）から引き、
//   LP固有の訴求文（tagline/features/badge/cta）だけをこのファイルが持つ。
//   /business と /pricing の両方がこの1か所を読む。
// ============================================================================

// 表示名・価格・主役(featured)・年額は lib/plans.ts（SSOT）から引く。LP固有の訴求コピー
// （tagline/features/badge）だけをここで持つ。これにより「価格・主役が LP と課金で
// 食い違う」事故を構造的に防ぐ（2026-06-29 Takeshi承認: Entryが主役・年額¥39,800）。
// 課金単位の確定表記（SSOT: docs/BANTO_BILLING_GATE.md §4・§5）:
//   Entry/Standard = 会社単位の月額（プランの上限人数まで追加料金なし）。
//   士業のみ席（シート）単位 = 事務所の利用メンバー数に応じて課金。
//   利用回数・上限人数は lib/plans.ts の実装値から直接埋め込む（表示と実装の乖離を構造的に防ぐ）。
//   anchor（E12・2026-07-23）: 価格アンカーは「自社事実のみ」型（output/0723/banto_pricing_anchor_copy.md 案A）。
//     外部価格（社労士相談の相場等）は出典を示せず有利誤認リスク＋社労士法27条配慮に反するため
//     主語にしない。1日あたりの金額は monthlyJpy÷31 の割り算のみ（検証可能・誇張ゼロ）。
//   有料CTAの signupHref（plan=）は購買意思の受け皿なので残す。カード下のファイル導線は
//   登録の前に入口を試せるようにする（獲得の顔は /zure）。
export const PLAN_FILE_FIRST = {
  href: '/zure',
  label: '先に就業規則のファイルを置く',
} as const

export const PLAN_COPY = [
  {
    name: PLANS.starter.displayName,
    price: PLANS.starter.monthlyJpy.toLocaleString(),
    unit: `/月（1社あたり・${PLANS.starter.seatCap}名まで）`,
    yearly: PLANS.starter.yearlyJpy,
    tagline: 'まず使ってみる',
    badge: 'おすすめ',
    // 2026-07-30 PMF修理#4: 士業だけに載せていた plan= を Entry/Standard にも配線する。
    // これ以前は signupHref: undefined ＝ TrackedCTA 既定の /signup?next=/company に
    // 落ち、「Entryで始める」を押した意思が signup 画面に1つも残らなかった
    // （受け皿は signup 側に既存: planParam を /company・onboarding まで持ち回る）。
    signupHref: '/signup?next=/company&plan=starter' as string | undefined,
    anchor: `1日あたり約${Math.round(PLANS.starter.monthlyJpy / 31)}円で、労務の調べ物と記録をいつでも任せられます。`,
    // 2026-07-23 B17: CTA文言をプラン別に分化（リンク先・計測locationは不変）。
    cta: 'Entryで始める',
    features: [
      '就業規則のファイルから、ずれを1枚に',
      `AIチャット相談 1日${PLANS.starter.limits.chat}回まで`,
      `労務リスク・セルフ診断、規程ドラフトの下書き・レビュー 各1日${PLANS.starter.limits.risk_audit}回まで`,
      '助成金・法改正が自社に関係するかのチェック',
      `利用メンバー ${PLANS.starter.seatCap}名まで（追加料金なし）`,
    ],
    featured: PLANS.starter.featured,
  },
  {
    name: PLANS.standard.displayName,
    price: PLANS.standard.monthlyJpy.toLocaleString(),
    unit: `/月（1社あたり・${PLANS.standard.seatCap}名まで）`,
    yearly: PLANS.standard.yearlyJpy,
    tagline: 'チームでしっかり使う',
    badge: null,
    // 2026-07-30 PMF修理#4: Entry と同じ理由で plan=standard を載せる。
    signupHref: '/signup?next=/company&plan=standard' as string | undefined,
    anchor: '総務担当を1人増やす前に、まず番頭に任せられる範囲を確かめられます。',
    cta: 'Standardで始める',
    features: [
      'Entry のすべての機能',
      `AIチャット相談 1日${PLANS.standard.limits.chat}回まで（Entryの3倍）`,
      `診断・書類などの各機能も 1日${PLANS.standard.limits.risk_audit}回まで`,
      `利用メンバー ${PLANS.standard.seatCap}名まで（追加料金なし）`,
    ],
    featured: PLANS.standard.featured,
  },
  {
    name: PLANS.shigyo.displayName,
    price: PLANS.shigyo.monthlyJpy.toLocaleString(),
    unit: '/月（1席あたり）',
    yearly: PLANS.shigyo.yearlyJpy,
    tagline: '複数の顧問先を管理',
    badge: '士業向け',
    // 士業CTAは士業文脈を導線に持たせる（I3・2026-07-24。ゲート本体は別班）。
    signupHref: '/signup?next=/company&plan=shigyo' as string | undefined,
    // 士業プランは設計案にアンカー無し（席単位課金で「1日あたり」換算が誤解を生むため付けない）。
    anchor: null,
    cta: '士業として顧問先を登録',
    features: [
      `Standard のすべて（AIチャット相談 1日${PLANS.shigyo.limits.chat}回まで）`,
      // 2026-07-28 CTO修正（L2監査#3）: 顧問先の登録上限（50社）が非公開だった。
      // lib/plans.ts の shigyo.maxCompanies をそのまま開示する。
      `複数企業（顧問先）の切り替え（最大${PLANS.shigyo.maxCompanies}社まで）`,
      '企業ごとに書類・データを分離',
      '顧問先ごとに残した規程で、切り替えて相談できます',
      // 2026-07-29 CTO修正（UX監査Round5#4・軽）: 席数の上限（seatCap）が
      // /tokushoho にのみ記載され、トップページの料金カード・FAQには非開示だった。
      // lib/plans.ts の shigyo.seatCap をそのまま開示する（顧問先の社数上限=maxCompanies
      // とは別の数値であり、混同を避けるため両方を明記する）。
      `席単位の課金。事務所の利用メンバー数に応じて席を追加（最大${PLANS.shigyo.seatCap}席まで）`,
    ],
    featured: PLANS.shigyo.featured,
  },
]
