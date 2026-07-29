-- ============================================================================
-- 2026-07-30 再監査で判明した2件の是正（HIGH-1 適用後の残穴）
-- ----------------------------------------------------------------------------
-- 【1】banto_cohort_stats() が authenticated から実行できる
--   07-30 の HIGH-1 適用時、anon からの実行は遮断された（42501）が、
--   authenticated ロールには実行権が残っていた。再監査で実ユーザーのJWTから
--   HTTP 200 で全社の経営指標（総会社数・アクティブ数・週次コホート・売上件数）が
--   返ることを実測確認。mailer_autoconfirm が ON のため、誰でもメール確認なしに
--   authenticated になれる＝**実質誰でも全社指標を読める**状態だった。
--   この関数はダッシュボード用の集計であり、service role からのみ呼べれば足りる。
--
-- 【2】RLS が依存する SECURITY DEFINER 関数に search_path 固定が無い
--   is_company_member / is_company_admin は全 RLS ポリシーの土台でありながら
--   `SET search_path` が無く、search_path 汚染で関数解決を乗っ取られる余地がある
--   （Supabase security advisor の function_search_path_mutable に該当）。
--   関数本体は public. 修飾済みなので実効性は低いが、権限昇格の起点になり得る
--   箇所を残す理由が無い。同じSQL実行の機会でまとめて固定する。
--
-- 適用: Supabase ダッシュボードの SQL Editor で実行（service role 相当）。
-- 検証（適用後に実行）:
--   1) 認証済みJWTで POST /rest/v1/rpc/banto_cohort_stats → 42501 になること
--   2) アプリの通常操作（ログイン・会社一覧・チャット）が退行していないこと
-- ============================================================================

-- 【1】集計RPCを service role 専用にする
revoke execute on function public.banto_cohort_stats() from public, anon, authenticated;

-- 【2】RLS の土台となる関数に search_path を固定する
--   関数本体は変更しない（既存定義のまま SET search_path だけを足す）。
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = cid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = cid AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_catalog;

-- トリガ関数2つは本体が長く、CREATE OR REPLACE で全文を書き直すと
-- 転記ミスで挙動（席数上限の判定・新規ユーザー行の作成）を壊す危険がある。
-- ALTER FUNCTION なら本体に一切触れず search_path だけを固定できるので、こちらを使う。
ALTER FUNCTION public.enforce_company_seat_limit() SET search_path = public, pg_catalog;
ALTER FUNCTION public.handle_memoly_new_user() SET search_path = public, pg_catalog;
