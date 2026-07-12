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
