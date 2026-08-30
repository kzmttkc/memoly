/**
 * webhook 分岐メモ（正典）。
 * 実装は app/api/company/billing/webhook/route.ts
 *
 * checkout.session.completed:
 *   1. pack Price → handlePackInvite（プラン付与しない）
 *   2. banto SaaS Price → 既存の plan 付与
 *   3. それ以外 → ignored foreign_product
 */
export {}
