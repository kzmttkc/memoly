import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  checkSheetItems,
  CHECKSHEET_SOURCE,
  KASUHARA_SOCHI_ITEMS,
} from '../../lib/article-checksheet.ts'
import { USECASE_LIST, getUseCase } from '../../lib/usecase.ts'

// ============================================================================
// 段2（名前を取る）の確認シート — 記事ごとの点検項目の作られ方を縛る
//
//   背景（2026-08-25 GTM正典 gtm-doctrine.md §2）:
//     4ヶ月・6製品で外部有料0。原因は「流入 → **名前** → 関係 → 販売」の段2が
//     無かったこと。番頭の記事は GSC 28日で imp 1,879 / clk 107 と6製品中で最強の
//     検索資産なのに、30日でメール獲得は0件だった（Plausible lead_captured
//     events=0 / 90日, hostname=banto-roumu.com 実測）。
//
//     置いてあった枠自体は壊れていない。渡していた対価が
//     「労務引き継ぎチェックシート（PDF）」1種類で、58記事すべてに同じものを
//     出していた（カスハラ義務化の記事を読んだ人に引き継ぎのPDFを出していた）。
//     正典 §2 の「対価はその場で完結する実用物」に反する。
//
//   この確認シートは、**記事が自分で書いている論点だけ**を項目にする。
//   新しい事実・新しい断定を1つも作らない（法令の記述をこちらで書き起こさない）。
// ============================================================================

test('58記事すべてで項目が作れる（空の記事が1本も無い）', () => {
  const empty = USECASE_LIST.filter((u) => checkSheetItems(u).length === 0)
  assert.deepEqual(
    empty.map((u) => u.slug),
    [],
    '項目が0件の記事がある。その記事だけ段2の枠が空になる',
  )
})

test('項目は2件以上・6件以下（読み終わりに置く重さの上限）', () => {
  for (const u of USECASE_LIST) {
    const n = checkSheetItems(u).length
    assert.ok(n >= 2, `${u.slug}: 項目が${n}件しかない`)
    assert.ok(n <= 6, `${u.slug}: 項目が${n}件は多すぎる（読み終わりの位置で離脱する）`)
  }
})

test('項目文は記事本文かFAQに実在する（こちらで書き起こさない）', () => {
  for (const u of USECASE_LIST) {
    const haystack = [
      ...u.sections.flatMap((s) => [s.heading, ...s.body]),
      ...u.faqs.flatMap((f) => [f.q, f.a]),
      ...KASUHARA_SOCHI_ITEMS,
    ].join('\n')
    for (const item of checkSheetItems(u)) {
      assert.ok(
        haystack.includes(item.topic),
        `${u.slug}: 記事に無い文を点検項目にしている（捏造）: ${item.topic}`,
      )
    }
  }
})

test('製品の宣伝（番頭の費用・番頭で足りるか）を点検項目にしない', () => {
  for (const u of USECASE_LIST) {
    for (const item of checkSheetItems(u)) {
      assert.doesNotMatch(
        item.topic,
        /番頭|ばんとう/,
        `${u.slug}: 自社を点検する項目に製品名が入っている（点検ではなく宣伝になる）: ${item.topic}`,
      )
    }
  }
})

test('各項目は確認材料（記事側の答え）を持つ', () => {
  for (const u of USECASE_LIST) {
    for (const item of checkSheetItems(u)) {
      assert.ok(
        item.detail && item.detail.length > 0,
        `${u.slug}: 「${item.topic}」に確認材料が無い。未確認と出すだけで何も渡せない`,
      )
    }
  }
})

test('同じ記事なら毎回同じ項目になる（決定的）', () => {
  const u = USECASE_LIST[0]
  assert.deepEqual(checkSheetItems(u), checkSheetItems(u))
})

test('記事ごとに項目が違う（58本に同じ1枚を配らない）', () => {
  // 4ヶ月間の失敗そのもの＝全記事に同じPDFを出していた状態に戻らないようにする。
  const shapes = new Set(
    USECASE_LIST.map((u) => checkSheetItems(u).map((i) => i.topic).join('|')),
  )
  assert.ok(
    shapes.size >= USECASE_LIST.length - 2,
    `記事をまたいで同じ項目になっている（${shapes.size}種類 / ${USECASE_LIST.length}記事）`,
  )
})

