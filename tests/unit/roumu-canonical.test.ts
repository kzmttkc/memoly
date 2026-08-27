import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SITEMAP_USECASE_SLUGS,
  USECASE_LIST,
  USECASE_SLUGS,
  canonicalUrlFor,
  getUseCase,
} from '../../lib/usecase.ts'

// ============================================================================
// /roumu/ 内の共食い統合 — canonical の向きを固定する
//
//   背景（2026-08-25 GSC 28日実測 2026-07-28〜08-24）:
//     就業規則AI×番頭のドメイン間の重複は1組しか無かった。共食いは番頭 /roumu/ の
//     **内部**にあった。同一の検索意図に複数本が並存し、被リンクとクロール予算が
//     割れて強い側の順位が上がらない。
//
//     例: カスハラ×就業規則の記載例クラスタは7本並存。強い側
//     kashara-kiyaku-kisoku-kiji-rei（imp 180 / clk 15）に対し、
//     kasuhara-kigyou-kisoku-kitei-rei（79/2）以下6本が同じ答え（定義・禁止行為・
//     相談窓口・対応フロー・懲戒の条文例）を返していた。
//
//   打ち手は canonical のみ。**記事の削除も 301 も統合執筆もしない**
//   （gtm-doctrine.md「既存資産を壊さない」）。弱い側のURLは残したまま、
//   検索エンジンに評価先だけを強い側へ寄せる。
//
//   判定は GSC の数字ではなく**本文を読んで**行った。キーワードが似ていても
//   答えている問いが違うものは重複ではない（下の NOT_DUPLICATE を参照）。
// ============================================================================

/** 実施した統合（弱い側 → 強い側）。ここが正典で、lib/usecase.ts はこの通りでなければならない。 */
const EXPECTED: Record<string, string> = {
  // ── カスハラ義務化2026 ──
  // 「措置義務に企業はどう備えるか」＝強い側のチェックリスト節と同じ答え。固有の答えが無い
  'kasuhara-sochi-gimu': 'kasuhara-gimuka-2026',

  // ── カスハラ×就業規則 記載例・規定例（7本→1本） ──
  'kasuhara-kigyou-kisoku-kitei-rei': 'kashara-kiyaku-kisoku-kiji-rei',
  'customer-harassment-kiyaku-kizai-rei': 'kashara-kiyaku-kisoku-kiji-rei',
  'customer-harassment-kisoku-kisamui-rei': 'kashara-kiyaku-kisoku-kiji-rei',
  'kashara-kiyaku-seibi-boushi': 'kashara-kiyaku-kisoku-kiji-rei',
  'kasutoma-hara-kisoku-jirei': 'kashara-kiyaku-kisoku-kiji-rei',
  'cashara-shugyou-kisoku-teigi-example': 'kashara-kiyaku-kisoku-kiji-rei',

  // ── カスハラ対策義務化×就業規則整備（6本→1本） ──
  'kasuhara-taisaku-gimuuka-shuugyou-kisoku': 'customer-harassment-kigyou-kisoku-gimuuka',
  'kasuharah-taisaku-gimukauka-shugyo-kisoku': 'customer-harassment-kigyou-kisoku-gimuuka',
  'kasuhara-giyomukasentai-kisoku-henkou': 'customer-harassment-kigyou-kisoku-gimuuka',
  'customer-harassment-kiyaku-sakusei': 'customer-harassment-kigyou-kisoku-gimuuka',
  'kasuhara-shugyou-kisoku-taio': 'customer-harassment-kigyou-kisoku-gimuuka',

  // ── 週20時間 ──
  // 「壁とは何か」も「どう管理するか」も、答えは雇用保険・社会保険の加入要件と契約書
  'shuukan-20jikan-hatarakikata-koyou-kubun': 'shuu-20-jikan-roudou-kisoku',
  // パート社保の賃金要件撤廃の2本は互いにほぼ同文。施行日を確定と書かない側を残す
  'part-time-shakai-hoken-yonku-jikan': 'part-time-shakai-hoken-tekiyo-shuuukan-jikan',

  // ── 労働条件通知書の書き方（4本→1本） ──
  'roudou-jouken-tsuuchisho-kakikata': 'roudou-jouken-tsuuchisho-kakikata-chusho',
  'roudou-jouken-tsuuchisho-towa': 'roudou-jouken-tsuuchisho-kakikata-chusho',
  'roudou-jouken-tsuuchisho-koushou-youshiki': 'roudou-jouken-tsuuchisho-kakikata-chusho',

  // ── 就業規則テンプレート・雛形 ──
  'shubyou-kisoku-hinagata-chusho': 'shugyou-kisoku-template-muryou',

  // ── 労務管理×エクセル ──
  'roumu-kanri-excel': 'roumu-kanri-excel-kadai-kaiketsu',

  // ── 労務管理システムの費用・相場（3本→1本） ──
  'roumu-kanri-system-souba-sentaku': 'roumu-kanri-system-hiyou',
  'roumu-system-hiyou-hikaku': 'roumu-kanri-system-hiyou',

  // ── 労務AIの選び方 ──
  'labor-ai-comparison': 'roumu-ai-agent-sentaku-katsuyou',
}

/**
 * GSC上は同じクラスタに見えたが、本文を読むと**別の問い**に答えていたもの。
 * ここに載っているページに canonical を張ってはいけない（張ったら流入を捨てることになる）。
 */
