-- ============================================================================
-- company_documents.sql — 番頭(Banto) F1「規程まるごと取込」スキーマ追加
-- ----------------------------------------------------------------------------
-- 目的（看板「会社を覚える」と実体の一致）:
--   これまで就業規則など規程の全文を番頭に記憶させる経路が無かった
--   （/api/company/document/review は 20,000字を受けてレビュー後に本文破棄）。
--   本テーブルで規程の**原文まるごと**を会社の記憶として保持し、
--   チャット相談時に「自社の規程には第◯条にこうあります」と原文参照で答えられるようにする。
--
-- このファイルは company_schema.sql を一切編集せず、新テーブルとして後付け追加する。
-- 全文 冪等（IF NOT EXISTS / DO $$ ガード）。CEOが本番 Supabase に手で適用する。
--
-- 設計の流儀は company_schema.sql / company_memory_depth.sql に厳密に合わせる:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()・RLS 有効
--   - メンバーシップ判定は既存 SECURITY DEFINER 関数
--     is_company_member / is_company_admin を再利用（新規関数は作らない）
--   - 索引命名 <table>_<col>_idx
--
-- 適用対象 Supabase: company_schema.sql と同じ会社版プロジェクト
--   （company_* テーブルが存在する側）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_documents — 規程の原文（就業規則・賃金規程・育児介護休業規程 など）
--    - title    : 規程名（例「就業規則」）。会社内で一意＝同名の再取込は上書き(upsert)。
--    - doc_type : 種別ラベル（UI の選択肢由来。自由文字列・非拘束）。
--    - content  : 原文まるごと。アプリ層で最大 100,000 字に制限し、
--                 DB でも CHECK で 200,000 字を天井にする（暴走 insert の最終防衛線）。
--    - char_count : content の文字数（一覧表示用に非正規化。アプリ層で設定）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text,
  content text NOT NULL CHECK (char_length(content) <= 200000),
  char_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, title)
);

-- ============================================================================
-- RLS（company_profiles と同じ考え方: 規程＝会社の正式ルール）
--   読取り: メンバー全員（チャット時の原文参照は全席の価値）
--   書込み: admin のみ（規程の取込/差替え/削除は管理者の操作）
-- ============================================================================
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- 冪等: 既存ポリシーがあれば作り直す（定義変更時の再適用を安全にする）。
DROP POLICY IF EXISTS "company_documents_member_select" ON public.company_documents;
CREATE POLICY "company_documents_member_select" ON public.company_documents
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "company_documents_admin_write" ON public.company_documents;
CREATE POLICY "company_documents_admin_write" ON public.company_documents
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- ============================================================================
-- 索引（命名規則 <table>_<col>_idx を踏襲）
--   loadRelevantRuleExcerpts の主クエリ「会社の規程を更新順に引く」に効かせる。
-- ============================================================================
CREATE INDEX IF NOT EXISTS company_documents_company_id_idx
  ON public.company_documents (company_id, updated_at DESC);

-- ============================================================================
-- RLS 影響確認（適用後にCEOが確認する事項）
--   SELECT polname, cmd FROM pg_policies WHERE tablename='company_documents';
--   → member_select(SELECT) / admin_write(ALL) の2本が出ること。
--   アプリ層は anon(=ユーザーJWT) クライアントのみで読む/書く＝RLSが最終防衛線。
--   テーブル未適用の環境でも、読み出し側(loadRelevantRuleExcerpts)は fail-open で
--   空配列を返し、チャット等の既存機能を巻き添えにしない。
-- ============================================================================
