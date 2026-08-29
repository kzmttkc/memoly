# アーキテクチャ

現行どおり。新しい基盤を増やさない。

```
ブラウザ /zure
  └ ファイル選択 or 貼付
      └ sessionStorage 24h（サーバ未保存）
          └ POST /api/zure/analyze   本文は推論のみ
              └ Anthropic Messages API
                  └ validateSheet（引用が本文に無ければ unmentioned に落とす）
                      └ JSON を画面へ。DB には書かない

「残す」
  └ POST /api/zure/save  (要ログイン)
      ├ documents.extracted_text
      ├ gap_sheets.payload
      ├ memories（high/medium のみ、PII 除去後）
      ├ deadlines（p0 の 2026-10-01）
      └ gap_stats_anonymous へ item_id と status だけ upsert
```

## 信頼境界

| 層 | 役割 |
|---|---|
| ブラウザ | 登録前本文の控え。共有PC注意を画面に出す |
| Next.js Route | レート制限、形式検査、PII の機械的マスク、モデル呼び出し |
| validateSheet | ハルシネーション引用の破棄、禁止語の除去、項目の欠番補完 |
| Supabase RLS | 会社行の分離。匿名集計は service role のみ |
| Anthropic | 学習に使わない契約。本文はプロンプトの DATA ブロック |

## モデル分担

- ずれ1枚 / 記憶抽出 / 下書き / メモ: Claude, temperature 0
- 相談: Claude, temperature 0.2
- 記憶のベクトル化が既存で OpenAI なら維持。新規本文を OpenAI に渡さない
- Dify は法令照会の質問文だけ。規程本文を投げない

## 既存アプリへの入れ方

1. `src/` をリポジトリの `lib/gap-engine` へコピー
2. `schema/*.sql` を Supabase migration に追加（既存テーブル名と衝突したら view で吸収）
3. `/api/zure/analyze` を現行の解析エンドポイントに置換。PDF 抽出器は今の実装を残し、抽出後に `runGapSheet` だけ差し替える
4. 画面の1枚レンダラを `payload.blocks` の priority 順に変更
5. 保存時に `toAnonymousStats` を呼ぶ
6. フッターと相談末尾の固定文をコンポーネント化する

PDF 抽出は既存を使う。このパッケージは抽出後の契約だけを固定する。
