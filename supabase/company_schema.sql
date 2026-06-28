-- ============================================================================
-- company_schema.sql — 縦SaaS「会社を覚える労務AI」 会社スコープ・スキーマ
-- ----------------------------------------------------------------------------
-- 目的:
--   Memolyの記憶主体を「個人user」→「会社company（複数席）」に付け替える。
--   既存 memoly_* テーブルは一切変更せず、別テーブルとして company_* を追加する。
--   会社の記憶＝company_profiles（自社ルール/制度）+ company_memories（相談要約）。
--
-- 設計の流儀は supabase/schema.sql / extraction_logs.sql に厳密に合わせている:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()
--   - 全テーブル RLS 有効
--   - メンバーシップ判定は memoly_messages のサブクエリ方式を踏襲
--   - auth.users への新規登録トリガではなく、会社作成はアプリ経由（席の概念があるため）
--
-- 適用前提（CEO/Takeshi 確認事項・末尾参照）:
--   - 専用 Supabase プロジェクト hsyalzzcemtewmtorwkn に適用（個人Memolyとは別env）。
--   - auth.users は Memoly 個人版と共有するか分離するかは未確定 → 「要確認」。
--     本SQLは「同一 auth.users を使う（同じユーザーが個人/会社を併用しうる）」前提で書いている。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. companies — 会社（テナント）。課金・席数の保有主体。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'pro', 'enterprise')),
  seats_purchased int NOT NULL DEFAULT 1 CHECK (seats_purchased >= 1),
  stripe_customer_id text,                       -- Stripe顧客ID（課金結線後に埋まる）
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. company_members — 席の実体。user ↔ company の多対多 + ロール。
--    role='admin' は自社ルール（company_profiles）の書込み・席管理・課金操作が可能。
--    role='member' は相談（会話）はできるが会社プロファイルは読み取りのみ。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. company_profiles — memoly_profiles の会社版。自社の労務ルール/制度を key/value で保持。
--    例: key='所定労働時間' value='1日8時間・週40時間' / key='36協定' value='締結済(月45h/年360h)'
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, key)
);

-- ----------------------------------------------------------------------------
-- 4. company_memories — memoly_memories の会社版。会社単位の相談要約（長期記憶）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  summary text NOT NULL,
  memory_type text NOT NULL DEFAULT 'summary' CHECK (memory_type IN ('summary', 'rule')),
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. company_conversations — memoly_conversations の会社スコープ版。
--    会話は会社に属し、開始した個人(user_id)も保持（誰の相談かの監査用）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text DEFAULT '新しい相談',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. company_messages — memoly_messages の会社スコープ版。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.company_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- RLS 有効化
-- ============================================================================
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_messages     ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- メンバーシップ判定ヘルパ（SECURITY DEFINER）
--   RLS ポリシー内で company_members を直接サブクエリすると、company_members 自身の
--   ポリシーと相互参照して無限再帰になりうる。これを避けるため判定を関数に閉じ込める。
--   （Supabase 公式が multi-tenant で推奨するパターン）
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = cid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = cid AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS ポリシー
--   読取り: 当該会社のメンバー全員（is_company_member）
--   書込み: 表ごとに分離（自社ルール/課金/席は admin のみ、相談は member 可）
-- ============================================================================

-- companies: メンバーは閲覧可。更新(プラン名等)は admin のみ。作成はアプリ(service role)で行う想定。
CREATE POLICY "companies_member_select" ON public.companies
  FOR SELECT USING (public.is_company_member(id));
CREATE POLICY "companies_admin_update" ON public.companies
  FOR UPDATE USING (public.is_company_admin(id));

-- company_members: 同じ会社のメンバーは席一覧を閲覧可。席の追加/削除/ロール変更は admin のみ。
CREATE POLICY "company_members_member_select" ON public.company_members
  FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "company_members_admin_write" ON public.company_members
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- company_profiles: メンバーは閲覧可（=AIに注入する自社ルール）。編集は admin のみ。
CREATE POLICY "company_profiles_member_select" ON public.company_profiles
  FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "company_profiles_admin_write" ON public.company_profiles
  FOR ALL USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- company_memories: メンバーは閲覧/追加可（相談の積み重ねは全員が貢献）。削除は admin のみ。
CREATE POLICY "company_memories_member_select" ON public.company_memories
  FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "company_memories_member_insert" ON public.company_memories
  FOR INSERT WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "company_memories_admin_delete" ON public.company_memories
  FOR DELETE USING (public.is_company_admin(company_id));

-- company_conversations: メンバーは自社の会話を閲覧/作成/更新可。
CREATE POLICY "company_conversations_member_all" ON public.company_conversations
  FOR ALL USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- company_messages: 親会話の会社のメンバーのみ（memoly_messages のサブクエリ方式を踏襲）。
CREATE POLICY "company_messages_member_all" ON public.company_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM public.company_conversations
      WHERE public.is_company_member(company_id)
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.company_conversations
      WHERE public.is_company_member(company_id)
    )
  );

-- ============================================================================
-- 席数ガード（seats_purchased を超えてメンバーを追加させない）
--   RLS は「誰が書けるか」は守るが「何席まで」は守らない。BEFORE INSERT トリガで強制。
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_company_seat_limit()
RETURNS trigger AS $$
DECLARE
  used int;
  cap int;
BEGIN
  SELECT count(*) INTO used FROM public.company_members WHERE company_id = NEW.company_id;
  SELECT seats_purchased INTO cap FROM public.companies WHERE id = NEW.company_id;
  IF used >= cap THEN
    RAISE EXCEPTION '席数上限に達しています (seats_purchased=%). 席を追加購入してください。', cap;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_company_seat_limit ON public.company_members;
CREATE TRIGGER trg_company_seat_limit
  BEFORE INSERT ON public.company_members
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_company_seat_limit();

-- ============================================================================
-- インデックス（schema.sql の命名規則 <table>_<col>_idx を踏襲）
-- ============================================================================
CREATE INDEX IF NOT EXISTS company_members_user_id_idx        ON public.company_members (user_id);
CREATE INDEX IF NOT EXISTS company_profiles_company_id_idx     ON public.company_profiles (company_id);
CREATE INDEX IF NOT EXISTS company_memories_company_id_idx     ON public.company_memories (company_id);
CREATE INDEX IF NOT EXISTS company_conversations_company_id_idx ON public.company_conversations (company_id);
CREATE INDEX IF NOT EXISTS company_messages_conv_id_idx        ON public.company_messages (conversation_id);
