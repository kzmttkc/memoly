-- ============================================================================
-- company_members_column_grant.sql — 席テーブルの列粒度ガード（監査 2026-07-30 #6）
-- ----------------------------------------------------------------------------
-- 【何を守るか】
--   company_members の UPDATE を role 列だけに絞る。company_id / user_id を
--   authenticated から書けなくする。
--
-- 【落ちたら（＝適用しないと）何が起きるか】
--   RLS ポリシー company_members_admin_write（company_schema.sql:151-154）は
--     FOR ALL USING (is_company_admin(company_id)) WITH CHECK (is_company_admin(company_id))
--   で、判定に使うのは company_id だけ。Supabase 既定で authenticated は全列に UPDATE 権を
--   持つため、自社の admin は PostgREST を直接叩いて
--     PATCH /rest/v1/company_members?company_id=eq.<自社> { "user_id": "<任意UUID>" }
--   のように **既存の席の user_id を任意のユーザーへ書き換えられる**。
--   これは招待フロー（app/api/company/members）・監査ログ（logCompanyAudit）・
--   席数トリガ（trg_company_seat_limit）を全部迂回する経路になる。
--   実測（2026-07-30）: 全ゼロ UUID を company_id にした PATCH が 200 [] を返した
--   （companies が 42501 を返すのと対照的＝列権限が無い状態）。
--
-- 【適用後にできること／できないこと】
--   できる  : admin が同社メンバーの role を admin/member に変更する（UI の想定操作）
--   できない: user_id の付け替え・company_id の移動（席の乗っ取り・他社への持ち出し）
--   席の追加/削除は従来どおり（INSERT/DELETE 権はこの変更の対象外。招待APIは
--   service role で INSERT するため無影響）。
--   実測: authenticated クライアントから company_members を UPDATE するコードは
--   アプリ内にゼロ（grep 済み）。よって本変更で壊れる既存機能は無い。
--
-- 【適用手順（Takeshi 手番）】
--   1. Supabase ダッシュボード → SQL Editor に本ファイル全文を貼って実行
--   2. 反映確認:
--        select grantee, privilege_type, column_name
--          from information_schema.column_privileges
--         where table_name='company_members' and grantee='authenticated';
--      → UPDATE が role 列のみになっていれば成功
--   3. 実測での再検証（自分の JWT で PostgREST を直叩き）:
--        PATCH /rest/v1/company_members?company_id=eq.<自社>  {"user_id":"<別UUID>"}
--      → 42501（権限なし）になること。{"role":"member"} は通ること。
-- ============================================================================

REVOKE UPDATE ON public.company_members FROM anon, authenticated;
GRANT  UPDATE (role) ON public.company_members TO authenticated;

-- 併せて RLS 側にも「更新後の行も自社でなければならない」不変条件を明示しておく。
-- （列権限が主防御。これは company_id を動かす経路を多層で塞ぐもの。）
DROP POLICY IF EXISTS "company_members_admin_write" ON public.company_members;
CREATE POLICY "company_members_admin_write" ON public.company_members
  FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));
