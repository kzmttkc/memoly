import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isPackCheckout, packMailHtml, PACK_MAIL_SUBJECT } from '../../lib/pack-invite.ts'
import { isPackPriceId, SKU } from '../../lib/sku.ts'

const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

test('パック Price と 19800 payment を判定する', () => {
  assert.equal(isPackPriceId(SKU.pack.priceId), true)
  assert.equal(isPackPriceId('price_other'), false)
  assert.equal(
    isPackCheckout({
      priceId: SKU.pack.priceId,
      amountTotal: 19800,
      mode: 'payment',
    }),
    true,
  )
  assert.equal(
    isPackCheckout({ priceId: null, amountTotal: 19800, mode: 'payment' }),
    true,
  )
  assert.equal(
    isPackCheckout({ priceId: null, amountTotal: 3980, mode: 'subscription' }),
    false,
  )
})

test('パック招待メールは就業規則AIと zure / invite を案内する', () => {
  assert.match(PACK_MAIL_SUBJECT, /就業規則AI/)
  const html = packMailHtml({
    existingUser: false,
    zureUrl: 'https://banto-roumu.com/zure?from=pack',
    signupUrl: 'https://banto-roumu.com/invite?from=pack',
  })
  assert.match(html, /zure\?from=pack/)
  assert.match(html, /invite\?from=pack/)
  assert.doesNotMatch(html, /Kabau/)
  assert.doesNotMatch(html, /番頭/)
  const invite = read('app/invite/page.tsx')
  assert.match(invite, /redirect\(`\/signup/)
})

test('契約名・SKU・特商法が one-product に揃う', () => {
  const brand = read('lib/brand.ts')
  assert.match(brand, /KIZUNA Creation が banto-roumu.com および sharoushi-agent.com/)
  assert.match(brand, /旧称 Kabau \/ 番頭/)
  const offer = read('app/offer/page.tsx')
  assert.match(offer, /登録前/)
  assert.match(offer, /カスハラ実務パック/)
  assert.doesNotMatch(offer, /layer: '記録台帳'/)
  const footer = read('components/ui/PublicFooter.tsx')
  assert.match(footer, /旧称: Kabau/)
  const webhook = read('app/api/company/billing/webhook/route.ts')
  assert.match(webhook, /handlePackInvite/)
  assert.match(webhook, /isPackCheckout/)
  const tokusho = read('app/tokushoho/page.tsx')
  assert.match(tokusho, /カスハラ実務パック/)
  assert.match(tokusho, /登録前/)
  assert.match(tokusho, /新規の販売導線を置いていません/)
})
