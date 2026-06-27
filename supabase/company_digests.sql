-- ============================================================================
-- company_digests.sql — 「今週、自社に関係する変更」能動フィードの週次キャッシュ
-- ----------------------------------------------------------------------------
-- 目的:
--   番頭(Banto)の差別化＝能動診断。だが insights/risk は「開いて押したときだけ」走る
--   受け身。アプリ内に常設の能動フィード（自社プロファイルに照らして対象になりうる
--   法改正・助成金カード）を出し、受け身を能動に変える（戻る理由＝リテンションの起点）。
--
--   フィードは LLM（sonnet＋Dify助成金）で生成するため、ページ表示ごとに走らせると
--   コストが嵩む。そこで「会社×ISO週」単位で payload(jsonb) をキャッシュする。
--     - 当週キャッシュがあれば即表示（LLM呼び出し0）。
--     - 無ければ rate-limit を通して1回だけ生成→キャッシュ（lazy生成・クーロン不要）。
--
-- 設計の流儀は company_schema.sql / api_usage.sql に厳密に合わせている:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()
--   - RLS 有効。読取りは当該会社メンバー（既存ヘルパ is_company_member を再利用）。
--   - 書込みは service role（createAdminClient）に限定＝anon書込みポリシーは付与しない。
--     キャッシュは「事実の集約結果」であり、メンバーが直接書く対象ではないため。
--
-- 前提: company_schema.sql が先に適用済み（is_company_member 関数・companies 参照）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- company_digests — 会社×期間(週)の能動フィード・キャッシュ。
--   period: ISO週キー（例 '2026-W26'）。会社×週で一意（同週は1回だけ生成）。
--   payload: 生成結果（items / generatedFor などを含む jsonb・lib/digest.ts が整形）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period text NOT NULL,                         -- ISO週キー（YYYY-"W"WW）
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,   -- フィード本体（カード配列等）
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period)                   -- 会社×週で1行（lazy生成の冪等性）
);

ALTER TABLE public.company_digests ENABLE ROW LEVEL SECURITY;

-- 読取り: 当該会社のメンバー全員（company_schema.sql の SECURITY DEFINER ヘルパを再利用）。
--   書込みポリシーは付与しない＝書込みは service role(createAdminClient) 経由のみ。
DROP POLICY IF EXISTS "company_digests_member_select" ON public.company_digests;
CREATE POLICY "company_digests_member_select" ON public.company_digests
  FOR SELECT USING (public.is_company_member(company_id));

-- 直近取得・会社別検索用（company_schema.sql の命名規則 <table>_<col>_idx を踏襲）。
CREATE INDEX IF NOT EXISTS company_digests_company_id_idx
  ON public.company_digests (company_id);
