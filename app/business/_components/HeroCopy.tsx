import type { LpVariant } from '../_lib/variant-shared'

const HERO_H1_CLASS =
  'text-4xl font-bold leading-[1.18] tracking-tight text-neutral-900 sm:text-5xl'

export function HeroHeadline({ variant }: { variant: LpVariant }) {
  if (variant === 'B') {
    return (
      <h1 className={HERO_H1_CLASS}>
        <span className="inline-block">このファイルから、</span>
        <br className="hidden sm:block" />
        <span className="inline-block">書いてあることと書いてないことを</span>
        <span className="inline-block">1枚にします</span>
      </h1>
    )
  }
  return (
    <h1 className={HERO_H1_CLASS}>
      <span className="inline-block">就業規則のファイルを置くと、</span>
      <br className="hidden sm:block" />
      <span className="inline-block">ずれが1枚になります</span>
    </h1>
  )
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