const NOT_DUPLICATE: Record<string, string> = {
  'kasuhara-taisaku-gimuka-2026':
    '施行日と条文例は強い側に譲ると本文で明言し、施行後の「対応記録の残し方」に絞っている',
  'shuukan-20jikan-nennkan-jikan-keisan':
    '問いが「週20時間は年間何時間か」＝換算計算。保険の加入要件の話ではない',
  'houkago-day-service-shugyou-kisoku':
    '放課後等デイサービスは児童福祉法。介護のデイサービスとは事業も根拠法も別',
  '36kyotei-jougen': '問いが「上限は何時間か（月45時間・特別条項）」で、手続きの記事とは別',
  'roudou-jouken-tsuuchisho-mikata': '受け取った側が読む記事。作成側が書く「書き方」とは読者が違う',
  'koyou-keiyakusho-template-download': '問いが「どこでもらえるか」＝入手先。書き方の記事ではない',
  'kouyou-keiyakusho-kakunin-jiko': '問いが「何を確認するか」＝チェックリスト。書き方とは別',
  'shubyou-kisoku-kanri': '問いが「版の更新と参照をどう管理するか」。テンプレの入手先ではない',
  'chusho-kigyou-shubyou-seibi': '問いが「何から作るか（順番）」。ひな形の選び方ではない',
  'labor-saas': '製品カテゴリの説明面。費用の内訳・相場の記事ではない',
  'roumu-ai-dekiru-koto': '問いが「何を任せてよく、何を任せてはいけないか」＝線引き。選び方ではない',
  'roumu-chatbot': '問いが「社内の繰り返し質問を一次対応させたい」。ツール選定ではない',
}

const BASE = 'https://banto-roumu.com'

test('意図した22組が、意図した向きで canonical になっている', () => {
  const actual: Record<string, string> = {}
  for (const u of USECASE_LIST) {
    if (u.canonicalSlug) actual[u.slug] = u.canonicalSlug
  }
  assert.deepEqual(actual, EXPECTED)
})

test('canonical の向きが「弱い側 → 強い側」の絶対URLで出る', () => {
  for (const [weak, strong] of Object.entries(EXPECTED)) {
    const u = getUseCase(weak)
    assert.ok(u, `${weak} が存在しない`)
    assert.equal(canonicalUrlFor(u!), `${BASE}/roumu/${strong}`)
  }
})

test('統合していないページは自分自身が canonical のまま', () => {
  for (const u of USECASE_LIST) {
    if (u.canonicalSlug) continue
    assert.equal(canonicalUrlFor(u), `${BASE}/roumu/${u.slug}`)
  }
})

test('canonical 先は実在する slug で、自己参照でない', () => {
  for (const u of USECASE_LIST) {
    if (!u.canonicalSlug) continue
    assert.notEqual(u.canonicalSlug, u.slug, `${u.slug} が自分自身を canonical にしている`)
    assert.ok(
      USECASE_SLUGS.includes(u.canonicalSlug),
      `${u.slug} の canonical 先 ${u.canonicalSlug} が存在しない`,
    )
  }
})

test('canonical が連鎖しない（強い側は自分で canonical を持たない）', () => {
  for (const u of USECASE_LIST) {
    if (!u.canonicalSlug) continue
    const target = getUseCase(u.canonicalSlug)
    assert.ok(target, `${u.canonicalSlug} が存在しない`)
    assert.equal(
      target!.canonicalSlug,
      undefined,
      `${u.slug} → ${u.canonicalSlug} → ${target!.canonicalSlug} と連鎖している。連鎖は評価が届かない`,
    )
  }
})

test('別の問いに答えていると判定したページには canonical を張っていない', () => {
  for (const slug of Object.keys(NOT_DUPLICATE)) {
    const u = getUseCase(slug)
    assert.ok(u, `${slug} が存在しない`)
    assert.equal(
      u!.canonicalSlug,
      undefined,
      `${slug} は「${NOT_DUPLICATE[slug]}」ため重複ではない。canonical を張ると流入を捨てる`,
    )
  }
})

test('sitemap と canonical が矛盾しない（統合した側は sitemap に載せない）', () => {
  const listed = new Set(SITEMAP_USECASE_SLUGS)
  for (const u of USECASE_LIST) {
    if (u.canonicalSlug) {
      assert.ok(
        !listed.has(u.slug),
        `${u.slug} は canonical を他ページへ向けているのに sitemap に載っている（矛盾したシグナル）`,
      )
    } else {
      assert.ok(listed.has(u.slug), `${u.slug} が sitemap から落ちている`)
    }
  }
  assert.equal(listed.size, 58 - Object.keys(EXPECTED).length)
})

test('canonical 先（強い側）は必ず sitemap に載っている', () => {
  const listed = new Set(SITEMAP_USECASE_SLUGS)
  for (const strong of new Set(Object.values(EXPECTED))) {
    assert.ok(listed.has(strong), `統合先 ${strong} が sitemap に無い。寄せ先が索引されない`)
  }
})

test('app/sitemap.ts が USECASE_SLUGS でなく SITEMAP_USECASE_SLUGS を使っている', () => {
  // lib 側だけ直して app/sitemap.ts を直し忘れると、テストは緑のまま本番が矛盾する。
  // （node --test は app/ の `@/` エイリアスを解決できないので、ソースを直接見る）
  const src = readFileSync(new URL('../../app/sitemap.ts', import.meta.url), 'utf8')
  assert.match(src, /SITEMAP_USECASE_SLUGS\.map/)
  assert.doesNotMatch(src, /\bUSECASE_SLUGS\.map/)
})

test('app/roumu/[slug]/page.tsx の canonical が canonicalUrlFor 経由になっている', () => {
  const src = readFileSync(new URL('../../app/roumu/[slug]/page.tsx', import.meta.url), 'utf8')
  assert.match(src, /alternates:\s*\{\s*canonical:\s*canonicalUrlFor\(u\)\s*\}/)
})

test('記事は1本も消えていない（canonical は削除でも301でもない）', () => {
  assert.equal(USECASE_LIST.length, 58)
  assert.equal(USECASE_SLUGS.length, 58)
})
