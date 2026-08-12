// 2026-08-13 番頭 +18点の是正を固定する関門（機能 B-7 / UX B-6）。
//   旧実装に当てると落ちるように書く。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// 機能 -2 その1: 解約を管理画面で完結させる（portal API が未配線だった）
// ---------------------------------------------------------------------------
test('DataSecuritySection から BillingPortalCard が呼ばれている（portal APIが孤児でない）', () => {
  const src = read('app/(app)/company/_components/DataSecuritySection.tsx')
  assert.match(src, /import \{ BillingPortalCard \}/, 'BillingPortalCard を取り込んでいない')
  assert.match(src, /<BillingPortalCard\b/, '画面に配置されていない＝どこからも解約できない')
})

test('BillingPortalCard は /api/company/billing/portal を叩く', () => {
  const src = read('app/(app)/company/_components/BillingPortalCard.tsx')
  assert.match(src, /'\/api\/company\/billing\/portal'/)
  assert.match(src, /method: 'POST'/)
})

test('ポータルは「期間末解約」でなければセッションを作らない（公開表記の虚偽化を防ぐ）', () => {
  const src = read('app/api/company/billing/portal/route.ts')
  assert.match(
    src,
    /billingPortal\.configurations\.retrieve\(/,
    'ポータル設定の実値を取りに行っていない。Stripe 側で設定を変えられると公開表記が黙って虚偽になる',
  )
  assert.match(src, /at_period_end/, '期間末解約であることを検査していない')
  assert.match(src, /PORTAL_MISCONFIGURED/, '不一致時に開かない経路が無い')
})

// ---------------------------------------------------------------------------
// 機能 -2 その2: 解約条件の3面（/tokushoho・/pricing・FAQ）を実装事実に一致させる
// ---------------------------------------------------------------------------
const CANCEL_SURFACES: [string, string][] = [
  ['app/tokushoho/page.tsx', '/tokushoho'],
  ['app/pricing/page.tsx', '/pricing'],
]

for (const [rel, label] of CANCEL_SURFACES) {
  test(`${label} が「管理画面で解約できない」と書いていない`, () => {
    const src = read(rel)
    assert.doesNotMatch(
      src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), // 経緯コメントは対象外
      /解約手続きを完了する機能は提供しておらず/,
      '自己解約導線を通したのに旧表記が残っている（実装と公開表記の食い違い）',
    )
  })
  test(`${label} が自己解約の場所を書いている`, () => {
    assert.match(read(rel), /お支払いと解約の管理/, '解約の入口が書かれていない')
  })
}

test('FAQ の解約回答が自己解約導線に一致している', () => {
  // lib/faq.ts は '@/lib/...' 別名を含むため import せず、該当回答をテキストで切り出す。
  const faq = read('lib/faq.ts')
  const qAt = faq.indexOf("q: '解約や退会はいつでもできますか'")
  assert.ok(qAt > 0, '解約のFAQが見つからない')
  const answer = faq.slice(qAt, faq.indexOf('\n  },', qAt))
  assert.doesNotMatch(
    answer,
    /手続きを完了する機能を提供しておらず/,
    'FAQ だけ旧表記のまま＝3面の食い違いが再発している',
  )
  assert.match(answer, /お支払いと解約の管理/)
  assert.match(answer, /末日まで/, '利用可能期間の記載が落ちている')
})

// ---------------------------------------------------------------------------
// 機能 -2 その3: 参照ゼロの ThemeToggle（D11 でヘッダから撤去済み）を残さない
// ---------------------------------------------------------------------------
test('ThemeToggle は削除済み（テーマ切替はコマンドパレットが正典）', () => {
  assert.equal(
    existsSync(new URL('../../components/ui/ThemeToggle.tsx', import.meta.url)),
    false,
    'AppShell の D11 でヘッダから撤去された結果、参照0の死んだ部品になっていた。' +
      '復活させるなら AppShell へ配置し、D11 の判断を書き換えること',
  )
})

test('テーマ切替の機能自体は失われていない（コマンドパレットに残る）', () => {
  const src = read('app/(app)/company/_components/CommandPalette.tsx')
  assert.match(src, /useTheme\(\)/, 'テーマ切替の唯一の入口まで消えている')
})

// ---------------------------------------------------------------------------
// UX 2-11: 管理画面が「退会（全データ削除）」しか出さない罠
// ---------------------------------------------------------------------------
test('管理画面に非破壊の選択肢がある（admin=解約 / member=説明）', () => {
  const src = read('app/(app)/company/_components/DataSecuritySection.tsx')
  assert.match(src, /isAdmin && companyId && <BillingPortalCard/, 'admin に解約の選択肢が無い')
  assert.match(src, /\{!isAdmin && \(/, 'member 向けの説明が無く、削除ボタン1個の画面のまま')
  assert.match(src, /管理者が行えます/)
})

// ---------------------------------------------------------------------------
// UX 2-5: 第三者監査の有無に触れていない（隠していると読まれる）
//   brand.md の裁定により、運営者自身の資格・監修・登録状態には肯定形でも
//   否定形でも触れない。「この記載の根拠」という形で答える。
// ---------------------------------------------------------------------------
test('/security が記載の根拠（外部監査を受けていないこと）を開示している', () => {
  const src = read('app/security/page.tsx')
  assert.match(
    src,
    /外部機関による監査・認証を受けたものではありません/,
    '第三者監査の有無に一言も触れていない＝隠していると読まれる',
  )
})

test('/security が運営者の資格・監修・登録状態に触れていない（brand.md 裁定）', () => {
  const body = read('app/security/page.tsx').replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*|\/\*[\s\S]*?\*\//g, '')
  for (const banned of ['社会保険労務士', '社労士', '監修', '有資格', '試験合格']) {
    assert.ok(!body.includes(banned), `運営者の資格に関する語「${banned}」が本文にある`)
  }
})

// ---------------------------------------------------------------------------
// UX 1-5: Cookie バナーの第1画面占有（44px のタップ標的は縮めない）
// ---------------------------------------------------------------------------
test('Cookieバナーは縦paddingを詰め、タップ標的は44pxを保つ', () => {
  const src = read('components/ui/CookieBanner.tsx')
  assert.match(src, /px-4 py-0\.5/, '器の縦padding（py-2=8px×2）が詰められていない')
  assert.match(src, /min-h-11 min-w-11/, 'タップ標的を縮めて高さを稼いでいる（WCAG 2.5.5 退行）')
})

// ---------------------------------------------------------------------------
// UX 3-7: ハニーポットが視覚・支援技術の両方から隠れているか（未確認だった）
// ---------------------------------------------------------------------------
test('ハニーポット lc-website は aria-hidden かつ tabIndex=-1 かつ画面外', () => {
  const src = read('app/business/_components/LeadCapture.tsx')
  // 冒頭の説明コメントにも "honeypot" があるため、実際の markup（htmlFor="lc-website"）を起点にする。
  const at = src.indexOf('htmlFor="lc-website"')
  assert.ok(at > 0, 'ハニーポット入力そのものが無い＝ボット対策が消えている')
  const block = src.slice(Math.max(0, at - 400), at + 500)
  assert.match(block, /aria-hidden/, '支援技術に読み上げられ、視覚障害のある利用者が入力してしまう')
  assert.match(block, /tabIndex=\{-1\}/, 'キーボード操作でフォーカスが入る＝人間が誤入力する')
  assert.match(block, /-left-\[9999px\]/, '視覚的に隠れていない')
  assert.match(block, /autoComplete="off"/, 'ブラウザの自動入力がボット判定を誤爆させる')
})
