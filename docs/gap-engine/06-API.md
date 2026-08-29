# API

認証前と認証後を分ける。本文の永続化は認証後だけ。

## POST /api/zure/analyze  （認証不要）

入力: `multipart` file または JSON `{ paste_text, industry?, headcount_band? }`

制約: 8MB、8 回 / IP / 時、本文を DB に書かない。

成功 200:

```json
{ "persisted": false, "prompt_version": "gap-2026-08-29.1", "sheet": {} }
```

エラー: 400 形式、422 抽出不能、429 制限、503 モデル。

## POST /api/zure/save  （認証必要）

入力: `{ sheet, text_sha256, filename?, source }`  
本文は session 控えと sha256 が一致するときだけ保存。一致しなければ再解析。

副作用: documents, gap_sheets, memories, deadlines, anonymous stats, audit `document.saved`。

## GET /api/sheets/latest

最新のずれ1枚。本文は返さない。

## POST /api/consultations

入力: `{ thread_id?, question }`  
出力: `{ answer_markdown, citations, footer }`  
利用回数を usage_counters.chats に加算。上限超過は 402。

## POST /api/drafts

下書き JSON。上限は diagnoses/drafts。出力に完成・届出ボタンを置かない。

## GET /api/memos/latest

プレーンテキスト。監査 `memo.generated`。

## POST /api/memos/copied

計測専用 `{ bytes }`。

## GET /api/export.json

管理者のみ。自社ルール・記憶・1枚・期限・履歴。Webhook URL と API 生キーは出さない。

## 使ってはいけない API

- 完成就業規則の Word ダウンロード
- 労基署電子申請
- 他社の gap_stats 明細（集計値以外）
