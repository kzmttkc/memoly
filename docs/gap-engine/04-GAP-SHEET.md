# 仕様 — ずれ1枚（Gap Sheet）

ID: SPEC-GAP-001
対象画面: `/zure`（登録前）および保存後の `/company/sheets/:id`

## 1. ユーザーの仕事

置いたファイルから、読んで分かることと、このファイルでは分からないことを1枚にする。適法・違法の判定はしない。

## 2. 入力

| フィールド | 型 | 制約 |
|---|---|---|
| source | `file` \| `paste` | 必須 |
| filename | string | file のとき必須。拡張子 pdf / docx / txt |
| mime | string | application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain |
| bytes | binary | 最大 8MB。画像のみPDFは本文0として失敗させる |
| paste_text | string | 最大 200,000 字 |
| locale | `ja` | 固定 |
| hint_industry | string? | 任意。製造/飲食/IT/介護/建設/美容/その他 |
| hint_headcount_band | string? | 1-9 / 10-20 / 21-50 / 51-100 / 101+ |

パスワード付きPDF、.doc、Pages、画像は受けない。画面に変換手順を出す。

## 3. 保存タイミング

1. 抽出テキストはブラウザメモリと `sessionStorage` に 24 時間だけ控える。キー `zure_draft_v1`。
2. サーバへ送るのは分析APIのみ。本文はレスポンス生成に使い、DBには書かない。
3. 「残す」操作後に `documents` と `gap_sheets` へ書く。
4. 同一IP+UAから分析APIは 8 回 / 60 分。超えたら 429。
5. 「この控えを消す」で sessionStorage と画面状態を消す。

## 4. 出力スキーマ

```json
{
  "schema_version": "2026-08-29.1",
  "disclaimer": "この1枚は、置いたファイルから読み取れた範囲の整理です。不足の断定でも、適法性の保証でもありません。届出用の完成書類ではありません。最終判断は必要に応じて専門家へ確認してください。",
  "document": {
    "title_guess": "string",
    "page_count": 0,
    "pages_read": 0,
    "pages_unread": [1],
    "char_count": 0,
    "extracted_ok": true
  },
  "summary": {
    "headline": "このファイルから読み取れたこと",
    "written_count": 0,
    "ops_missing_count": 0,
    "unmentioned_count": 0,
    "unread_note": "string|null"
  },
  "blocks": [
    {
      "id": "kasuhara.policy",
      "group": "kasuhara_2026_10",
      "title": "カスタマーハラスメントの方針",
      "status": "written | ops_missing | unmentioned | unread | not_applicable",
      "priority": "p0_deadline | p1_absolute | p2_dispute | p3_optional",
      "deadline": "2026-10-01",
      "what_found": "ファイル中の根拠（引用は短く）",
      "what_not_found": "このファイルから読めなかったこと",
      "why_it_matters": "一般的な位置づけ。違法とは書かない",
      "next_step": "専門家に渡すときの問い",
      "citations": [{"quote": "…", "approx_locus": "第12条"}]
    }
  ],
  "contradictions": [
    {
      "id": "c1",
      "priority": "p1_absolute",
      "left": {"locus": "第10条", "quote": "所定 8 時間"},
      "right": {"locus": "第22条", "quote": "勤務は現場の指示による"},
      "note": "同じファイル内で読み方が分かれうる、という指摘にとどめる"
    }
  ],
  "followups": [
    "カスハラの相談窓口は誰か、このファイルからは分からない"
  ]
}
```

### status の定義（厳格）

| status | 使うとき | 使ってはいけないとき |
|---|---|---|
| written | 方針または手続の本文がある | 「触れている」だけで運用まで書いたとみなす |
| ops_missing | 制度の存在は読めるが、窓口・期限・手続・周知がない | 少しでも運用文があるのに欠落としない |
| unmentioned | このファイルの抽出範囲から該当語も趣旨も取れない | 「法律上必要だから欠けている」と断定する |
| unread | 対象が未読ページにしかなさそう | 読めたページで判断できるのに使う |
| not_applicable | 相対的記載で、制度自体を置いていないと読める | 絶対的記載事項に使う |

禁止語: 「違法」「無効」「是正勧告される」「必ず追加せよ」「このまま届出できない」。
許可語: 「このファイルからは読み取れませんでした」「運用の書き方はまだありません」「不足の断定ではありません」。

## 5. 表示順

1. 未読ページがあるときの警告
2. p0 カスハラ・求職者セクハラ（施行 2026-10-01）
3. p1 絶対的記載事項
4. ファイル内矛盾
5. p2 紛争で不利になりやすい任意・相対
6. p3 その他
7. 固定ディスclaimer

1画面に収める。詳細は行を開く。印刷用は A4 相当のテキスト。

## 6. チェック項目マスター

実装は `src/taxonomy/items.ts`。グループは変えない。

### G0 カスハラ / 求職者セクハラ（p0）

厚労省指針の措置に対応。コードを集計キーにする。

- `kasuhara.policy` 方針の明確化と周知
- `kasuhara.definition_and_response` 内容と対処の周知
- `kasuhara.window` 相談窓口の設置と周知
- `kasuhara.window_capability` 窓口が対応できる体制
- `kasuhara.factfinding` 事実確認
- `kasuhara.victim_care` 被害者への配慮
- `kasuhara.recurrence` 再発防止
- `kasuhara.egregious` 悪質事案の対処方針
- `kasuhara.privacy` 相談者のプライバシー
- `kasuhara.no_retaliation` 不利益取扱い禁止
- `jobseeker_sekuhara.window` 求職者等セクハラの相談窓口

### G1 絶対的記載（p1）労基法89条

- `abs.hours_start_end` 始業・終業の時刻
- `abs.break` 休憩
- `abs.holidays` 休日
- `abs.leave` 休暇（年次有給を含む）
- `abs.shift` 交替制がある場合の転換
- `abs.wage_decide_calc_pay` 賃金の決定・計算・支払方法
- `abs.wage_cutoff_paydate` 締切と支払時期
- `abs.raise` 昇給
- `abs.retirement` 退職
- `abs.dismissal` 解雇事由

### G2 運用が落ちやすい絶対・準絶対（p1-p2）

- `ops.annual_leave_grant` 有給付与の起算と日数
- `ops.annual_leave_5days` 年5日の時季指定
- `ops.36_agreement` 36協定への言及または別紙
- `ops.overtime_cap` 時間外の上限の考え方
- `ops.pay_rate` 割増率
- `ops.notice_period` 解雇の手続

### G3 改正・紛争（p2）

- `rel.power_harassment`
- `rel.sexual_harassment`
- `rel.maternity_harassment`
- `rel.ikuji_kaigo`
- `rel.flexible_work_2025_10`
- `rel.muki_tenkan`
- `rel.secondary_job`
- `rel.telework`
- `rel.disciplinary`
- `rel.retirement_allowance`

## 7. 失敗時

| 条件 | HTTP | 画面 |
|---|---|---|
| 未対応形式 | 400 | 変換手順 |
| 0文字 | 422 | 画像PDFの可能性を案内 |
| レート | 429 | 何分後に再実行できるか |
| モデル失敗 | 503 | 本文は控えに残し、再実行 |

本文をログに出さない。エラーIDだけ残す。
