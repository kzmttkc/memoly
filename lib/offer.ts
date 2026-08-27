// ============================================================================
// offer.ts — 2026-08-21 案A の正本。獲得の顔は労務記憶SaaSではない。
//   最初の商品は「就業規則のファイル → ずれ1枚」。登録はファイルの副作用。
//   相談は2回目。/business は説明ページに降格する。
// ============================================================================

export const OFFER = {
  path: '/zure',
  cta: 'ファイルを置く',
  signupPath: '/signup?next=/company',
  saveCta: 'この1枚を残す',
  killDate: '2026-10-01',
  fileTarget: 10,
  kabauFileTarget: 3,
} as const

// ヒーローA/Bの勝ちは未確定。名乗らない。北の星は fileTarget。
export const HERO_WINNER = null as 'A' | 'B' | null

export const HERO = {
  A: '就業規則のファイルを置くと、ずれが1枚になります',
  B: 'このファイルから、書いてあることと書いてないことを1枚にします',
} as const

export const HERO_EN = {
  A: 'Place a work rules file, and the gaps become one page',
  B: 'From this file, we put what is written and what is not onto one page',
} as const

export const TOOL_NEXT = {
  title: '次は、就業規則のファイルを置く',
  body: '点検の数字は画面に残っています。就業規則AIの入口は登録ではなく、就業規則のPDF・Word、または本文の貼り付けです。置くと、書いてあることと書いてないことが1枚になります。',
} as const

export const KABAU_LINE =
  'パックの次は、店の就業規則のファイルです。置くと、ずれが1枚になります。'

const FORBIDDEN = [
  /顧問.{0,8}2\s*万/,
  /OCR/,
  /社労士マーケット/,
]

export function isForbiddenAcquisitionCopy(text: string): boolean {
  return FORBIDDEN.some(re => re.test(text))
}

export function zureHref(source: string, campaign: string): string {
  const q = new URLSearchParams({
    utm_source: source.slice(0, 60),
    utm_medium: 'cta',
    utm_campaign: campaign.slice(0, 60),
  })
  return `${OFFER.path}?${q.toString()}`
}

export function afterCompanyCreateHref(companyId: string): string {
  return `/company/documents?companyId=${encodeURIComponent(companyId)}`
}
