# 番頭(Banto) 公開API v1 仕様書

最終更新: 2026-07-23（E08 初版・read系のみ）

会社の記憶と労務期限を、外部システム（社内ダッシュボード・スプレッドシート連携・他SaaS）から読み取り専用で取得できます。書き込み系のエンドポイントは v1 では提供しません。

- ベースURL: `https://banto-roumu.com`
- 形式: JSON / UTF-8
- 認証: APIキー（Bearer）
- 文字どおり read-only（GET のみ）

## 認証

設定画面（プランと設定 → 連携とAPI）で管理者がAPIキーを発行できます。キーは `banto_sk_` で始まり、**発行直後に一度だけ表示されます**（サーバーにはSHA-256ハッシュのみ保存されるため、再表示はできません）。

```
Authorization: Bearer banto_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- キーは会社単位です。キーで取得できるのは、そのキーを発行した会社のデータのみです。
- 失効は設定画面からいつでも行えます。失効後は即時に 401 になります。
- キーの発行・失効は監査ログに記録されます。

## レート制限

プランに応じた日次リクエスト上限があります（無料モニター: 500/日、Entry: 2,000/日、Standard: 5,000/日、士業: 20,000/日）。超過時は 429 を返します。

## エラー形式

```json
{ "error": { "code": "unauthorized", "message": "APIキーが無効か、失効しています。" } }
```

| status | code | 意味 |
|---|---|---|
| 400 | invalid_cursor | cursor の形式が不正 |
| 401 | unauthorized | APIキーが無い・無効・失効済み |
| 429 | rate_limited | 日次上限超過 |
| 500 | internal_error | サーバー内部エラー |

## GET /api/v1/memories

会社の記憶（相談の要約・自社判断・ルール候補）を新しい順で返します。

クエリパラメータ:

| name | type | 既定 | 説明 |
|---|---|---|---|
| limit | integer | 20 | 1〜100 |
| cursor | string | — | 前ページの `next_cursor`（created_at ISO文字列） |
| type | string | — | `summary` / `decision` / `rule` で絞り込み |

レスポンス:

```json
{
  "object": "list",
  "data": [
    {
      "id": "8b1c…",
      "summary": "育休の申し出があり、就業規則第25条に基づき…",
      "memory_type": "decision",
      "topic": "育休",
      "subject": "Aさん(育休)",
      "decided_at": "2026-07-20T02:15:00.000Z",
      "created_at": "2026-07-20T02:15:00.000Z"
    }
  ],
  "has_more": true,
  "next_cursor": "2026-07-20T02:15:00.000Z"
}
```

例:

```bash
curl -s "https://banto-roumu.com/api/v1/memories?limit=50" \
  -H "Authorization: Bearer $BANTO_API_KEY"
```

## GET /api/v1/deadlines

登録済みの労務期限を期日の近い順で返します。

クエリパラメータ:

| name | type | 既定 | 説明 |
|---|---|---|---|
| limit | integer | 100 | 1〜200 |
| all | string | — | `1` で無効化済みの期限も含める |

レスポンス:

```json
{
  "object": "list",
  "data": [
    {
      "id": "f21a…",
      "title": "36協定の更新",
      "note": "所轄労基署へ届出",
      "due_on": "2027-03-31",
      "recurrence": "yearly",
      "source": "suggested",
      "active": true,
      "created_at": "2026-07-23T09:00:00.000Z",
      "updated_at": "2026-07-23T09:00:00.000Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

## OpenAPI 3.1（抜粋）

```yaml
openapi: 3.1.0
info:
  title: Banto Public API
  version: "1.0"
servers:
  - url: https://banto-roumu.com
components:
  securitySchemes:
    apiKey:
      type: http
      scheme: bearer
      bearerFormat: banto_sk_...
security:
  - apiKey: []
paths:
  /api/v1/memories:
    get:
      summary: 会社の記憶一覧（新しい順・カーソルページング）
      parameters:
        - { name: limit,  in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
        - { name: cursor, in: query, schema: { type: string, format: date-time } }
        - { name: type,   in: query, schema: { type: string, enum: [summary, decision, rule] } }
      responses:
        "200": { description: OK }
        "401": { description: APIキーが無効 }
        "429": { description: レート制限超過 }
  /api/v1/deadlines:
    get:
      summary: 労務期限の一覧（期日昇順）
      parameters:
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 200, default: 100 } }
        - { name: all,   in: query, schema: { type: string, enum: ["1"] } }
      responses:
        "200": { description: OK }
        "401": { description: APIキーが無効 }
        "429": { description: レート制限超過 }
```

## セキュリティ設計（実装メモ）

- 生キーは保存しない（SHA-256ハッシュのみ・`supabase/company_integrations.sql`）。
- 認証後の全クエリはアプリ層で `company_id` スコープを強制（`lib/api-keys.ts` 参照）。
- レート制限は既存の `memoly_increment_api_usage` に相乗り（kind=`api_v1`・会社単位）。
- キーの発行・失効は `company_audit_logs` に記録（metadata は prefix のみ）。
