# P0 — BILLING 解禁チェックリスト（Owner決裁用）

CEOがすべて ✅ にしたら、Ownerへ決裁カードを出す。  
**解禁操作（BILLING_ENABLED=true）は Owner のみ。**

## 技術

- [ ] 課金ライフサイクル E2E が緑（日次 cron）
- [ ] Stripe Price ID が test/live で整合（plans.ts env）
- [ ] `/tokushoho` と料金表示が一致（免税・インボイス不能の先出し）
- [ ] ダニング・解約フローが本番で通る（runbook: `docs/BANTO_BILLING_UNLOCK_RUNBOOK.md`）

## 商業・計測

- [ ] `subscription_started` / `churned` が発火確認済み
- [ ] 外部 `zure_sheet_shown` が少なくともペース上黄以上
- [ ] `/offer` が本番公開済み

## 法務

- [ ] DPA方針が文書化（`docs/ceo/06_DPA_POSTURE.md`）
- [ ] 禁止コピーが有料面に混入していない（offer FORBIDDEN）

## 決裁カード文面（コピー用）

```
【決裁依頼】BILLING_ENABLED 本番解禁
現状の数字: file= / 有料=0 / E2E=
提案: 本番で Entry 課金を受け付ける
やらない代替: 解禁せず無料のみ継続（買収物語は遅延）
期限: 
Ownerの選択肢: 承認 / 却下 / 条件付き
```
