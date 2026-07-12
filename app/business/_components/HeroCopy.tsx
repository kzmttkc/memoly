'use client'

import { Badge } from '@/components/ui/Badge'
import { useVariant } from '../_lib/variant'

// ============================================================================
// HeroCopy — ヒーローの「アイブロー」と「H1直上サブコピー」だけを変種化する
//   クライアント境界（第1実験＝note文脈連結ヒーローA/B）。
//
//   なぜここだけか: H1本体・CTA・レイアウトは不変（差分最小）。差し替えるのは
//   到着直後の当事者が最初に読む2ブロック（アイブロー＋サブコピー）のみ。
//     A(現行) = 記憶起点。番頭の内部差別化(覚えている)から入る（現状維持）。
//     B(痛み橋渡し) = note読者(残業代/雇用契約/労務担当の当事者)が着地した瞬間の
//       「今、うちは大丈夫？を毎回ゼロから調べている」痛みから入り、そのまま
//       「番頭は自社の前提を覚えているので調べ直しが要らない」という記憶の約束へ橋渡す。
//
//   Phase1 厳守: AI社労士/社労士監修/法的精度○点は使わない。断定的な個別助言・
//     数値保証はしない（「〜が要りません」「〜を減らせます」止め）。誇大回避・敬体・
//     太字/マーカーなし。B の問いは読者自身の不安を名指すだけで、合法/違法の断定はしない。
//
//   回帰ゼロ: SSR/初回ハイドレーションは常に 'A'（現行と完全一致）。'B' の来訪だけ
//     マウント後に差し替わる。'A' の来訪は最初から現行UIと同一。
// ============================================================================

// H1本体の className はページ側と完全一致させる（A の DOM/タイポグラフィを1文字も
// 変えない＝回帰ゼロの担保）。B のみテキストを差し替える。差分は「文言」だけで、
// 要素構造(spans+br)・クラス・余白は A/B 共通に保つ。
const HERO_H1_CLASS =
  'text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl'

/**
 * H1見出し。A=現行の記憶メタファー（「二度目の相談は、昨日の続きから始まります」）で
 *   完全据え置き / B=冷たい初見客が着地直後に製品カテゴリと成果を即解読できる
 *   具体的な価値提案へ差し替え（「会社のことを覚えて、労務の調べ物を減らすAI」）。
 *
 *   なぜH1か: 上部で最も読まれ、離脱/滞在を決める単一レバー。A の抽象メタファーは
 *   製品既知者向けで、note等からの初見客は解読に前提知識を要する。流入が希少なため、
 *   来訪者あたりの理解率を上げるH1が最大EVの1点。B のアイブロー(痛み)→H1(具体的成果)→
 *   サブコピー(記憶の約束)で一貫した1つの仮説になる。
 *
 *   Phase1 厳守: 断定的個別助言・数値保証・誇大なし。「減らす」は本文既存の許容表現に
 *   一致（「調べ物を減らせます」）。禁止語・太字・長ダッシュなし・体言止めの見出し。
 *   回帰ゼロ: SSR/初回ハイドレーションは 'A'。'B' の来訪のみマウント後に差し替わる。
 */
export function HeroHeadline() {
  const variant = useVariant()
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
export function HeroEyebrow() {
  const variant = useVariant()
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

/** H1直上サブコピー。A=記憶の説明起点 / B=痛みから記憶の約束へ橋渡し。 */
export function HeroSubcopy() {
  const variant = useVariant()
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
