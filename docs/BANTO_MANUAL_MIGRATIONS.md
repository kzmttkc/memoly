# 番頭 手動マイグレーション適用手順（Takeshi 作業）

本番 Supabase プロジェクト（専用: `hsyalzzcemtewmtorwkn`）へ、SQL を Takeshi が手動適用するタスクの台帳です。
コードは適用前でも壊れないよう「テーブルが無ければ記録しないだけ」のベストエフォートで書いてあります。適用すると機能が有効化されます。

適用方法（共通）:
1. Supabase ダッシュボード → 対象プロジェクト → SQL Editor を開く
2. 該当 SQL ファイルの中身を貼り付けて実行（`IF NOT EXISTS` 等で冪等・再実行安全）
3. 成功後、下の「適用後の確認」を実施

---

## ① 監査ログ基盤（company_audit_logs）✅ 適用済み（2026-07-10）

- 適用方法: Supabase Management API（`POST /v1/projects/hsyalzzcemtewmtorwkn/database/query`）で CTO が適用。HTTP 201。
- 確認済み: `relrowsecurity=t`、ポリシー2本（admin_select / member_insert）、service role REST で SELECT 200。
- ファイル: `supabase/company_audit_logs.sql`
- 目的: 規程削除・自社ルール変更・メンバー追加・記憶(rule候補)削除など重要操作の追記専用ログ。
- 依存: 既存の `is_company_member(uuid)` / `is_company_admin(uuid)`（company_schema.sql で作成済）。
- 特性: 追記専用（UPDATE/DELETE ポリシー無し＝改竄不可）。参照は admin のみ。書込みは
  anon(=ユーザーJWT) で `actor_user_id = auth.uid()` を強制（なりすまし記録防止）。

適用後の確認（SQL Editor で実行）:
```sql
-- テーブルとRLSが有効か
select relrowsecurity from pg_class where relname = 'company_audit_logs';   -- => t
-- ポリシーが2本あるか（admin_select / member_insert）
select policyname from pg_policies where tablename = 'company_audit_logs';
```
配線済みの操作（適用後に自動で記録され始める）:
- `profile.delete` / `profile.update` … 自社ルールの削除・変更（/api/company/profile）
- `document.delete` … 取込規程の削除（/api/company/document/ingest）
- `member.invite` … 席の追加（/api/company/members）
- `memory.rule.delete` … 記憶(rule候補)の削除（/api/company/memory ?action=approve の片付け）

---

## ② micro-CV リード捕捉（company_leads）✅ 適用済み（2026-07-10）

- ファイル: `supabase/company_leads.sql`（ファイル冒頭コメントは旧共有プロジェクト言及だが、実適用先は専用 `hsyalzzcemtewmtorwkn`）
- 適用方法: 同上（Management API、HTTP 201）。
- 確認済み: RLS 有効、ポリシー1本（anon_insert）、service role REST で SELECT 200。

---

## ③ セマンティック記憶（company_memory_semantic / pgvector）✅ SQL適用済み（2026-07-10）

- ファイル: `supabase/company_memory_semantic.sql`
- 適用方法: 同上（Management API、HTTP 201）。`CREATE EXTENSION vector` はそのまま通過。
- 確認済み: `pg_extension` に vector、`company_memories.embedding vector(1536)` 列、HNSW索引、
  RPC `match_company_memories`（prosecdef=false=SECURITY INVOKER）が REST 経由で 200 応答。
- ★残タスク（Takeshi 手動）: `OPENAI_API_KEY` の Vercel env 投入 → `scripts/backfill_memory_embeddings.mjs` 実行。
  キー未投入の間は embedding 生成が不活性（graceful degrade）で既存機能に影響なし。

---

## ④ 外部連携基盤（company_integrations / company_api_keys）✅ 適用済み（2026-07-23）

- ファイル: `supabase/company_integrations.sql`
- 適用方法: Supabase Management API（`scripts/supabase_sql.py banto --file ...`）で CTO が適用。HTTP 200。
- 確認済み: 両テーブル `relrowsecurity=t`、ポリシー各1本（admin_all）。
- 目的: E08 Slack連携（Incoming Webhook URL・秘匿）と公開API v1 のAPIキー（SHA-256ハッシュ保存）。
- 特性: どちらも admin のみ読み書き可。cron / v1 認証は service role で読む。
  Webhook URL とキーのハッシュは /api/company/export のエクスポート対象外（export側は列挙制）。

---

## 既出の手動タスク（参考・本書の管轄外）

- pgvector 本番有効化 … SQL 側は上記③で適用済み。残りは OpenAI APIキー投入＋backfill のみ。
- 課金解禁（Stripe キー / Price ID / BILLING_ENABLED）… `docs/BANTO_BILLING_UNLOCK_RUNBOOK.md`。
  - Entry 年額を売る場合は、Stripe で年額 Price（¥39,800）を作成し
    `STRIPE_PRICE_STARTER_YEARLY` を env に投入する（コードは結線済み。下記参照）。
