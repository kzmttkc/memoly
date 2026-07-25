// ============================================================================
// lib/checkout-url.ts — Stripe Checkout success_url/cancel_url 生成の純関数
// ----------------------------------------------------------------------------
// 2026-07-26 バグ根絶用に lib/stripe.ts から分離。
//   経緯: returnUrl は呼び出し側(checkout route)で既に `?companyId=<uuid>` を
//   付与済み。そこへ無条件に `?billing=...` を足すと `?companyId=<uuid>?billing=success`
//   という不正なクエリ文字列（`?`が2つ）になり、billing クエリが companyId 値の
//   一部として誤解釈される（実測: Stripeの「戻る」導線で403・subscription_started
//   計測が構造的に一度も発火しない。2026-06-27〜2026-07-26 約1ヶ月本番で無自覚に稼働）。
//
//   この関数を外部依存ゼロの純関数として切り出すことで、Next全体をビルドせず
//   node --test で数十msで直接検証できる（tests/unit/checkout-url.test.ts）。
//   scripts/billing_lifecycle_e2e.mjs（出荷ゲート）からも同一関数を直接importして
//   二重に検知する（フル e2e が動かない状況でもこのバグ種別だけは常に拾える）。
// ============================================================================
export function buildBillingReturnUrls(returnUrl: string): { successUrl: string; cancelUrl: string } {
  const separator = returnUrl.includes('?') ? '&' : '?'
  return {
    successUrl: `${returnUrl}${separator}billing=success`,
    cancelUrl: `${returnUrl}${separator}billing=canceled`,
  }
}
