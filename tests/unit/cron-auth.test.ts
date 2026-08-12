// 2026-08-13 セキュリティ採点の是正を固定する関門。
//   -1: cron secret の比較が非定数時間（4ルート）
//   -2: /api/health が無認証で DB の生エラーメッセージを返す
// 旧実装（`auth !== \`Bearer ${process.env.CRON_SECRET}\`` / `detail: error.message`）に
// 当てると、下のテストは落ちる。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { verifyCronBearer, timingSafeEqualString } from '../../lib/cron-auth.ts'
import { dbFailureDetail, DB_FAILURE_DETAIL } from '../../lib/health-detail.ts'

// --- 挙動: 定数時間比較そのもの -------------------------------------------
test('timingSafeEqualString は同値でtrue・1文字違い/長さ違いでfalse', () => {
  assert.equal(timingSafeEqualString('Bearer abc', 'Bearer abc'), true)
  assert.equal(timingSafeEqualString('Bearer abc', 'Bearer abd'), false)
  assert.equal(timingSafeEqualString('Bearer abc', 'Bearer abcdefghijklmnop'), false)
  assert.equal(timingSafeEqualString('', ''), true)
})

test('verifyCronBearer は 未設定 / 不一致 / 一致 を区別する', () => {
  assert.equal(verifyCronBearer('Bearer s3cret', 's3cret'), 'ok')
  assert.equal(verifyCronBearer('Bearer wrong', 's3cret'), 'unauthorized')
  assert.equal(verifyCronBearer(null, 's3cret'), 'unauthorized')
  // 秘密が未設定のとき「Bearer undefined」で通ってしまう事故を構造的に防ぐ。
  assert.equal(verifyCronBearer('Bearer undefined', undefined), 'not-configured')
  assert.equal(verifyCronBearer('Bearer undefined', ''), 'not-configured')
})

// --- 関門: 4ルートすべてが定数時間比較を使っている ------------------------
const CRON_ROUTES = [
  'app/api/send-day2-reminder/route.ts',
  'app/api/company/weekly-email/route.ts',
  'app/api/company/deadline-reminder/route.ts',
  'app/api/company/billing/past-due-sweep/route.ts',
]

for (const rel of CRON_ROUTES) {
  const src = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

  test(`${rel} は素の文字列比較で CRON_SECRET を照合していない`, () => {
    assert.doesNotMatch(
      src,
      /!==\s*`Bearer \$\{process\.env\.CRON_SECRET\}`/,
      '短絡評価の === / !== で秘密を比較している。前方一致の長さが応答時間に乗る',
    )
  })

  test(`${rel} は verifyCronBearer を使っている`, () => {
    assert.match(src, /verifyCronBearer\(/, 'lib/cron-auth.ts の定数時間比較を経由していない')
  })
}

// --- 関門: /api/health が生のDBエラーを外へ出さない ------------------------
test('dbFailureDetail は入力の中身を一切返さない（固定文字列のみ）', () => {
  const raw = 'relation "company_members" does not exist'
  const out = dbFailureDetail(raw)
  assert.equal(out, DB_FAILURE_DETAIL)
  assert.ok(!out.includes('company_members'), 'テーブル名が外向きの応答に混ざっている')
  assert.equal(dbFailureDetail(undefined), DB_FAILURE_DETAIL)
  assert.equal(dbFailureDetail(null), DB_FAILURE_DETAIL)
})

test('/api/health が error.message をそのまま detail に載せていない', () => {
  const src = readFileSync(new URL('../../app/api/health/route.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(
    src,
    /detail:\s*error\.message/,
    '無認証エンドポイントが PostgREST の生エラー（テーブル名・制約名）を返している',
  )
  assert.doesNotMatch(
    src,
    /detail:\s*\(e as Error\)\?\.message/,
    '例外メッセージをそのまま返している',
  )
  assert.match(src, /dbFailureDetail\(/, 'lib/health-detail.ts の伏字化を経由していない')
})
