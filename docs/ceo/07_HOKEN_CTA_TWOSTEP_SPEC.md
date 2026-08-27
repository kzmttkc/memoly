# hoken-sim CTA 二段化 — 仕様（姉妹リポ実装）

**目的**: 個人ジョブの価値ピークで会社CTAを一次にしない（送客CTR改善）。  
**実装場所**: `sharoushi-agent.com` の `hoken-sim.html` / `js/hoken-sim.js`（本 banto リポ外）

## 要件

結果カード直後の順序:

1. **一次（個人）**: 「自分の扶養・確定申告がどうなるか無料で聞く」→ 既存 Dify 労務相談  
2. **二次（会社・折りたたみ可）**: 「従業員側の加入対象を会社前提で確認する」→ `banto-roumu.com/zure?...`  
3. メール捕捉はその次（既存 lift ロジック維持可）

計測:

- 一次: `bot_open` props 維持  
- 二次: `banto_cta` props `source=hoken_sim_result_secondary`（一次と分けて分析）

コピー禁止: 顧問比較、社労士置換。

## 受入

モバイルで結果の第一画面内に個人CTAが見える。会社CTAはスクロールまたは「会社の労務担当の方へ」開示の後。
