# One Product — CHECKLIST

## 1. 契約名

- [x] Banto terms / privacy / tokushoho が `SERVICE_LEGAL_NAME`（就業規則AI・両ドメイン・旧称）
- [x] Agent terms / tokutei / privacy の冒頭が同じ一文
- [x] 窓口が `support@banto-roumu.com` のみ（contact@ 0件）
- [x] フッターに旧称1行

## 2. SKU

- [x] /offer 表が3系統（登録前0 / 月額 / パック19,800）。台帳は新規停止注記のみ
- [x] Agent「記録を会社で共有」新規カードをパックLPから除去
- [x] ledger Buy が Payment Link を再注入しない
- [x] Owner: Stripe 台帳 Price アーカイブ・商品名「就業規則AI …」（2026-08-31 Owner完了）

## 3. Agent CTA

- [x] ヒーロー主ボタンが1つ「ファイルを置く」
- [x] `utm_source=sharoushi&utm_campaign=one_product`
- [x] 「足りない措置」「無料で相談」がヒーローに無い

## 4. パック → Free

- [x] Owner: Supabase に `supabase/pack_invites.sql` を適用（2026-08-31 Owner完了）
- [x] banto webhook が pack checkout を招待処理（Word配信は触らない）
- [ ] Owner: Resend（DIGEST_FROM_EMAIL）確認後、購入翌日に同じメールで /zure または invite が届く

## 完了の定義

顧客が契約・領収書・画面のどこを見てもサービス名が就業規則AIで、パック購入の翌日にずれ1枚を残せる。
