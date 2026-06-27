-- ============================================================================
-- company_memory_depth.sql — 番頭(Banto) 縦SaaS「記憶の縦深」スキーマ拡張
-- ----------------------------------------------------------------------------
-- 目的（PMFロードマップ §5〜6・番頭最大の差別化＝moat/リテンション）:
--   競合(HRbase/AI労務君/SmartHR)の「規程をRAGで参照して答える」はコモディティ。
--   番頭が勝てるのは「会社の文脈を継続記憶する縦深」＝過去の自社判断・対応履歴・
--   人ごとの状況まで覚え「貴社のAさんの件は前回こう決めましたが今回も同じ方針で？」と
--   返せること。そのために company_memories を「平板な要約の山」から
--   「topic / subject(対象者) / decision(過去の自社判断) / decided_at」で構造化する。
--
-- このファイルは company_schema.sql を一切編集せず、ALTER で後付け拡張する。
-- 全文 冪等（IF NOT EXISTS / DO $$ ガード）。CEOが本番 Supabase に手で適用する。
--
-- 設計の流儀は company_schema.sql に厳密に合わせる:
--   - public スキーマ・snake_case・timestamptz・索引命名 <table>_<col>_idx
--   - 列追加は RLS 不変（既存ポリシーは行(row)に対するもので、新列も自動でカバーされる）。
--     ＝新しい RLS は不要。本ファイル末尾の「RLS 影響確認」コメント参照。
--
-- 適用対象 Supabase: company_schema.sql と同じ会社版プロジェクト
--   （company_* テーブルが存在する側。Memoly個人版とは別env or 同env共有のどちらでも、
--    company_memories が在る所に適用する）。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 構造化のための列追加（すべて nullable・既存行/データを破壊しない）
--    - topic    : トピックラベル（例「育休」「36協定」「固定残業代」）。recency+一致検索の効き目を上げる。
--    - subject  : 対象者/対象ラベル（例「パート全般」「Aさん(育休)」）。
--                 ★個人特定の生氏名は避け、ラベル粒度（イニシャル+文脈）を推奨。
--                 担当者が代わっても「会社の記憶」として人ごとの状況が残る価値の核。
--    - decided_at : その判断が下された日時（memory_type='decision' で使う。created_at とは別概念）。
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_memories ADD COLUMN IF NOT EXISTS topic      text;
ALTER TABLE public.company_memories ADD COLUMN IF NOT EXISTS subject    text;
ALTER TABLE public.company_memories ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. memory_type CHECK の張り替え（'decision' を追加）
--    既存 CHECK は ('summary','rule') のみ。'decision'(過去の自社判断) を許可する。
--    制約名は環境差があり得るので、DO ブロックで「現行の memory_type CHECK 制約を
--    名前を問わず全て drop → 新 CHECK を追加」する冪等手続きにする。
--    既存値（summary/rule）は新 CHECK に包含されるため破壊しない。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  -- company_memories に張られた CHECK 制約のうち、定義に memory_type を含むものを全て外す。
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel  ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'company_memories'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%memory_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.company_memories DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- 新しい許容値で CHECK を張り直す（存在しなければ追加）。
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_memories_memory_type_check'
      AND conrelid = 'public.company_memories'::regclass
  ) THEN
    ALTER TABLE public.company_memories
      ADD CONSTRAINT company_memories_memory_type_check
      CHECK (memory_type IN ('summary', 'rule', 'decision'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. 索引（company_schema.sql の命名規則 <table>_<col>_idx を踏襲）
--    loadCompanyContext の構造化読み出し（type別フィルタ・topicグルーピング・
--    subjectグルーピング）に効くものを張る。
-- ----------------------------------------------------------------------------
-- 「会社×種別（decision/summary）を新しい順に引く」主クエリ用（部分的に decided_at も効く）。
CREATE INDEX IF NOT EXISTS company_memories_company_type_idx
  ON public.company_memories (company_id, memory_type, created_at DESC);

-- 「会社×topic」で関連記憶を絞るためのトピック索引（topic 非NULL行のみ）。
CREATE INDEX IF NOT EXISTS company_memories_company_topic_idx
  ON public.company_memories (company_id, topic)
  WHERE topic IS NOT NULL;

-- 「会社×subject(対象者)」で人ごとにグルーピングするための索引（subject 非NULL行のみ）。
CREATE INDEX IF NOT EXISTS company_memories_company_subject_idx
  ON public.company_memories (company_id, subject)
  WHERE subject IS NOT NULL;

-- ============================================================================
-- 4. pgvector セマンティック検索の「将来差し込み点」（今回は適用しない・設計予約のみ）
-- ----------------------------------------------------------------------------
--   embedding プロバイダ（Voyage=有料/Takeshi承認 or ローカル=Vercel関数サイズ懸念）が
--   揃った時点で、以下を解禁して company_memories に embedding 列を足し、
--   loadCompanyContext の「関連記憶の選択」を recency+キーワード から
--   コサイン類似度に差し替える。lib/memory.ts の cosineSimilarityQuery が配線点。
--
--   -- CREATE EXTENSION IF NOT EXISTS vector;
--   -- ALTER TABLE public.company_memories ADD COLUMN IF NOT EXISTS embedding vector(1024);
--   -- CREATE INDEX IF NOT EXISTS company_memories_embedding_idx
--   --   ON public.company_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--   --   （ivfflat は ANALYZE 後に効く。行数が少ない初期は hnsw でもよい。）
-- ============================================================================

-- ============================================================================
-- RLS 影響確認（適用後にCEOが確認する事項・本ファイルは新ポリシーを足さない）
-- ----------------------------------------------------------------------------
--   既存の company_memories ポリシー（company_schema.sql）:
--     - company_memories_member_select : is_company_member(company_id) で行select
--     - company_memories_member_insert : is_company_member(company_id) で行insert
--     - company_memories_admin_delete  : is_company_admin(company_id) で行delete
--   これらは「行」に対する条件であり、列を増やしても判定は不変＝新列も同じテナント分離が効く。
--   ＝ topic / subject / decided_at / memory_type='decision' いずれも、
--      自社メンバーのみ可視・自社メンバーのみ追加・admin のみ削除、で従来どおり守られる。
--   ★確認コマンド（適用後・任意）:
--     SELECT polname, cmd, qual FROM pg_policies WHERE tablename='company_memories';
-- ============================================================================
