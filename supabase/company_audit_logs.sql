-- ============================================================================
-- company_audit_logs.sql — 会社スコープの監査ログ（重要操作の追跡証跡）
-- ----------------------------------------------------------------------------
-- 目的:
--   規程(自社ルール/取込規程)の削除・メンバー招待/変更・記憶(rule候補)の削除など、
--   「誰がいつ何をしたか」を残すべき重要操作を追記専用(append-only)で記録する。
--   担当者交代・トラブル調査・不正操作の検知に効く（BtoB労務データの取り扱い信頼）。
--
-- 設計の流儀（company_schema.sql に厳密に合わせる）:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()・RLS 有効。
--   - メンバー/admin 判定は既存の is_company_member(cid) / is_company_admin(cid) を再利用。
--   - **追記専用**: UPDATE / DELETE ポリシーを作らない＝改竄・削除不可（監査の信頼性）。
--     company 削除時のみ ON DELETE CASCADE で従属的に消える。
--   - 書込みは anon(=ユーザーJWT) クライアントで行い、WITH CHECK で
--       actor_user_id = auth.uid() を強制＝他人になりすました記録を作れない。
--   - 参照は admin のみ（監査ログは機微。member には見せない）。
--
-- ★適用は本番DB(専用 Supabase プロジェクト hsyalzzcemtewmtorwkn)へ Takeshi が手動で。
--   手順は docs/BANTO_MANUAL_MIGRATIONS.md を参照。
--   未適用の間も、アプリ側の書込みヘルパ(lib/audit.ts)はベストエフォートで
--   失敗を握りつぶすため、既存機能は一切壊れない（テーブルが無ければ記録されないだけ）。
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- 操作者。ユーザー削除後も証跡を残すため SET NULL（会社スコープは company_id で担保）。
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 操作種別。例: 'profile.delete' / 'profile.update' / 'member.invite' /
  --              'document.delete' / 'memory.rule.delete'
  action text NOT NULL,
  -- 対象の種別（テーブル名相当）。例: 'company_profile' / 'company_document' /
  --              'company_member' / 'company_memory'
  target_type text,
  -- 対象ID（uuid とは限らないため text）。氏名等のPIIは入れない運用。
  target_id text,
  -- 付随情報（非PII推奨。例: {"key":"所定労働時間"} や {"role":"member"}）。
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 会社ごとの新しい順の取り出しを速く（監査ビューア/調査用）。
CREATE INDEX IF NOT EXISTS company_audit_logs_company_created_idx
  ON public.company_audit_logs (company_id, created_at DESC);

ALTER TABLE public.company_audit_logs ENABLE ROW LEVEL SECURITY;

-- 参照: admin のみ（監査ログは機微）。
DROP POLICY IF EXISTS "company_audit_logs_admin_select" ON public.company_audit_logs;
CREATE POLICY "company_audit_logs_admin_select" ON public.company_audit_logs
  FOR SELECT USING (public.is_company_admin(company_id));

-- 追記: 当該会社のメンバーが、自分(actor_user_id=auth.uid())の操作として記録できる。
--   なりすまし記録を作れないよう actor_user_id を JWT に固定する。
DROP POLICY IF EXISTS "company_audit_logs_member_insert" ON public.company_audit_logs;
CREATE POLICY "company_audit_logs_member_insert" ON public.company_audit_logs
  FOR INSERT WITH CHECK (
    public.is_company_member(company_id) AND actor_user_id = auth.uid()
  );

-- UPDATE / DELETE ポリシーは意図的に作らない（追記専用＝改竄不可）。
