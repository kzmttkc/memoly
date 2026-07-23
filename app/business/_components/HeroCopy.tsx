import { Badge } from '@/components/ui/Badge'
import type { LpVariant } from '../_lib/variant-shared'

// ============================================================================
// HeroCopy — ヒーローの「アイブロー」「H1」「サブコピー」の A/B 変種スロット。
//
//   2026-07-23 A02 SSRバイアス修正:
//     従来は 'use client' + useVariant() で SSR/初回ハイドレーションが常に 'A'、
//     'B' はマウント後の差し替えだった（JS未実行来訪は全てA・B群のみCLS発生）。
//     現在は middleware が cookie で変種を確定し、page.tsx（サーバー）が
//     variant を prop で渡す。ここは純粋な描画のみ＝SSR HTML の段階で変種が
//     焼き込まれ、ハイドレーション差し替えは起きない。
//
//   変種の意味:
//     A(記憶メタファー) = 「二度目の相談は、昨日の続きから始まります」。
//     B(カテゴリ即解型) = 初見客が着地直後に製品カテゴリと成果を即解読できる
//       「会社のことを覚えて、労務の調べ物を減らすAI」。B を勝者候補として
//       配信比率 70% に拡大（_lib/variant-shared.ts の VARIANT_B_RATIO）。
//
//   Phase1 厳守: AI社労士/社労士監修/法的精度○点は使わない。断定的な個別助言・
//     数値保証はしない（「〜が要りません」「〜を減らせます」止め）。誇大回避・敬体・
//     太字/マーカーなし。B の問いは読者自身の不安を名指すだけで、合法/違法の断定はしない。
// ============================================================================

// H1 の className は A/B で完全一致させる（差分は「文言」だけで、
// 要素構造(spans+br)・クラス・余白は A/B 共通に保つ）。
const HERO_H1_CLASS =
  'text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl'

/** H1見出し。A=記憶メタファー / B=カテゴリ即解型の具体的価値提案。 */
export function HeroHeadline({ variant }: { variant: LpVariant }) {
  if (variant === 'B') {
    return (
      <h1 className={HERO_H1_CLASS}>
        <span className="inline-block">会社のことを覚えて、</span>
        <br className="hidden sm:block" />
        <span className="inline-block">労務の調べ物を</span>
        <span className="inline-block">減らすAI</span>
      </h1>
    )
  }
  return (
    <h1 className={HERO_H1_CLASS}>
      <span className="inline-block">二度目の相談は、</span>
      <br className="hidden sm:block" />
      <span className="inline-block">昨日の続きから</span>
      <span className="inline-block">始まります</span>
    </h1>
  )
}

/** アイブロー。A=役割ラベルのピル / B=当事者の痛みを名指すフック行。 */
export function HeroEyebrow({ variant }: { variant: LpVariant }) {
  if (variant === 'B') {
    return (
      <p className="mb-4 text-sm font-semibold leading-relaxed text-brand-600">
        「この残業、うちは大丈夫？」を毎回ゼロから調べていませんか
      </p>
    )
  }
  return (
    <Badge tone="brand" className="mb-6">
      会社を覚える労務AI
    </Badge>
  )
}

/** H1直下サブコピー。A=記憶の説明起点 / B=痛みから記憶の約束へ橋渡し。 */
export function HeroSubcopy({ variant }: { variant: LpVariant }) {
  if (variant === 'B') {
    return (
      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
        番頭は自社の所定労働時間・休日・36協定の状況を覚えているので、同じ前提を調べ直す必要がありません。
        前提を説明し直さずに、自社の状況に合わせた答えがすぐ返ります。
        中小企業の総務・経営者が、日々の労務管理の調べ物を減らせます。
      </p>
    )
  }
  return (
    <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
      所定労働時間も、休日のルールも、過去の相談も番頭が覚えています。
      前提を説明し直さずに、自社の状況に合わせた答えがすぐ返ります。
      中小企業の総務・経営者が、社内規程の管理と日々の労務管理の調べ物を減らせます。
    </p>
  )
}
