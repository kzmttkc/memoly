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

// ヒーロー: 2026-08-29 LP（紙地・機能そのもの）へ焼き戻し。
//   「方針・窓口・手順」は正しいが長い。第一声はジョブ「ずれが1枚」。
export const HERO_WINNER = 'B' as 'A' | 'B' | null

export const HERO = {
  A: '就業規則のファイルを置くと、ずれが1枚になります',
  B: 'ファイルを置くと、ずれが1枚になる。',
} as const

/** /zure 第一面の義務化行（見出しの直前）。docs/gap-engine/11-ZURE-COPY.md */
export const ZURE_OBLIGATION =
  '2026年10月1日から、カスハラ対策はすべての事業主の義務です。'

export const ZURE_LEAD =
  'PDF・Word・テキストを置くか、本文を貼ると、ずれが1枚になります。'

export const HERO_EN = {
  A: 'Place a work rules file, and the gaps become one page',
  B: 'Place the file, and the gaps become one page.',
} as const

export const TOOL_NEXT = {
  title: '次は、就業規則のファイルを置く',
  body: '点検の数字は画面に残っています。就業規則AIの入口は登録ではなく、就業規則のPDF・Word、または本文の貼り付けです。置くと、ずれが1枚になります。',
} as const

export const KABAU_LINE =
  'パックの次は、店の就業規則のファイルです。置くと、ずれが1枚になります。'

/** killDate までの残日（JST暦日）。帯表示用。 */
export function daysUntilKill(now = new Date()): number {
  const [y, m, d] = OFFER.killDate.split('-').map(Number)
  const kill = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((kill - today) / 86_400_000))
}

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
