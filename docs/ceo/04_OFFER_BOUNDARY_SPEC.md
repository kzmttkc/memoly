# 売り物境界1枚 — 仕様（/offer）

**目的**: DDと初見ユーザーが「何が無料で、何がいくらか」を一読で取る。  
**公開URL**: `https://banto-roumu.com/offer`  
**関連**: `docs/ceo/01_REQUIREMENTS.md` §4

---

## 1. ページ要件

### 必須セクション（順序固定）

1. **H1**: 就業規則AIで使えるもの（無料と有料）  
2. **境界表**（下表をそのまま）  
3. **最初にやること**: `/zure` へ（ファイルを置く）  
4. **やらないこと**: 手続きSaaSの代替ではない。SmartHR/freee等と併用可  
5. **免責**: 一般的情報提供。個別助言・代行ではない  
6. **旧名注記**: `BRAND_TRANSITION_NOTE`（掲示終了 2026-11-27 まで）

### 境界表（正本）

| 層 | 内容 | 料金 | 場所 |
|---|---|---|---|
| 無料ツール・記事・相談AI | 計算・ガイド・ひな形・その場のずれ1枚 | ¥0・登録不要（保存は登録） | sharoushi-agent.com / banto-roumu.com/zure |
| カスハラ実務パック | Word書式一式 | ¥19,800 一括 | sharoushi-agent.com/kasuhara-pack.html |
| 記録台帳 | 店舗と本部で記録共有 | ¥1,980/月 | sharoushi-agent.com |
| 会社記憶SaaS | 保存・継続相談・規程本数 | 無料枠あり / Entry ¥3,980〜 | banto-roumu.com/pricing |

### 禁止

- 顧問料との金額比較  
- 「全部無料のあとから請求」誤解を招く曖昧表現  
- 4つ目のブランド名・ロゴ刷新（Owner承認前）

### 計測

- `offer_view`（trackOncePerVisit）  
- CTA: `signup_cta_clicked` location=`offer_zure` / `offer_pricing` / `offer_pack`

### 導線

- PublicFooter に「無料と有料の違い」→ `/offer`  
- `/pricing` 冒頭に `/offer` への1行リンク  
- sharoushi フッタ相当は別チケット（姉妹リポ）

---

## 2. 実装メモ

- Server Component 可。金額は `lib/plans.ts` とハードコード表を一致（パック金額は定数化してもよい）。  
- `force-dynamic` は billingEnabled を出す場合のみ。本ページは静的寄りでよいが、plans 参照なら dynamic でも可。  
- 英語面は P0 対象外。
