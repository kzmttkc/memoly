# FUNNEL_EVENTS — 就業規則AI 計測正典

最終更新: 2026-08-29（CEO P0・評価3軸PDCA）

原則: **新イベントは最小**。既存名を優先。PII禁止。hostname は `banto-roumu.com` と `sharoushi-agent.com` を混ぜて解釈しない。

---

## 北の星（P0）

| イベント | 面 | 定義 | 備考 |
|---|---|---|---|
| `zure_landing` | banto `/zure` | 入口到達（1訪問1回） | props `source` / `medium` で送客元を区別。`zure_sheet_shown` との落差＝置く前離脱 |
| `zure_sample_clicked` | 同上 | 「サンプルの本文で1枚にする」クリック | 北の星の分母に入れない |
| `zure_sheet_shown` | banto `/zure` | ファイルまたは貼付からずれ1枚が表示された | **fileTarget の代理指標**。props `rows` と `source`（`file`/`paste`/`sample`）。**外部ゲートは `source!=sample` のみ** |
| `zure_sheet_generated` | banto `/zure` | 1枚生成完了（エンジン付き） | props: `ms`, `pages_read`, `pages_unread`, `p0_unwritten`, `p1_unwritten`。10月は毎日見る |
| `zure_kasuhara_block_shown` | banto `/zure` | カスハラ p0 ブロック表示 | props: `unwritten_count`。義務化キャンペーンの証拠 |
| （将来）`zure_file_accepted` | 同上 | サーバが extract 200 を返した瞬間 | 必要になるまで増やさない |

**QA除外**: 社内検証IP・既知テストアカウントは週次レビューで手除外。自動化除外は後追い。

**目標**: 外部由来の `zure_sheet_shown` ≥ `lib/offer.ts` の `fileTarget`（10）by `killDate`（2026-10-01）。

---

## 商業

| イベント | 定義 |
|---|---|
| `signup_started` | 登録画面到達（1訪問1回・trackOncePerVisit） |
| `signup_completed` | 登録完了 |
| `signup_cta_clicked` | CTAクリック。`location` で面を区別（`zure_save` / `offer_zure` 等） |
| `signup_blocked_age` / `signup_blocked_consent` | 送信時に年齢・規約チェック未完で止まった（11→3崖の内訳） |
| `subscription_started` | Checkout成功後。props `plan` |
| `churned` / `payment_failed` / `payment_recovered` | 課金コホート（analytics.ts） |

---

## 獲得・境界

| イベント | 定義 |
|---|---|
| `offer_view` | `/offer` 閲覧（1訪問1回） |
| `banto_cta` | sharoushi面から就業規則AI（zure等）へのCTAクリック |
| `banto_cta_section_view` | 同CTAセクションの表示 |

---

## 継続（堀）

| イベント | 定義 |
|---|---|
| `company_heartbeat` | 会社面の別日再訪（age_bucket） |
| `returning_user` | サイト別日再訪 |
| `kasuhara_gap_run` / `kasuhara_gap_shown` | zure内カスハラギャップ |

---

## 解釈ルール

1. コミット数・E2E PASS を北の星にしない。  
2. `banto_cta` CTR は人ベースで見る（view 対 click）。  
3. パック支払は Stripe 実売（姉妹 GTM_EXIT）。Plausible だけでは足りない。
