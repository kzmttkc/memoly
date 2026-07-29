-- ============================================================================
-- HIGH-1 fix — 課金バイパス（自己プラン昇格）の遮断
-- ----------------------------------------------------------------------------
-- 監査 2026-07-29（第三者検証済み）:
--   RLS ポリシー companies_admin_update は
--     FOR UPDATE USING (public.is_company_admin(id))
--   で WITH CHECK も列制限も無く、Supabase 既定で `authenticated` ロールは
--   companies の全列に UPDATE 権を持つ。誰でも signup→会社作成で admin になれるため、
--   アプリを経由せず PostgREST に自分の JWT で
--     PATCH /rest/v1/companies?id=eq.<自社>  { "plan": "shigyo" }
--   を投げるだけで ¥29,800 プラン相当の機能（chat 400/日・multiClient・席50 等）を
--   無償で得られる。stripe_subscription_id 等の改竄で正規顧客の webnook 突合を
--   壊すこともできる。
--
-- 対処（最小・least-privilege）:
--   authenticated から companies の UPDATE 権を剥奪し、name 列のみ許可する。
--   plan / seats_purchased / status / stripe_* の更新は service role 専用になる。
--   課金 webhook（app/api/company/billing/webhook/route.ts）は service role
--   （createAdminClient）で UPDATE しており列権限を迂回するため影響なし。
--   実測: authenticated クライアントによる companies UPDATE 経路はコード上ゼロ
--   （全 UPDATE は webhook の admin クライアント）。name 付与は将来の会社名変更
--   機能のための前方互換。
--
-- 適用: service role / Supabase ダッシュボードの SQL Editor で実行（Takeshi 手番）。
--   反映確認:
--     select grantee, privilege_type, column_name
--       from information_schema.column_privileges
--      where table_name='companies' and grantee='authenticated';
--   → UPDATE が name 列のみに絞られていれば成功。
-- ============================================================================

revoke update on public.companies from anon, authenticated;
grant  update (name) on public.companies to authenticated;

-- 併せて RLS ポリシー側にも WITH CHECK を付け、多層防御にする（列権限が主防御、
-- これは admin が自社行以外を書き換えられない不変条件を明示するもの）。
drop policy if exists "companies_admin_update" on public.companies;
create policy "companies_admin_update" on public.companies
  for update
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id));
