-- 記憶抽出の劣化（JSON取得失敗・APIエラー等）を記録する内部ログテーブル。
-- 目的: lib/memory.ts の「無言失敗」を観測可能にし、抽出品質を計測する。
-- 注意: これは内部運用用テーブル。ユーザーからの読み取りは不要なので
--       RLSを有効化しつつ「自分の行のみSELECT可・INSERTはサーバ経由」とする。

CREATE TABLE IF NOT EXISTS public.memoly_extraction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.memoly_users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('no_json', 'parse_error', 'api_error', 'empty_response')),
  recovered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.memoly_extraction_logs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の劣化ログのみ参照可（書き込みはRLSを通る認証クライアントで自分の行のみ）
CREATE POLICY "memoly_extraction_logs_own" ON public.memoly_extraction_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS memoly_extraction_logs_created_idx
  ON public.memoly_extraction_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS memoly_extraction_logs_reason_idx
  ON public.memoly_extraction_logs (reason);

-- 直近の劣化率を見るためのビュー（運用確認用）。
CREATE OR REPLACE VIEW public.memoly_extraction_health AS
SELECT
  reason,
  count(*) AS occurrences,
  count(*) FILTER (WHERE recovered) AS recovered_count,
  max(created_at) AS last_seen
FROM public.memoly_extraction_logs
WHERE created_at > now() - interval '7 days'
GROUP BY reason
ORDER BY occurrences DESC;
