// CSP の enforce ポリシーが「壊れる方向」へ動くのを止める関門（2026-08-13）。
//
// なぜ要るか:
//   セキュリティ採点で −2 が付いている `script-src 'unsafe-inline'` は、
//   善意で外すと **静的プリレンダのページ（/faq /security /privacy /roumu/*）の
//   inline script が全部ブロックされて画面が死ぬ**。実測済み（next.config.ts の
//   2026-08-13 のコメントに数字がある）。撤去には nonce の配線＝全ページ動的化が要る。
//   採点を上げたい人が next.config.ts を1行編集して本番を落とす経路を機械で塞ぐ。
//
//   逆に、nonce を配線したなら 'unsafe-inline' は**外さなければならない**
//   （nonce があると CSP3 準拠ブラウザは 'unsafe-inline' を無視するので害はないが、
//     残すと古いブラウザで防御が消える）。両方向を1つのテストで縛る。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
const config = read('next.config.ts')
const middleware = read('middleware.ts')

/** enforce 側（const enforced = [...]）の中身だけを切り出す。 */
function enforcedBlock(): string {
  const at = config.indexOf('const enforced = [')
  assert.ok(at > 0, 'next.config.ts に enforced ポリシーが見つからない')
  return config.slice(at, config.indexOf('].join(', at))
}

/** middleware がリクエストごとの nonce を Next へ渡しているか。 */
const hasNoncePlumbing =
  /nonce-\$\{/.test(middleware) && /content-security-policy/i.test(middleware)

test('nonce の配線が無いあいだは enforce の script-src に unsafe-inline を残す', () => {
  const enforced = enforcedBlock()
  const scriptSrc = enforced.match(/script-src [^`\n]*/)?.[0] ?? ''
  assert.ok(scriptSrc.length > 0, 'enforce に script-src が無い')
  if (!hasNoncePlumbing) {
    assert.match(
      scriptSrc,
      /'unsafe-inline'/,
      "middleware に nonce の配線が無い状態で enforce の script-src から 'unsafe-inline' を外している。" +
        ' 静的プリレンダのページ（/faq /security /privacy /roumu/*）は inline script に nonce が' +
        ' 付かないため、全ページでハイドレーションが死ぬ。撤去の条件は next.config.ts の' +
        ' 2026-08-13 コメントを読むこと',
    )
  } else {
    assert.doesNotMatch(
      scriptSrc,
      /'unsafe-inline'/,
      'nonce を配線したなら unsafe-inline は撤去すること（古いブラウザで防御が消える）',
    )
  }
})

test('enforce は unsafe-eval を許していない', () => {
  assert.doesNotMatch(enforcedBlock(), /'unsafe-eval'/, "script-src に 'unsafe-eval' が入っている")
})

test('unsafe-inline を残す代わりの多層防御が全部残っている', () => {
  const enforced = enforcedBlock()
  for (const directive of [
    "script-src-attr 'none'", // インラインイベントハンドラ（onclick=）の実行を全面禁止
    "object-src 'none'",
    "base-uri 'self'", // <base> すり替えによる相対URLスクリプトの乗っ取り防止
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]) {
    assert.ok(
      enforced.includes(directive),
      `${directive} が消えている。'unsafe-inline' を残す前提が崩れる`,
    )
  }
})
