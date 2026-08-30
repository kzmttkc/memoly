import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HERO, HERO_WINNER } from '../../lib/offer.ts'

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

test('ヘッダCTAはファイルを置く。入口は /zure', () => {
  const src = read('app/business/_components/HeaderCta.tsx').replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.match(src, /ファイルを置く/)
  assert.match(src, /\/zure/)
  assert.doesNotMatch(src, /無料で始める/)
  assert.doesNotMatch(src, /DEPTH_PX/)
})

test('llms.txt は決済が開いていると書く', () => {
  const src = read('public/llms.txt')
  assert.match(src, /Entry: ¥3,980\/月/)
  assert.doesNotMatch(src, /決済開放時期は運営判断による/)
  assert.match(src, /確認日: 2026-08-23/)
})

test('料金と説明の本文は労務記憶AIと名乗らない', () => {
  const pricing = read('app/pricing/page.tsx')
  assert.doesNotMatch(pricing, /覚える労務AI/)
  assert.match(pricing, /ずれを1枚/)
  const biz = read('app/business/page.tsx')
  assert.doesNotMatch(biz, /労務記憶AI/)
})

test('入口はファイルに加えて本文の貼り付けができる', () => {
  const src = read('app/zure/_components/ZureDrop.tsx')
  const offer = read('lib/offer.ts')
  assert.match(src, /テキストを貼る/)
  assert.match(src, /fileFromPastedText/)
  assert.match(src, /zure-paste/)
  assert.match(src, /サンプルで見え方だけ確かめる/)
  assert.match(src, /zure_sample_clicked/)
  assert.match(src, /ZURE_LEAD/)
  assert.match(offer, /登録・クレジットカードは不要|不足の断定ではありません/)
  assert.match(src, /就業規則のファイルをここに置く/)
  assert.match(src, /href=\"\/offer\"/)
  assert.match(src, /ZureLpBelow/)
  assert.match(src, /LegalFold/)
  assert.match(src, /zure-sticky-cta/)
  const below = read('app/zure/_components/ZureLpBelow.tsx')
  assert.match(below, /無料の点検/)
})

test('説明ページの比較は登録直後の相談を約束しない', () => {
  const biz = read('app/business/page.tsx')
  assert.match(biz, /ファイルを置くと数分で1枚/)
  assert.doesNotMatch(biz, /登録からそのまま相談を始められ/)
  assert.doesNotMatch(read('app/business/_components/TryDemo.tsx'), /覚えさせれば/)
})

test('公開FAQは入口での貼り付けを案内する', () => {
  const src = read('lib/faq.ts')
  assert.match(src, /本文を貼/)
  assert.doesNotMatch(src, /ファイルとしての取り込みには現在対応していません/)
})

test('説明ページのヒーローはファイルが先。アイブローに記憶SaaSと書かない', () => {
  const src = read('app/business/_components/HeroCopy.tsx')
  assert.match(src, /from '@\/lib\/offer'/)
  assert.match(src, /HERO\.B/)
  assert.doesNotMatch(src, /会社を覚える労務AI/)
  assert.equal(HERO_WINNER, 'B')
  assert.match(HERO.B, /ずれが1枚/)
})

test('記事の締めは覚えるAIではなくファイルを置く', () => {
  const blog = read('app/blog/page.tsx')
  assert.match(blog, /href="\/zure"/)
  assert.doesNotMatch(blog, /覚えているAI/)
  const seido = read('app/seido/page.tsx')
  assert.match(seido, /href="\/zure"/)
  assert.doesNotMatch(seido, /会社のことを覚えて、労務の相談に乗るAIへ/)
  const drop = read('app/zure/_components/ZureDrop.tsx')
  assert.match(drop, /1枚をコピー/)
  assert.match(drop, /印刷する/)
  assert.match(drop, /navigator\.share/)
})

// 2026-08-26 Kabau×番頭 1本化 Phase 1-1: パンくずのブランド表記は Kabau（旧・番頭）。
test('公開面のパンくず「就業規則AI」は入口へ戻る', () => {
  const faq = read('app/faq/page.tsx')
  assert.match(faq, /href="\/zure" className="hover:text-brand-700">就業規則AI/)
  assert.doesNotMatch(faq, /href="\/business" className="hover:text-brand-700">就業規則AI/)
  assert.match(faq, /item: `\$\{BASE\}\/zure`/)
  const tools = read('app/tools/page.tsx')
  assert.match(tools, /href="\/zure" className="hover:text-brand-700">就業規則AI/)
})

test('直リンクの登録画面はファイルを先に置けると案内する', () => {
  const src = read('app/(auth)/signup/page.tsx')
  assert.match(src, /先に就業規則のファイルを置く/)
  assert.match(src, /place a work rules file first/)
})

test('印刷では入口の操作を隠す', () => {
  const css = read('app/globals.css')
  assert.match(css, /@media print/)
  assert.match(css, /zure-drop-chrome/)
  const banner = read('components/ui/CookieBanner.tsx')
  assert.match(banner, /print:hidden/)
})

test('置き直し失敗で見えている1枚を消さない', () => {
  const src = read('app/zure/_components/ZureDrop.tsx')
  assert.match(src, /emptyOrFolderNote/)
  assert.match(src, /retryUntilMs/)
  assert.match(src, /retryWaitMessage/)
  assert.match(src, /aria-busy/)
  assert.match(src, /onDragEnter/)
  assert.match(src, /HERO_EN/)
  assert.doesNotMatch(src, /if \(!res\.ok\) \{[\s\S]{0,180}setSheet\(null\)/)
  assert.doesNotMatch(src, /8MBまでです。[\s\S]{0,120}setSheet\(null\)/)
})

test('1枚とドロップは一つの枠に入る（Linear House）', () => {
  const src = read('app/zure/_components/ZureDrop.tsx')
  const frameAt = src.indexOf('className="lh-frame')
  const dropAt = src.indexOf('就業規則のファイルをここに置く')
  const sheetAt = src.indexOf('<GapSheetView')
  assert.ok(frameAt > 0 && dropAt > frameAt && sheetAt > dropAt)
})

test('英語の登録はリスク診断へ直行すると約束しない', () => {
  const src = read('app/(auth)/signup/page.tsx')
  assert.doesNotMatch(src, /company risk check/)
  assert.match(src, /documents page/)
})

test('英語の説明は本文の貼り付けも案内する', () => {
  const src = read('app/business/en/page.tsx')
  assert.match(src, /or paste the text/)
})

test('1枚の操作の隣に読み込みと失敗を出す', () => {
  const src = read('app/zure/_components/ZureDrop.tsx')
  assert.match(src, /pendingRemainingHours/)
  assert.match(src, /あと約/)
  assert.match(src, /消しますか/)
  assert.match(src, /scrollIntoView/)
  const sheetAt = src.indexOf('<GapSheetView')
  const busyInSheet = src.indexOf('読んでいます…', sheetAt)
  const errInSheet = src.indexOf('role="alert"', sheetAt)
  assert.ok(sheetAt > 0 && busyInSheet > sheetAt && errInSheet > sheetAt)
})

test('確認待ちは覚えるAIや昨日の続きを約束しない', () => {
  const src = read('app/(auth)/signup/page.tsx')
  assert.doesNotMatch(src, /二度目の相談は、昨日の続きから始まります/)
  assert.doesNotMatch(src, /picks up where today/)
  assert.doesNotMatch(src, /一度覚えた前提/)
  assert.match(src, /相談はファイルのあとです/)
})

test('PWAの顔はファイルを置く', () => {
  const src = read('public/manifest.json')
  assert.match(src, /\/zure/)
  assert.doesNotMatch(src, /会社を覚える労務AI/)
  assert.doesNotMatch(src, /相談を始める/)
})

test('料金カードは有料登録の意思を残し、先にファイルを置ける', () => {
  const copy = read('app/pricing/_lib/plan-copy.ts')
  assert.match(copy, /signupHref: '\/signup\?next=\/company&plan=starter'/)
  assert.doesNotMatch(copy, /自社の規程・会社プロファイルの記憶/)
  assert.match(copy, /ずれを1枚/)
  assert.match(copy, /先に就業規則のファイルを置く/)
  const pricing = read('app/pricing/page.tsx')
  assert.match(pricing, /PLAN_FILE_FIRST/)
  assert.doesNotMatch(pricing, /二度目の相談が前回の続きから始まる/)
  const biz = read('app/business/page.tsx')
  assert.match(biz, /PLAN_FILE_FIRST/)
})

test('制度チェックリストのゲートは覚えるAIと名乗らない', () => {
  const src = read('app/seido/checklist/page.tsx')
  assert.match(src, /SIGNUP_HREF/)
  assert.doesNotMatch(src, /覚えて労務の相談に乗る/)
  assert.match(src, /先に就業規則のファイルを置く/)
})

test('目的別比較記事は覚える番頭を看板にしない', () => {
  const src = read('lib/usecase.ts')
  assert.doesNotMatch(src, /会社を覚える番頭/)
  assert.doesNotMatch(src, /会社を覚えるAI/)
  assert.doesNotMatch(src, /会社を覚えるタイプ/)
  assert.doesNotMatch(src, /労務を覚えるAI/)
  assert.match(src, /ずれを1枚/)
  const auto = read('lib/usecase-auto.json')
  assert.doesNotMatch(auto, /会社を覚える/)
})

test('日英の利用規約はファイルが先と書く', () => {
  const ja = read('app/terms/page.tsx')
  assert.match(ja, /就業規則のファイル/)
  assert.doesNotMatch(ja, /会社のルール・規程・労務を覚えて回答するAIアシスタント/)
  const en = read('app/terms/en/page.tsx')
  assert.doesNotMatch(en, /remembers your company/)
  assert.match(en, /work rules file/)
})

test('社内検証は当時記録だと明示し、いまの入口を示す', () => {
  const src = read('app/business/_components/ScenarioSection.tsx')
  assert.match(src, /当時の記録/)
  assert.match(src, /href="\/zure"/)
  const en = read('app/business/_components/ScenarioSectionEn.tsx')
  assert.match(en, /historical record/)
  assert.match(en, /\/zure\?lang=en/)
})

test('獲得面は実ユーザー数を名乗らず、ヒーロー勝ちはBに焼き戻す', () => {
  assert.equal(HERO_WINNER, 'B')
  const llms = read('public/llms.txt')
  assert.match(llms, /ヒーロー文はB/)
  assert.match(llms, /ずれが1枚|方針・窓口・手順/)
  assert.doesNotMatch(llms, /導入実績/)
  const offer = read('lib/offer.ts')
  assert.match(offer, /HERO_WINNER = 'B'/)
  assert.match(offer, /ずれが1枚になる/)
  assert.doesNotMatch(offer, /書いてあることと書いてないことを1枚にします/)
  const ratio = read('app/business/_lib/variant-shared.ts')
  assert.match(ratio, /VARIANT_B_RATIO = 1(?:\.0)?/)
})
