import type { LpVariant } from '../_lib/variant-shared'
import { HERO } from '@/lib/offer'

const HERO_H1_CLASS =
  'text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl'

export function HeroHeadline({ variant }: { variant: LpVariant }) {
  const text = variant === 'B' ? HERO.B : HERO.A
  // 読点で2行に割る（長い1文でも語中改行を防ぐ）
  const comma = text.indexOf('、')
  if (comma > 0) {
    return (
      <h1 className={HERO_H1_CLASS}>
        <span className="inline-block">{text.slice(0, comma + 1)}</span>
        <br className="hidden sm:block" />
        <span className="inline-block">{text.slice(comma + 1)}</span>
      </h1>
    )
  }
  return <h1 className={HERO_H1_CLASS}>{text}</h1>
}

export function HeroEyebrow(_props: { variant: LpVariant }) {
  return null
}

export function HeroSubcopy(_props: { variant: LpVariant }) {
  return (
    <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
      登録の前に、PDF・Word・テキストを置けます。ファイルが無いときは、本文を貼れます。読めなかったページは未読として残します。相談は、この1枚のあとです。
    </p>
  )
}
