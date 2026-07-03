-- ============================================================================
-- company_deadlines.sql — 番頭(Banto) F4「期限レジストリ」スキーマ追加
-- ----------------------------------------------------------------------------
-- 目的（看板「会社を覚える」と実体の一致）:
--   労務には毎年巡ってくる期限（36協定の更新・労働保険の年度更新・算定基礎届 等）が
--   あるが、番頭には「自社が管理したい期限」を登録し、近づいたら備忘を届ける経路が
--   無かった。本テーブルで会社ごとの期限を保持し、リマインドcronの土台にする。
--
--   Phase1コンプラ: 期日(due_on)はユーザーが確定する。システムは日付を断定しない。
--   通知は「登録済みの予定の備忘」であって手続きの要否を判断・命令しない。
--
-- このファイルは company_schema.sql を一切編集せず、新テーブルとして後付け追加する。
-- 全文 冪等（IF NOT EXISTS / DROP POLICY IF EXISTS）。CEOが本番 Supabase に手で適用する。
--
-- 設計の流儀は company_documents.sql / company_schema.sql に厳密に合わせる:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()・RLS 有効
--   - メンバーシップ判定は既存 SECURITY DEFINER 関数
--     is_company_member / is_company_admin を再利用（新規関数は作らない）
--   - 索引命名 <table>_<col>_idx
--
-- 適用対象 Supabase: company_schema.sql と同じ会社版プロジェクト
--   （company_* テーブルが存在する側）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_deadlines — 会社が管理したい労務の期限
--    - title       : 期限の名称（例「36協定の更新」）。会社内で (title,due_on) 一意。
--    - note        : 補足メモ（任意・最大2,000字）。
--    - due_on      : 期日（DATE）。★ユーザーが確定する。システムは断定しない（Phase1）。
--    - recurrence  : 繰り返し。'none'=単発 / 'yearly'=毎年（UIの「済みにする」で+1年）。
--    - source      : 由来。'manual'=手入力 / 'suggested'=サジェストからワンクリック登録。
--    - last_notified_offset : 直近で送った「残日数の閾値」（30/14/7/1）。二重送信防止の要。
--                             NULL=未通知。cron は単調減少方向にのみ更新する。
--    - last_notified_due_on : 上の閾値がどの due_on に対するものか（済み化で due_on が
--                             繰り上がった後の再通知を正しく解禁するための対応付け）。
--    - active      : 有効フラグ。false=一覧/通知から除外（論理削除にも使う）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 120),
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  due_on date NOT NULL,
  recurrence text NOT NULL DEFAULT 'yearly' CHECK (recurrence IN ('none', 'yearly')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'suggested')),
  last_notified_offset int,
  last_notified_due_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, title, due_on)
);

-- ============================================================================
-- RLS（company_documents と同じ考え方: 期限＝会社の正式な予定）
--   読取り: メンバー全員（一覧・リマインド対象の閲覧は全席の価値）
--   書込み: admin のみ（登録/編集/削除は管理者の操作）
-- ============================================================================
ALTER TABLE public.company_deadlines ENABLE ROW LEVEL SECURITY;

-- 冪等: 既存ポリシーがあれば作り直す（定義変更時の再適用を安全にする）。
DROP POLICY IF EXISTS "company_deadlines_member_select" ON public.company_deadlines;
CREATE POLICY "company_deadlines_member_select" ON public.company_deadlines
  FOR SELECT USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "company_deadlines_admin_write" ON public.company_deadlines;
CREATE POLICY "company_deadlines_admin_write" ON public.company_deadlines
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- ============================================================================
-- 索引（命名規則 <table>_<col>_idx を踏襲）
--   - 一覧クエリ「自社の有効な期限を due_on 昇順」に効かせる。
--   - cron の「due_on が近い有効行を全社横断」に効かせる（active な行だけを走査）。
-- ============================================================================
CREATE INDEX IF NOT EXISTS company_deadlines_company_id_idx
  ON public.company_deadlines (company_id, due_on);

CREATE INDEX IF NOT EXISTS company_deadlines_due_on_idx
  ON public.company_deadlines (due_on)
  WHERE active;

-- ============================================================================
-- RLS 影響確認（適用後にCEOが確認する事項）
--   SELECT polname, cmd FROM pg_policies WHERE tablename='company_deadlines';
--   → member_select(SELECT) / admin_write(ALL) の2本が出ること。
--   アプリ層(CRUD)は anon(=ユーザーJWT) クライアントで読む/書く＝RLSが最終防衛線。
--   リマインドcronのみ service role（RLSバイパス）で全社横断する（未認証文脈のため）。
--   テーブル未適用の環境でも、GET は空一覧 / POST は 503 を返し既存機能を巻き添えにしない。
-- ============================================================================
