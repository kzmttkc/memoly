# 決裁カード草案 — BILLING_ENABLED 本番解禁（Owner向け）

**提出条件**: 外部 `zure_sheet_shown`(source≠sample) ≥ ペース黄 かつ技術チェック ✅  
**提出者**: CEO  
**種別**: 不可逆（課金解禁）— **Ownerのみ実行可**  
**状態**: **草案（file未達のため未提出）** — 有料1社への道の準備のみ完了

## 現状（2026-08-29）

- file=**2**/10（ペース上は onTrack、提出閾値は黄以上を再確認）
- 有料=**0**
- E2E=課金ライフサイクルは別途日次確認（解禁前に ✅ 必須）
- `/offer` 本番: **済**
- ヘッダ・1枚後・説明面から `/offer` 導線: **済**
- BILLING_ENABLED 本番: **false（解禁しない）**

## チェックリスト参照

`docs/ceo/05_BILLING_UNLOCK_CHECKLIST.md`

CEO進捗メモ:

| 項目 | 状態 |
|---|---|
| `/offer` 本番 | ✅ |
| 禁止コピー監査（offer） | ✅（テストあり） |
| DPA方針文書 | ✅ Owner決裁 **A**（送付手続中） |
| 外部 file ペース黄以上 | ❌ 未達（提出ブロック） |
| Stripe / E2E / ダニング本番通 | 解禁直前に再確認 |

## 提案文（fileゲート通過後にコピー）

```
【決裁依頼】BILLING_ENABLED 本番解禁
現状の数字: file= / 有料=0 / E2E=
提案: 本番で Entry 課金を受け付ける
やらない代替: 解禁せず無料のみ継続（買収物語は遅延）
期限: 
Ownerの選択肢: 承認 / 却下 / 条件付き
```

## 有料1社までの執行順（解禁前でも進める）

1. file→10（送客 mid CTA → /zure → sheet）
2. DPA Owner決裁（本リポ `2026-09-15_DIFY_DPA.md`）
3. 本カード提出 → Ownerが `BILLING_ENABLED=true`
4. Entry 1社の獲得（`/offer` → pricing → checkout）

## CEO注記

fileTarget未達の週は本カードを**提出しない**。解禁操作もしない。
