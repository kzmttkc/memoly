# Gap engine 接続メモ（2026-08-29）

Desktop パッケージ `shugyo-kisoku-ai` を現行リポジトリへ接続した記録。

## 入れたもの

| パス | 内容 |
|---|---|
| `lib/gap-engine/` | エンジン本体（validate / runGapSheet / taxonomy / prompts） |
| `eval/gap-engine/` | オフライン試験（品質ゲート） |
| `docs/gap-engine/` | PRD・WIRE-IN・11-ZURE-COPY 等 |
| `prompts/gap-engine/` | Constitution ほか全文 |
| `supabase/gap_stats_anonymous.sql` | 匿名欠落分布のみ（フル org DDL は衝突回避で未適用） |
| `app/api/zure/extract` | 既存 PDF 抽出 + `runGapSheet`（失敗時 heuristic） |
| `app/api/zure/save` | 匿名 stats upsert 骨格 |
| `/zure` | GapSheet 描画・カスハラ義務化コピー・計測3本 |

## 品質ゲート

```bash
npm run eval:gap-offline
node --test tests/unit/gap-engine-sanitize.test.ts
```

落ちる変更はマージしない。

## Owner 作業（コード外）

- `gap_stats_anonymous` を本番 Supabase に適用
- 適格請求書・法人化（既存決裁カード）
- 監修社労士の実名は表で「監修」と名乗らない条件で別決裁
