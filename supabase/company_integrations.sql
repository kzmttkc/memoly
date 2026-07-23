-- ============================================================================
-- company_integrations / company_api_keys — E08 外部連携（2026-07-23 Wave 4）
-- ----------------------------------------------------------------------------
-- 1) company_integrations: 会社ごとの外部連携設定（現状は Slack Incoming Webhook のみ）。
--    - slack_webhook_url は秘匿情報。RLS で admin のみ読める（member には見せない）。
--      cron（期限リマインド/週次ダイジェスト）は service role で読む。
--    - /api/company/export のエクスポート対象には**含めない**（秘匿・実装側で列挙制）。
-- 2) company_api_keys: 公開API v1 のAPIキー（会社ごと・admin発行/失効）。
--    - 生キーは保存しない。SHA-256 ハッシュ(key_hash)と表示用 prefix のみ保存。
--    - 認証は service role が key_hash で引く（revoked_at IS NULL のみ有効）。
--
-- 適用: Supabase Management API（scripts/supabase_sql.py banto --file ...）。冪等。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) 会社ごとの外部連携設定
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_integrations (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  slack_webhook_url text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

-- 秘匿情報（Webhook URL）を含むため、読み書きとも admin のみ。
DROP POLICY IF EXISTS "company_integrations_admin_all" ON public.company_integrations;
CREATE POLICY "company_integrations_admin_all" ON public.company_integrations
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- ----------------------------------------------------------------------------
-- 2) 公開API v1 のAPIキー
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'APIキー',
  key_prefix text NOT NULL,          -- 表示用の先頭部分（例 banto_sk_a1b2c3）
  key_hash text NOT NULL UNIQUE,     -- SHA-256(hex)。生キーは保存しない
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz             -- NULL=有効。失効は revoked_at を立てる（削除しない＝証跡）
);

ALTER TABLE public.company_api_keys ENABLE ROW LEVEL SECURITY;

-- 発行/失効/一覧とも admin のみ（key_hash は返さない運用だが、RLSでも会社境界を強制）。
DROP POLICY IF EXISTS "company_api_keys_admin_all" ON public.company_api_keys;
CREATE POLICY "company_api_keys_admin_all" ON public.company_api_keys
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- 認証ルックアップ（service role が key_hash で引く）を高速化。
CREATE INDEX IF NOT EXISTS company_api_keys_hash_idx
  ON public.company_api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS company_api_keys_company_idx
  ON public.company_api_keys (company_id);
