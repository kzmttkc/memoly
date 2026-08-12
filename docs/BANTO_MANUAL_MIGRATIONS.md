# 番頭 手動マイグレーション適用台帳

本番 Supabase プロジェクト（専用: `hsyalzzcemtewmtorwkn`）へ手動適用する SQL の台帳です。
コードは適用前でも壊れないよう「テーブルが無ければ記録しないだけ」のベストエフォートで書いてあり、
適用すると機能が有効化されます。

適用方法（共通）:
1. `python3 ~/Takeshi_Automation/scripts/supabase_sql.py banto --file supabase/<file>.sql`（Management API）
2. または Supabase ダッシュボード → SQL Editor に貼り付けて実行（`IF NOT EXISTS` 等で冪等・再実行安全）

## この台帳の使い方（★2026-08-13 に機械化した）

**`npm run verify:prod` が台帳と本番の両方を見る。** 手で更新し忘れても検出される。

- `[C]` … `supabase/*.sql` のうち**この台帳にファイル名が出てこないもの**を落とす。
  台帳が4本しか載せていなかったため、GRANT 系4本の適用有無が誰にも追えなくなっていた
  （2026-08-12 セキュリティ採点 −4 の中身）。**新しい .sql を足したらこの表に1行足す。**
- `[B]` … `.sql` が宣言する CREATE TABLE / ADD COLUMN / CREATE FUNCTION を本番の PostgREST
  スキーマと突き合わせる。**GRANT/REVOKE は何も作らないので [B] では絶対に検出できない。**
- `[D]` … その盲点を埋める。使い捨ての `@example.test` ユーザーを作って `authenticated` の
  JWT を取り、**1行も一致しない条件**で UPDATE を投げて権限だけを引き出す（42501 か 2xx か）。
  行は一切変更されない。ユーザーは finally で必ず削除する。

---

## 本番の実測状態（2026-08-13 実測・`information_schema` を直接照会）

```sql
-- 列粒度 GRANT（この2行だけであること）
select table_name, grantee, privilege_type, column_name
  from information_schema.role_column_grants
 where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='UPDATE';
```
実測結果:

| table | grantee | UPDATE 可能な列 |
|---|---|---|
| `companies` | authenticated | **`name` のみ** |
| `company_members` | authenticated | **`role` のみ** |
| （anon） | — | **0件** |

```sql
-- SECURITY DEFINER 関数の search_path と EXECUTE 権限
select p.proname, p.prosecdef, p.proconfig from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
```
実測結果: `banto_cohort_stats` は `prosecdef=true` / `search_path=public` /
EXECUTE は **`postgres, service_role` のみ**（anon・authenticated から剥奪済み）。
anon で `POST /rest/v1/rpc/banto_cohort_stats` を叩くと
`42501 permission denied for function banto_cohort_stats` が返ることも実測済み。

**結論: 2026-08-12 に「未適用なら生きたまま」と書かれた2つの実害
（誰でも全社の経営指標を読める／admin が席の user_id を任意ユーザーへ付け替えられる）は、
本番では成立しない。**

---

## 全 SQL の適用状態

「実測」列は 2026-08-13 に本番へ問い合わせた結果。**判定根拠**の列に、何を見て適用済みと言ったかを書く。

| ファイル | 内容 | 実測 | 判定根拠 |
|---|---|---|---|
| `schema.sql` | pgvector 有効化・旧個人版 `memoly_*` 基盤 | ✅ | `memoly_users` 他が本番に実在 |
| `company_schema.sql` | 会社版の中核（`companies` / `company_members` / `company_profiles` ほか） | ✅ | 本番に実在 |
| `company_audit_logs.sql` | 重要操作の追記専用ログ（改竄不可・参照は admin） | ✅ 2026-07-10 | RLS 有効・ポリシー2本を適用時に確認 |
| `company_leads.sql` | micro-CV のリード捕捉 | ✅ 2026-07-10 | RLS 有効・ポリシー1本（anon_insert） |
| `company_memory_semantic.sql` | pgvector 記憶（`match_company_memories`・HNSW索引） | ✅ 2026-07-10 | RPC が `prosecdef=false`（SECURITY INVOKER＝RLSが効く）で実在 |
| `company_integrations.sql` | Slack Webhook / 公開API キー（どちらも admin のみ） | ✅ 2026-07-23 | 両テーブル `relrowsecurity=t` |
| `company_documents.sql` | 取込規程の本文 | ✅ | `company_documents` が本番に実在 |
| `company_deadlines.sql` | 期限リマインドの登録 | ✅ | 本番に実在 |
| `company_digests.sql` | 週次ダイジェストの配信記録 | ✅ | 本番に実在 |
| `company_memory_depth.sql` | `company_memories` へ `topic` / `subject` 等を後付け | ✅ | `[B]` の ADD COLUMN 照合で不足0 |
| `collective_intelligence.sql` | `company_attributes` / `company_risk_scores` | ✅ | 両テーブルが本番に実在 |
| `billing_subscriptions.sql` | `company_billing_events`（webhook の冪等台帳） | ✅ | 本番に実在 |
| `billing_past_due_grace.sql` | `companies.past_due_since`（滞納の21日打ち切り） | ✅ | 列が本番に実在 |
| `plan_ssot_migration.sql` | 旧 plan enum（trial/pro）を SSOT へ寄せるデータ移行 | ✅ | `companies.plan` の CHECK 制約が現行 enum |
| **`high1_companies_column_grant.sql`** | **`companies` の UPDATE を `name` 列だけに剥奪（課金バイパス封鎖）** | ✅ | 上表のとおり `name` のみ。`plan`/`status` は 42501 |
| **`company_members_column_grant.sql`** | **`company_members` の UPDATE を `role` 列だけに剥奪（席乗っ取り封鎖）** | ✅ | 上表のとおり `role` のみ。`user_id` は 42501 |
| **`high2_rpc_grant_and_search_path.sql`** | **`banto_cohort_stats()` の EXECUTE 剥奪＋`search_path` 固定** | ✅ | executors が `postgres,service_role` のみ・anon は 42501 |
| `api_usage.sql` | 旧個人版 `memoly_api_usage` | ✅ | 本番に実在（会社版は `lib/rate-limit.ts` 側） |
| `extraction_logs.sql` | 旧個人版 `memoly_extraction_logs` | ✅ | 本番に実在 |
| `day2_reminder_migration.sql` | 旧個人版 `memoly_users.day2_sent_at` | ⚠️ 死蔵 | 列は実在するが、Day2 リマインドは 2026-07-30 に `companies` ベースへ移した。この .sql は歴史的経緯 |
| `reports_table.sql` | 旧個人版 `memoly_reports`（App Store 審査対応） | ✅ | 本番に実在 |
| `banto_cohort_stats.sql` | コホート集計関数の本体 | ✅ | service role で 200 応答 |
| `cleanup_orphan_companies.sql` | **一度きりの掃除スクリプト**（退会で孤児化した会社を消す） | 適用対象外 | 冪等な定義ではなく手動運用。実行の要否はその都度判断 |

---

## 残タスク（Takeshi 手番）

- `OPENAI_API_KEY` の Vercel env 投入 → `scripts/backfill_memory_embeddings.mjs` 実行。
  未投入の間は embedding 生成が不活性（graceful degrade）で既存機能に影響なし。
- 課金解禁（Stripe キー / Price ID / BILLING_ENABLED）… `docs/BANTO_BILLING_UNLOCK_RUNBOOK.md`。
  Entry 年額を売る場合は Stripe で年額 Price（¥39,800）を作り `STRIPE_PRICE_STARTER_YEARLY` を投入する。