test('流入が集中しているカスハラ義務化の記事は、本文の社内対応チェックリストを使う', () => {
  // 実測（Plausible 30日）: /roumu/kasuhara-gimuka-2026 が 258 visitors で
  // 全 417 visitors の62%。ここの項目がずれると段2の件数がそのまま落ちる。
  const u = getUseCase('kasuhara-gimuka-2026')
  assert.ok(u, 'kasuhara-gimuka-2026 が消えている')
  const topics = checkSheetItems(u!).map((i) => i.topic)
  assert.deepEqual(topics, [...KASUHARA_SOCHI_ITEMS])
})

test('本文の社内対応チェックリストは、既存のセルフ点検と同じ1つの出所を使う', () => {
  // 同じ5項目が2箇所にベタ書きされていると、片方だけ直って食い違う。
  const selfcheck = readFileSync(
    new URL('../../app/roumu/[slug]/_components/KasuharaSelfCheck.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    selfcheck,
    /KASUHARA_SOCHI_ITEMS/,
    'KasuharaSelfCheck が項目を自前で持っている（確認シートと二重管理になる）',
  )
})

// --- 段2の獲得経路が「どの記事・どの対価か」を必ず持つ ---

const route = readFileSync(
  new URL('../../app/api/company/leads/route.ts', import.meta.url),
  'utf8',
)
const sheet = readFileSync(
  new URL('../../app/roumu/[slug]/_components/ArticleCheckSheet.tsx', import.meta.url),
  'utf8',
)

test('確認シートが送る source を API が受理する（unknown に丸められない）', () => {
  const block = route.slice(
    route.indexOf('const ALLOWED_SOURCES'),
    route.indexOf('])', route.indexOf('const ALLOWED_SOURCES')),
  )
  const allowed = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.ok(
    allowed.includes(CHECKSHEET_SOURCE),
    `ALLOWED_SOURCES に ${CHECKSHEET_SOURCE} が無い。'unknown' に丸められ、どの対価で取れたか分からなくなる`,
  )
})

test('確認シートは source と記事slugを必ず載せて送る', () => {
  assert.match(sheet, /source:\s*CHECKSHEET_SOURCE/)
  assert.match(sheet, /slug/, 'どの記事から取れたリードか分からない形で送っている')
})

test('取るのはメールアドレス1つだけ（会社名・電話・役職を同時に聞かない）', () => {
  // 正典 §2: 取るのはメールアドレス1つだけ。
  const inputs = [...sheet.matchAll(/<input[\s\S]*?\/>/g)].map((m) => m[0])
  const visible = inputs.filter((i) => !/tabIndex=\{-1\}/.test(i)) // honeypot を除く
  const typed = visible.filter((i) => /type="(email|tel|text|number)"/.test(i))
  assert.equal(
    typed.length,
    1,
    `メール以外の入力欄がある（${typed.length}個）。段2は1項目だけにする`,
  )
  assert.match(typed[0], /type="email"/)
})

test('取得目的の明示とプライバシーポリシーへのリンクがある', () => {
  assert.match(sheet, /\/privacy/, 'プライバシーポリシーへのリンクが無い')
  assert.match(sheet, /利用します/, '取得目的の明示が無い')
})

test('記事ページは確認シートを読み終わりの位置に置く（FAQの後・関連リンクの前）', () => {
  const page = readFileSync(
    new URL('../../app/roumu/[slug]/page.tsx', import.meta.url),
    'utf8',
  )
  const faq = page.indexOf('よくある質問')
  const sheetAt = page.indexOf('<ArticleCheckSheet')
  const related = page.indexOf('ほかの使い方も見る')
  assert.ok(sheetAt > 0, '記事ページに確認シートが置かれていない')
  assert.ok(faq > 0 && sheetAt > faq, '確認シートが本文・FAQより前にある（冒頭に置かない）')
  assert.ok(related > 0 && sheetAt < related, '確認シートが関連リンクより後ろに沈んでいる')
})

test('記事に同じ対価の枠を2つ置かない（旧・汎用PDFの枠は記事から外す）', () => {
  // 実測: 汎用PDF(労務引き継ぎチェックシート)の枠は記事末尾にあったが
  // lead_captured は90日で0件。2枠並べるとどちらが効いたか分からなくなる。
  const page = readFileSync(
    new URL('../../app/roumu/[slug]/page.tsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    page,
    /<LeadCapture\b/,
    '記事にメール獲得枠が2つある。段2の件数がどちらの対価で取れたか分からない',
  )
})
