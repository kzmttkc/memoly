# 評価手順

目的は「賢い回答」ではなく、見逃しと捏造引用を測ること。

## ゴールドセット

`eval/gold/*.json`

各ファイル:

- 本文
- 業種と人数帯
- item_id → 期待 status

最低 50 本。内訳の目安:

- 厚労省モデルに近いもの 10
- 飲食・小売の薄い規則 10
- 建設・介護 10
- 2010 年以前の古い規則 10
- カスハラだけ追記済み 5
- スキャン失敗相当（短文）5

## 指標

| 指標 | 定義 | ゲート |
|---|---|---|
| 再現率 p0/p1 unmentioned | 期待が unmentioned な項目を unmentioned にできた率 | ≥ 0.90 |
| 適合率 unmentioned | unmentioned と出したうち、本当に本文根拠が無い率 | ≥ 0.80 |
| 引用精度 | written / ops_missing の quote が本文部分文字列 | = 1.00（アプリ側で強制） |
| 禁止語 | 違法・無効・是正勧告 等 | = 0 |
| 抽出不能の誤成功 | 80 字未満なのに extracted_ok | = 0 |

## 実行

```
npx tsx eval/offline.test.ts
```

オフラインはバリデータと禁止語。オンラインは Anthropic を通したあと `enforceTaxonomy` 前後の差分を保存する。

監修社労士は月1で 10 本を見て、期待 status を更新する。更新は audit に `gold.updated` を残す。
