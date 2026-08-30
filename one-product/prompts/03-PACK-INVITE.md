# 3. パック購入 → Free 招待

処理: `../code/pack-invite.ts` / `../code/stripe-webhook.ts`  
表: `../code/invite.sql`  
メール: `../copy/pack-mail.md`

## 流れ

1. Payment Link の `checkout.session.completed` を **banto-roumu.com** の billing webhook が受ける
2. パック判定（Price ID / 既知の pack 金額）なら、有料プラン付与はせず招待処理へ
3. 同じメールで `pack_invites` に記録し、Resend で案内
4. 既にユーザーがいれば `/zure?from=pack` を案内するだけ
5. 未登録なら `/signup?from=pack` → 登録後 Free（会社作成は既存フロー）
6. **パックの Word 配信は Agent Netlify のまま動かす**（触らない）

## Owner

- Stripe 商品名を「就業規則AI カスハラ実務パック」等に揃える
- 台帳 Price をアーカイブ（新規リンク無効化）
