# 現行リポジトリへの接続手順

推測を含む。公開情報ではルート名が /zure であること、保存はユーザー操作後、Anthropic 直結、Supabase RLS であることまで確認済み。内部のファイル名はリポジトリ側に合わせて読み替える。

## 1. エンジン

- `src/` を `lib/gap-engine/` へコピー
- 既存の Claude 呼び出しを `createAnthropicClient` に寄せる。別クライアントでも `LlmClient` さえ満たせばよい

## 2. 解析API

- いまの「ファイルを置いたあとの解析」を `runGapSheet` の戻り値だけを返す形にする
- PDF/docx 抽出は既存を維持し、抽出配列を `markSparsePages` に通す
- レスポンスを保存しない

## 3. 画面

- blocks を `sortBlocks` の順で描く
- p0 を折りたたまず先頭に置く
- disclaimer をシート下部に固定。モデル出力の disclaimer は使わず定数を使う
- 見出しコピーは `docs/11-ZURE-COPY.md`

## 4. 保存

- sha256 照合
- memories は extract プロンプトの high/medium だけ
- `toAnonymousStats` を service role で upsert
- audit `document.saved`

## 5. 相談

- 検索結果は最大8条
- 末尾に `ADVICE_FOOTER`
- usage_counters を日次インクリメント

## 6. 計測

- `gtm/events.ts` を Plausible custom events にマップ
- 10月中は `zure_sheet_generated` と `zure_kasuhara_block_shown` を毎日見る

## 7. 出してはいけない差分

- 新しい製品名
- 完成Word
- 適法スコアの総合点を「合格/不合格」で出すこと（内部の項目数は可）
