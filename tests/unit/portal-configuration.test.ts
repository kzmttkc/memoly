// ポータルが「番頭専用の設定」を必ず指すことを縛る（2026-07-30 実測で判明した罠）。
//
// なぜ機械で縛るか:
//   Stripe は全製品で1アカウントを共有している。billingPortal.sessions.create で
//   configuration を省略すると、アカウント既定の「デフォルト」設定が使われる。
//   その中身を 2026-07-30 に実測したところ、プラン切替が有効で、切替先リストに
//   **UITruth の3プランだけ**（Starter ¥2,980 / Pro ¥9,800 / Agency ¥29,800）が
//   入っていた。省略した瞬間、番頭の顧客がポータルから他製品のプランへ乗り換えられる。
//   席数トリガも課金UIも監査ログも通らない経路になる。
//
//   これは「動くけれど間違っている」型の欠陥で、型検査にもビルドにも出ない。
//   しかも消しても誰も気づかない（ポータルは開くので）。だからここで縛る。
// Run: npm run test:unit
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const route = readFileSync(
  new URL('../../app/api/company/billing/portal/route.ts', import.meta.url),
  'utf8',
)

test('ポータルセッションに configuration を渡している', () => {
  assert.match(
    route,
    /billingPortal\.sessions\.create\(\{[^}]*configuration:/s,
    'configuration の指定が無い。アカウント既定にフォールバックし、' +
      '番頭の顧客が UITruth のプランへ乗り換えられる状態に戻る',
  )
})

test('設定IDは env ではなく定数（未設定で既定に落ちない）', () => {
  assert.match(
    route,
    /const BANTO_PORTAL_CONFIGURATION = 'bpc_[A-Za-z0-9]+'/,
    'env 参照にすると、未設定の環境で静かにアカウント既定へフォールバックする。' +
      '設定IDは秘密ではないので定数で持つ',
  )
  assert.doesNotMatch(
    route,
    /configuration:[^,\n]*process\.env/,
    'configuration に env を直接渡している。未設定時に undefined ＝ 既定にフォールバックする',
  )
})
