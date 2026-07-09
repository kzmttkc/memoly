# 番頭 手動マイグレーション適用手順（Takeshi 作業）

本番 Supabase プロジェクト（専用: `hsyalzzcemtewmtorwkn`）へ、SQL を Takeshi が手動適用するタスクの台帳です。
コードは適用前でも壊れないよう「テーブルが無ければ記録しないだけ」のベストエフォートで書いてあります。適用すると機能が有効化されます。

適用方法（共通）:
1. Supabase ダッシュボード → 対象プロジェクト → SQL Editor を開く
2. 該当 SQL ファイルの中身を貼り付けて実行（`IF NOT EXISTS` 等で冪等・再実行安全）
3. 成功後、下の「適用後の確認」を実施

---

## ① 監査ログ基盤（company_audit_logs）

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

## 既出の手動タスク（参考・本書の管轄外）

- pgvector 本番有効化（OpenAI APIキー + `supabase/company_memory_semantic.sql` + backfill）
  … 詳細は当該 SQL とセマンティック想起の設計コメントを参照。
- 課金解禁（Stripe キー / Price ID / BILLING_ENABLED）… `docs/BANTO_BILLING_UNLOCK_RUNBOOK.md`。
  - Entry 年額を売る場合は、Stripe で年額 Price（¥39,800）を作成し
    `STRIPE_PRICE_STARTER_YEARLY` を env に投入する（コードは結線済み。下記参照）。
