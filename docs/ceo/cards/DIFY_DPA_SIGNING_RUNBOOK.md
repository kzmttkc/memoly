# Dify DPA 署名手順（Owner実行）

**決裁**: A（2026-08-29）  
**締切目標**: 2026-09-15  
**発効条件**: 記入・署名済み Addendum を Dify が受領したとき

## 1. 文書を開く

- PDF: https://dify.ai/assets/legal/data-protection-agreement.pdf  
- 相手方: LangGenius, Inc.（Dify）  
- 送付先: **privacy@dify.ai**

## 2. 記入する箇所（Exhibit B / data exporter）

Customer（data exporter）として、少なくとも次を埋める。

| 欄 | 記入案（要確認） |
|---|---|
| 正式名称 | 現時点の運営名義（個人事業 or 法人名）※Ownerが確定 |
| 住所 | 特定商取引法表記と同じ所在地 |
| 連絡先メール | Ownerの業務用メール |
| 署名・日付 | Owner本人 |

※法人化前でも、現状の契約主体名で署名する。法人化後は名義変更を検討。

## 3. 送付メール（コピー）

```
To: privacy@dify.ai
Subject: Data Processing Addendum — [正式名称] / banto-roumu.com

Hello,

Please find attached our completed and signed Data Processing Addendum
for LangGenius, Inc. (Dify), for the customer account associated with
banto-roumu.com / 就業規則AI.

Customer legal name: [正式名称]
Primary contact: [氏名] <[メール]>

Thank you.
```

## 4. 送付後

1. 送信日時・添付ファイル名をこのリポ外の控えに残す  
2. CEOへ「送付済」と一言（チャットで可）  
3. CEOが `docs/compliance/vendor-dpa-register.md` を **有効** に更新  
4. 受領確認メールが来たら同台帳に確認日を追記  

## 5. 注意

- 送付完了前に公開面へ「DPA締結済」と書かない  
- 2026-08-12 の「Dify対応不要」裁定は、本決裁（A）により**上書き**
