/** one-product SKU 正典（表示・判定用）。金額の SSOT は lib/plans.ts と揃える。 */
export const SKU = {
  preRegister: { yen: 0, label: '登録前' },
  saas: {
    entry: { yen: 3980, label: 'Entry' },
    standard: { yen: 9800, label: 'Standard' },
    shigyo: { yen: 29800, label: '士業' },
  },
  pack: {
    yen: 19800,
    label: 'カスハラ実務パック',
    /** Stripe Price（本番）。変更時は webhook 判定も更新。 */
    priceId: 'price_1TyiXYJzuwrOe7d1UMBVIrru',
    paymentLinkId: 'plink_1TyiXZJzuwrOe7d1QJuNeP5Q',
  },
  ledger: {
    yen: 1980,
    label: '記録台帳',
    status: 'archived_new_sales' as const,
    priceId: 'price_1U6WeSJzuwrOe7d10HxNhYHx',
  },
} as const

export function isPackPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false
  const env = process.env.STRIPE_PRICE_KASUHARA_PACK?.trim()
  if (env && priceId === env) return true
  return priceId === SKU.pack.priceId
}
