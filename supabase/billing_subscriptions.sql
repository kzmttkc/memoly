-- ============================================================================
-- billing_subscriptions.sql — Stripe 課金イベントの監査ログ + 冪等性記録
-- ----------------------------------------------------------------------------
-- 目的:
--   webhook が受けた Stripe イベントを 1 行ずつ記録する。
--   役割は2つ:
--     (1) 冪等性: Stripe は同一イベントを再送しうる（at-least-once）。
--         event_id を PK にして「処理済みなら2回目はスキップ」を成立させる。
--     (2) 監査: いつ・どの会社が・どのプランへ・いくらで動いたかの追跡。
--         返金紛争・誤付与調査・売上突合の一次資料。
--
--   companies.plan / seats_purchased が「現在の状態」を持ち、ここは「履歴」を持つ。
--
-- 設計の流儀（company_schema.sql / api_usage.sql に合わせる）:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()
--   - RLS 有効。書込みは service role（webhook）のみ＝書込みポリシーを付与しない。
--     読取りは「その会社の admin だけ」（請求履歴を会社管理者が見られる）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_billing_events (
  -- Stripe の event.id（evt_...）。再送検知のため PK。
  event_id      text PRIMARY KEY,
  -- どの会社向けに処理したか（不明イベントは記録しないので NOT NULL）。
  company_id    uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  -- イベント種別（checkout.session.completed / customer.subscription.updated/deleted 等）。
  event_type    text NOT NULL,
  -- 反映後のプラン（lib/plans.ts の enum）。
  plan          text,
  -- 反映後の席数（checkout の quantity 由来）。
  seats         int,
  -- 課金額（amount_total・JPY最小単位=円）。subscription.* では null のことがある。
  amount        int,
  -- Stripe 顧客/サブスクID（調査・突合用）。
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_billing_events ENABLE ROW LEVEL SECURITY;

-- 読取り: その会社の admin のみ（請求履歴の閲覧）。
-- is_company_admin は company_schema.sql で定義済（SECURITY DEFINER）。
DROP POLICY IF EXISTS "company_billing_events_admin_select" ON public.company_billing_events;
CREATE POLICY "company_billing_events_admin_select" ON public.company_billing_events
  FOR SELECT USING (company_id IS NOT NULL AND public.is_company_admin(company_id));

-- 書込みポリシーは付与しない＝anon/authenticated からは INSERT/UPDATE 不可。
-- 書込みは webhook の service role（RLSバイパス）に限定する。

CREATE INDEX IF NOT EXISTS company_billing_events_company_id_idx
  ON public.company_billing_events (company_id);
CREATE INDEX IF NOT EXISTS company_billing_events_sub_idx
  ON public.company_billing_events (stripe_subscription_id);
