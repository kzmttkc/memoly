-- ============================================================================
-- company_memory_semantic.sql — 記憶のセマンティック検索（pgvector）解禁
-- ----------------------------------------------------------------------------
-- 目的（PMFロードマップ P1-1・Takeshi承認済み / 番頭の最大差別化＝記憶の縦深/moat）:
--   company_memories の想起を「キーワード＋2-gram 部分一致」から「意味ベクトルの
--   コサイン類似度」へ引き上げる。company_memory_depth.sql §4 の「将来差し込み点」を
--   ここで正式に解禁する。
--
-- 埋め込み: OpenAI text-embedding-3-small（1536次元）。lib/embedding.ts の
--   EMBEDDING_DIM=1536 と厳密に一致させること（不一致は挿入・検索で必ず失敗する）。
--
-- 冪等: 全文 IF NOT EXISTS / CREATE OR REPLACE。再適用しても安全。
-- 非破壊: 列追加は nullable。既存行の embedding は NULL のまま（バックフィルは別手順の
--   scripts/backfill_memory_embeddings.mjs で埋める）。embedding が NULL の行は
--   セマンティック検索の対象外になるだけで、キーワード検索では従来どおり効く。
--
-- 適用対象 Supabase: company_memories が存在する会社版プロジェクト
--   （company_schema.sql / company_memory_depth.sql と同じ側）。
--
-- ★前提（手動タスク・Takeshi領域）:
--   本番 Supabase で pgvector 拡張が有効化されている必要がある。
--   下の CREATE EXTENSION は Supabase では通常そのまま通る（vector は許可済み拡張）が、
--   権限で失敗する環境では Dashboard > Database > Extensions で "vector" を有効化してから
--   本ファイルの残りを流すこと。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pgvector 拡張
--    Supabase では extensions スキーマに入るのが通例。schema 指定なしでも動く。
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 2. embedding 列（1536次元・nullable）
--    text-embedding-3-small の次元。lib/embedding.ts の EMBEDDING_DIM と一致必須。
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_memories
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ----------------------------------------------------------------------------
-- 3. 近傍索引（HNSW・コサイン距離）
--    行数が少ない初期でも効く HNSW を採用（ivfflat は ANALYZE 後・件数依存で不安定）。
--    命名は company_schema.sql の規則 <table>_<col>_idx を踏襲。
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS company_memories_embedding_idx
  ON public.company_memories
  USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 4. 想起 RPC: match_company_memories
--    会社スコープで、クエリ埋め込みに意味が近い記憶を近い順に返す。
--
--    ★RLS: SECURITY INVOKER（既定）＝呼び出しユーザー(anon+JWT)の権限で実行される。
--      company_memories の既存 RLS（company_memories_member_select＝自社メンバーのみ可視）が
--      そのまま効く。p_company_id を渡しても、他社行は RLS で除外されるため二重に安全。
--
--    引数:
--      p_company_id      : 対象会社
--      p_query_embedding : クエリ埋め込みを pgvector テキストリテラル `[..]` で渡す
--                          （text 受けで ::vector にキャスト＝supabase-js から確実に渡せる）
--      p_match_count     : 返却上限（既定20）
--      p_memory_types    : 対象 memory_type（既定 summary/decision＝loadCompanyContext と同じ）
--
--    返却: 記憶行 + similarity（1 - コサイン距離。1に近いほど意味が近い）。
--    embedding が NULL の行は対象外（IS NOT NULL）。
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_company_memories(
  p_company_id uuid,
  p_query_embedding text,
  p_match_count int DEFAULT 20,
  p_memory_types text[] DEFAULT ARRAY['summary', 'decision']
)
RETURNS TABLE (
  id uuid,
  summary text,
  memory_type text,
  topic text,
  subject text,
  decided_at timestamptz,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.summary,
    m.memory_type,
    m.topic,
    m.subject,
    m.decided_at,
    m.created_at,
    1 - (m.embedding <=> (p_query_embedding)::vector) AS similarity
  FROM public.company_memories m
  WHERE m.company_id = p_company_id
    AND m.memory_type = ANY (p_memory_types)
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> (p_query_embedding)::vector
  LIMIT GREATEST(1, LEAST(p_match_count, 100));
$$;

-- 実行権限: 認証ユーザー（＝anon キー＋ログインJWT）から呼べるようにする。
-- RLS は SECURITY INVOKER のため関数内クエリにそのまま効く（テナント分離は不変）。
GRANT EXECUTE ON FUNCTION public.match_company_memories(uuid, text, int, text[]) TO anon, authenticated;

-- ============================================================================
-- RLS 影響確認（適用後・任意）:
--   関数は SECURITY INVOKER のため、company_memories の行レベルポリシーがそのまま適用される。
--   ＝自社メンバーのみが自社の記憶をセマンティック検索できる（他社行は返らない）。
--   確認:
--     SELECT proname, prosecdef FROM pg_proc WHERE proname='match_company_memories';
--       -- prosecdef = false（=SECURITY INVOKER）であること。
-- ============================================================================
