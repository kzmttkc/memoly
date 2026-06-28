-- ============================================================================
-- collective_intelligence.sql — 番頭(Banto) #5集合知モート「種まき」スキーマ
-- ----------------------------------------------------------------------------
-- 目的（モート戦略TOP5 #5・[[project_vertical_saas_build]] の「#5集合知モート 実装設計確定」）:
--   弥生×HRbase の流通には正面で勝てない。唯一構造的に勝てる土俵が
--   「集合知ベンチマーク（同業◯%が対応済 等の統計）」。これは後付け不能＝
--   今のうちに「集約可能な正規化フィールド」を貯め始めるしかない。
--   ★本ファイルは「種まき」のみ。発動（ベンチマーク集計/同業比較UI）は 50社後・別ファイル。
--
-- このファイルは company_schema.sql / company_memory_depth.sql を一切編集せず、
-- 新テーブル2つを追加する。全文 冪等（IF NOT EXISTS / DROP POLICY IF EXISTS）。
-- CEOが本番 Supabase に手で適用する（company_* テーブルが在るプロジェクト）。
--
-- 設計の流儀は company_schema.sql に厳密に合わせる:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()
--   - 全テーブル RLS 有効
--   - メンバー/admin 判定は既存 SECURITY DEFINER 関数 is_company_member / is_company_admin
--   - 索引命名 <table>_<col>_idx
--   ★ company_attributes は会社1行（PK=company_id）の正規化属性。集計の素。
--   ★ company_risk_scores は履歴（時系列・1会社で複数行）。リスクの推移＝悪化アラートの土台。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_attributes — 会社の正規化属性（集約専用・1会社1行）
-- ----------------------------------------------------------------------------
--   既存 company_profiles は自由形式 key/value で集計不能（key表記揺れ＝GROUP BY不能）。
--   集合知ベンチマークは「業種×規模×制度有無」の決定的フィールドでしか組めない。
--   よって集計専用の正規化テーブルを別建てするのが唯一の正解（設計確定）。
--
--   - industry_major : JSIC（日本標準産業分類）大分類 A〜T の1文字コード。CHECK で物理強制。
--   - employee_band  : 従業員規模バンド（決定的なドロップダウン値）。
--   - has_*          : 制度有無の「三値」bool（true=ある / false=ない / null=未回答）。
--                      null を許す＝「未回答」を「false」と取り違えない（誤集計防止）。
--   - benchmark_optout : 集合知統計から自社を除外したい会社のオプトアウト（信頼設計）。
--   - source         : 値の由来（'wizard' 構造化ウィザード / 'risk' 診断前の差し込み 等）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_attributes (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,

  -- JSIC 大分類（A〜T）。集計の主キー次元。
  industry_major text CHECK (
    industry_major IS NULL OR industry_major IN (
      'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'
    )
  ),

  -- 従業員規模バンド。番頭のセグメント（5-50名）が中心に来る決定的な刻み。
  employee_band text CHECK (
    employee_band IS NULL OR employee_band IN (
      '1-4','5-9','10-29','30-49','50-99','100+'
    )
  ),

  -- 制度有無（三値 bool）。null=未回答。
  has_36kyotei   boolean,  -- 36協定の締結
  has_work_rules boolean,  -- 就業規則の整備（常時10人以上で作成義務）
  has_fixed_ot   boolean,  -- 固定残業代制度の有無

  -- 集合知統計からの除外希望（信頼設計・規約の統計利用条項とセット）。
  benchmark_optout boolean NOT NULL DEFAULT false,

  source     text NOT NULL DEFAULT 'wizard',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. company_risk_scores — リスクスコアの履歴（時系列・集約・悪化アラートの土台）
-- ----------------------------------------------------------------------------
--   risk-audit は今までスコアを保存していなかった＝集約も推移も取れなかった。
--   ここに「診断のたび1行 insert」することで:
--     - 集合知ベンチマーク（同業の中央値スコア 等）の素
--     - 時系列（前回より悪化したか＝TOP5 #2 悪化アラート）の土台
--   を同時に作る。値は risk-audit が既に clamp(0-100) 済みのものを列マッピングする。
--   カテゴリ6列は CATEGORY_NAMES（労働時間/賃金/休暇/就業規則/社会保険/育児・介護）に対応。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  overall int NOT NULL CHECK (overall BETWEEN 0 AND 100),

  -- カテゴリ別（risk-audit の固定6カテゴリ）。0-100。
  cat_working_hours    int CHECK (cat_working_hours    IS NULL OR cat_working_hours    BETWEEN 0 AND 100),
  cat_wages            int CHECK (cat_wages            IS NULL OR cat_wages            BETWEEN 0 AND 100),
  cat_leave            int CHECK (cat_leave            IS NULL OR cat_leave            BETWEEN 0 AND 100),
  cat_work_rules       int CHECK (cat_work_rules       IS NULL OR cat_work_rules       BETWEEN 0 AND 100),
  cat_social_insurance int CHECK (cat_social_insurance IS NULL OR cat_social_insurance BETWEEN 0 AND 100),
  cat_childcare        int CHECK (cat_childcare        IS NULL OR cat_childcare        BETWEEN 0 AND 100),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- RLS 有効化
-- ============================================================================
ALTER TABLE public.company_attributes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_risk_scores ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS ポリシー（既存 company_schema.sql の流儀を踏襲）
--   - 読取り: 当該会社のメンバー全員（is_company_member）
--   - company_attributes 書込み: admin のみ（自社ルールと同格＝is_company_admin）
--   - company_risk_scores insert: メンバー可（診断は member も実行できる＝相談と同格）
--     削除/更新ポリシーは置かない（履歴は不変＝改竄させない。掃除は service role で）。
--   ※ 発動フェーズのベンチ集計は service role(cron)で全社横断するが、それは別ファイル。
--     本ファイルのユーザー向け可視性は「自社のみ」で分離哲学を一切崩さない。
-- ============================================================================

-- company_attributes: メンバー閲覧 / admin 書込み（自社ルールと同じ権限境界）。
DROP POLICY IF EXISTS "company_attributes_member_select" ON public.company_attributes;
CREATE POLICY "company_attributes_member_select" ON public.company_attributes
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "company_attributes_admin_write" ON public.company_attributes;
CREATE POLICY "company_attributes_admin_write" ON public.company_attributes
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- company_risk_scores: メンバー閲覧 / メンバー insert（履歴は積み上げのみ）。
DROP POLICY IF EXISTS "company_risk_scores_member_select" ON public.company_risk_scores;
CREATE POLICY "company_risk_scores_member_select" ON public.company_risk_scores
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "company_risk_scores_member_insert" ON public.company_risk_scores;
CREATE POLICY "company_risk_scores_member_insert" ON public.company_risk_scores
  FOR INSERT WITH CHECK (public.is_company_member(company_id));

-- ============================================================================
-- インデックス（company_schema.sql の命名規則 <table>_<col>_idx を踏襲）
-- ============================================================================
-- 集合知集計（発動フェーズ）の主クエリ「業種×規模で GROUP BY」に効く複合索引。
CREATE INDEX IF NOT EXISTS company_attributes_industry_band_idx
  ON public.company_attributes (industry_major, employee_band);

-- 「会社の最新リスクスコアを新しい順に引く」（時系列・悪化アラート・集約の素）。
CREATE INDEX IF NOT EXISTS company_risk_scores_company_created_idx
  ON public.company_risk_scores (company_id, created_at DESC);

-- ============================================================================
-- RLS 影響確認（適用後にCEOが確認する事項）
-- ----------------------------------------------------------------------------
--   ★確認コマンド（適用後）:
--     SELECT polname, cmd, qual FROM pg_policies
--       WHERE tablename IN ('company_attributes','company_risk_scores');
--   期待:
--     company_attributes  : member_select(SELECT, is_company_member) / admin_write(ALL, is_company_admin)
--     company_risk_scores : member_select(SELECT, is_company_member) / member_insert(INSERT, is_company_member)
--   ＝他社の属性/スコアは JWT では一切読めない。分離哲学（実測8/8）を崩さない。
--
--   ★種まきの確認（実トランザクション・本タスクの受け入れ基準）:
--     1. 会社作成 → ウィザードで属性回答 → company_attributes に1行（PK=company_id）が upsert される。
--     2. risk 診断を実行 → company_risk_scores に1行 insert される（再診断で行が増える＝時系列）。
--     3. 別ユーザー(他社)の JWT で company_attributes / company_risk_scores を select → 0行（不可視）。
--   ★ industry_benchmarks（発動フェーズ）はこのファイルでは作らない（設計確定）。
-- ============================================================================
