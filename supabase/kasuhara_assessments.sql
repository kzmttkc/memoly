-- ============================================================================
-- kasuhara_assessments.sql — カスハラ10措置診断の結果（Kabau×番頭 1本化 Phase 2）
-- ----------------------------------------------------------------------------
-- 設計（KABAU_BANTO_UNIFICATION_V2_2026-08-26.md §4・プライバシーは /zure の約束に従属）:
--   /zure は「残す操作の前にファイルをサーバへ保存しない」と約束している。
--   よって匿名診断では**規則本文・抽出結果を一切保存しない**。保存するのは
--   10措置の判定（○△×・条番号の参照・短い所見）だけ。KPIの分母もこの行数で数える。
--   登録ユーザーの紐付け（company_id）と原本参照は Phase 3 で足す（列だけ先に置く）。
--
-- 適用: python3 ~/Takeshi_Automation/scripts/supabase_sql.py banto --file supabase/kasuhara_assessments.sql
-- 冪等: IF NOT EXISTS / OR REPLACE のみ。再実行安全。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kasuhara_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 匿名診断は NULL。登録済みユーザーが会社文脈で実行したときのみ設定（Phase 3）。
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  -- 段2でメールを預かったときに紐付ける（無ければ NULL のまま）。
  lead_email text CHECK (lead_email IS NULL OR (char_length(lead_email) BETWEEN 3 AND 254 AND position('@' in lead_email) > 1)),
  -- {n, verdict('ok'|'weak'|'missing'), evidence(条番号等・最大120字), note(最大200字)} x10。
  -- 規則本文そのものは含めない（上のプライバシー設計）。
  measures jsonb NOT NULL,
  -- 規程追補案を生成したか（本文は保存しない。生成は決定的で再現可能なため判定から再生成できる）。
  policy_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kasuhara_assessments ENABLE ROW LEVEL SECURITY;

-- 書き込みはサーバ（service role）のみ。anon/authenticated に INSERT を開けない
-- （判定はサーバのAPIが LLM 実行とセットで行う。直接 INSERT を許すと偽計測が混ざる）。
-- service role は RLS を通過するためポリシー不要。

-- 読み取り: 自社の行だけ（company_members 経由・既存テーブルと同じ流儀）。匿名行は誰にも読ませない。
DROP POLICY IF EXISTS kasuhara_assessments_select ON public.kasuhara_assessments;
CREATE POLICY kasuhara_assessments_select ON public.kasuhara_assessments
  FOR SELECT TO authenticated
  USING (
    company_id IS NOT NULL AND company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS kasuhara_assessments_company_idx ON public.kasuhara_assessments (company_id);
CREATE INDEX IF NOT EXISTS kasuhara_assessments_created_idx ON public.kasuhara_assessments (created_at);
