# 成果物インデックス

| 目的 | ファイル |
|---|---|
| 何を作るか | docs/01-PRD.md |
| いつ出すか | docs/02-ROADMAP.md |
| どこに載せるか | docs/03-ARCHITECTURE.md |
| ずれ1枚の契約 | docs/04-GAP-SHEET.md |
| API | docs/06-API.md |
| 安全と法令境界 | docs/08-SECURITY-COMPLIANCE.md |
| 精度の測り方 | docs/10-EVAL.md |
| 10月までの文言 | docs/11-ZURE-COPY.md |
| 現行コードへの接続 | docs/12-WIRE-IN.md |
| 上位制約 | prompts/00-CONSTITUTION.md |
| ずれ1枚プロンプト | prompts/01-GAP-SHEET.md |
| 記憶 | prompts/02-MEMORY-EXTRACT.md |
| 相談 | prompts/03-CONSULTATION.md |
| 下書き | prompts/04-DRAFT.md |
| 社労士メモ | prompts/05-SHAROUSHI-MEMO.md |
| DDL | schema/001_init.sql |
| RLS | schema/002_rls.sql |
| 項目マスター | src/taxonomy/items.ts |
| 実行 | src/engine/runGapSheet.ts |
| 捏造引用の破棄 | src/engine/validateSheet.ts |
| オフライン試験 | eval/offline.test.ts |

実装の本体は「モデル出力を信じるな。引用が本文に無ければ unmentioned に落とせ」である。プロンプトよりバリデータの方が買収時の説明に耐える。
