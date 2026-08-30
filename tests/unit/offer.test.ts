import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OFFER,
  HERO,
  HERO_EN,
  HERO_WINNER,
  zureHref,
  isForbiddenAcquisitionCopy,
  afterCompanyCreateHref,
} from '../../lib/offer.ts'

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

test('入口は /zure。CTA はファイルを置く。登録はファイルの後', () => {
  assert.equal(OFFER.path, '/zure')
  assert.equal(OFFER.cta, 'ファイルを置く')
  assert.equal(OFFER.signupPath, '/signup?next=/company')
  assert.match(zureHref('banto_tool', 'yukyu_5nichi'), /^\/zure\?/)
  assert.match(zureHref('banto_tool', 'yukyu_5nichi'), /utm_source=banto_tool/)
  assert.match(zureHref('kabau', 'kabau_set'), /utm_source=kabau/)
})

test('会社作成の次は5問でも相談でもなく書類', () => {
  assert.equal(afterCompanyCreateHref('abc'), '/company/documents?companyId=abc')
  assert.doesNotMatch(afterCompanyCreateHref('abc'), /onboarding|chat/)
})

test('獲得面で使わない文', () => {
  assert.equal(isForbiddenAcquisitionCopy('顧問社労士2万円と番頭9800円'), true)
  assert.equal(isForbiddenAcquisitionCopy('OCRで紙を読み取ります'), true)
  assert.equal(isForbiddenAcquisitionCopy('社労士マーケットで紹介します'), true)
  assert.equal(isForbiddenAcquisitionCopy('就業規則のファイルを置くと、ずれが1枚になります'), false)
})

test('ヒーローは2変種。記憶SaaSの宣伝ではない', () => {
  assert.equal(HERO_WINNER, 'B')
  assert.match(HERO.A, /ファイル/)
  assert.match(HERO.B, /ずれが1枚/)
  assert.match(HERO.B, /ファイルを置く/)
  assert.doesNotMatch(HERO.B, /書いてあることと書いてない/)
  assert.doesNotMatch(HERO.A + HERO.B, /労務記憶AI/)
  assert.doesNotMatch(HERO.A + HERO.B, /無料で始める/)
  assert.match(HERO_EN.A, /work rules file/)
  assert.match(HERO_EN.B, /one page/)
  assert.doesNotMatch(HERO_EN.A + HERO_EN.B, /remembers your company/)
})

test('公開ヘッダとルートは /zure を顔にする', () => {
  const root = read('app/page.tsx')
  assert.match(root, /\/zure/)
  assert.doesNotMatch(root, /permanentRedirect\('\/business'\)/)

  const header = read('components/ui/PublicHeader.tsx')
  assert.match(header, /ファイルを置く/)
  assert.match(header, /\/zure/)
  assert.match(header, /showPrimaryCta/)

  const zurePage = read('app/zure/page.tsx')
  assert.match(zurePage, /LinearNav/)
  assert.match(zurePage, /omitServiceHrefs=\{\['\/zure'\]\}/)
  assert.match(zurePage, /data-deadline-bar/)
  assert.doesNotMatch(zurePage, /zure-deadline-band/)
  assert.doesNotMatch(zurePage, /PublicHeader/)

  const signup = read('app/(auth)/signup/page.tsx')
  assert.match(signup, /afterCompanyCreateHref/)
  assert.doesNotMatch(signup, /router\.push\(`\/company\/onboarding/)

  const tools = read('app/tools/page.tsx')
  assert.match(tools, /zureHref\('banto_tool', 'tools_index'\)/)
  assert.doesNotMatch(tools, /点検の先は、自社を覚えるAIに/)

  const security = read('app/security/page.tsx')
  assert.match(security, /登録前のファイル/)
  assert.match(security, /データベースに書きません/)

  const auth = read('app/(auth)/layout.tsx')
  assert.match(auth, /href="\/zure"/)
  assert.doesNotMatch(auth, /会社を覚える労務AI/)

  const drop = read('app/zure/_components/ZureDrop.tsx')
  const below = read('app/zure/_components/ZureLpBelow.tsx')
  const legal = read('linear-house/components/LegalFold.tsx')
  const hero = read('linear-house/patches/HeroArtifact.tsx')
  assert.match(legal, /サーバへ保存しません/)
  assert.match(drop, /intent/)
  assert.match(below, /無料の点検/)
  assert.match(drop, /ファイルを選ぶ/)
  assert.match(hero, /ずれ1枚の見本/)
  assert.match(legal, /24時間/)
  assert.match(drop, /readPendingZure/)
  assert.match(hero, /表示の例です/)
  assert.match(drop, /この控えを消す/)
  assert.match(legal, /共有のパソコン/)
  assert.match(drop, /zure-file-pick/)
  assert.match(drop, /テキストを貼る|本文を貼る/)
  assert.match(drop, /fileFromPastedText/)
  assert.match(drop, /HeroArtifact/)
  assert.match(drop, /GapSheetView/)
  assert.match(drop, /zure-sticky-cta/)
  assert.match(drop, /lh-btn-ink/)
  assert.match(drop, /ZureLpBelow/)
  assert.doesNotMatch(legal, /選んだあとに表示/)
  assert.doesNotMatch(drop, /zure-deadline-band/)

  const privacy = read('app/privacy/page.tsx')
  assert.match(privacy, /同じブラウザに24時間だけ控え/)

  const footer = read('components/ui/PublicFooter.tsx')
  assert.match(footer, /omitServiceHrefs/)

  const bizMeta = read('app/business/page.tsx')
  assert.doesNotMatch(bizMeta, /会社の規程を覚える労務AI/)

  const business = read('app/business/page.tsx')
  assert.match(business, /1枚にする・答える・つくる・気づく/)
  assert.doesNotMatch(business, /覚える・答える・つくる・気づく/)

  const onboarding = read('app/(app)/company/onboarding/page.tsx')
  assert.match(onboarding, /ingestPendingZure/)
  assert.match(onboarding, /afterCompanyCreateHref/)

  const login = read('app/(auth)/login/page.tsx')
  assert.match(login, /href="\/zure"/)
  assert.match(login, /ファイルを置いて始める/)

  const en = read('app/business/en/page.tsx')
  assert.match(en, /\/zure\?lang=en/)
  assert.doesNotMatch(en, /href="\/signup\?next=\/company&lang=en"/)

  const tracked = read('app/business/_components/TrackedCTA.tsx')
  assert.match(tracked, /href = '\/zure'/)
  assert.doesNotMatch(tracked, /href = '\/signup\?next=\/company'/)

  const cookie = read('components/ui/CookieBanner.tsx')
  assert.doesNotMatch(cookie, /\.focus\(\)/)

  const roumu = read('app/roumu/page.tsx')
  assert.doesNotMatch(roumu, /会社を覚えるAIに相談できます/)
  assert.match(roumu, /zureHref\('roumu', 'hub'\)/)

  const roumuArticle = read('app/roumu/[slug]/page.tsx')
  assert.match(roumuArticle, /zureHref\('roumu', u\.slug\)/)
  assert.match(roumuArticle, /href="\/offer"/)
  assert.doesNotMatch(roumuArticle, /href="\/business"/)
  assert.doesNotMatch(roumuArticle, /SIGNUP_HREF/)

  const offerPage = read('app/offer/page.tsx')
  assert.match(offerPage, /無料と有料/)
  assert.match(read('app/offer/OfferViewTrack.tsx'), /offer_view/)
})
