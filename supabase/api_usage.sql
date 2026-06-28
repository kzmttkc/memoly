-- api_usage — ユーザー単位・日次・種別(kind)別のAPIコール数カウンタ。
-- 目的: 高コストLLM系API（chat / document/generate / document/review / insights /
--       risk-audit）を認証ユーザーが無制限に連打できてしまう問題への防御。
--       各routeのLLM呼び出し前に lib/rate-limit.ts の checkAndIncrement が
--       service role でこの行を upsert+1 し、当日上限を超えたら 429 を返す。
--
-- 設計:
--   - PK は (user_id, day, kind)。1ユーザー×1日×1種別で1行。
--   - 更新は service role（RLSバイパス）でのみ行う想定。RLSは有効化しつつ
--     「本人が自分の利用状況をSELECTできる」ポリシーのみ付与（書込みポリシーは
--     付与しない＝anonからの改ざんを防ぐ。書込みは service role に限定）。
--   - day は date 型（UTC基準で十分。厳密な日本時間境界は要件外）。

CREATE TABLE IF NOT EXISTS public.memoly_api_usage (
  user_id uuid NOT NULL,
  day     date NOT NULL DEFAULT (now()::date),
  kind    text NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, kind)
);

ALTER TABLE public.memoly_api_usage ENABLE ROW LEVEL SECURITY;

-- 本人は自分の利用状況のみ参照可（書込みは service role 経由のみ＝ポリシー未付与）。
DROP POLICY IF EXISTS "memoly_api_usage_own_select" ON public.memoly_api_usage;
CREATE POLICY "memoly_api_usage_own_select" ON public.memoly_api_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS memoly_api_usage_day_idx
  ON public.memoly_api_usage (day);

-- 当日カウンタを原子的に +1 して新しい値を返す関数。
-- 競合（同時連打）でも ON CONFLICT で安全に加算する。service role から RPC で呼ぶ。
-- SECURITY DEFINER は付けない（service role 自体が RLS をバイパスするため不要）。
CREATE OR REPLACE FUNCTION public.memoly_increment_api_usage(
  p_user_id uuid,
  p_kind    text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.memoly_api_usage (user_id, day, kind, count, updated_at)
  VALUES (p_user_id, now()::date, p_kind, 1, now())
  ON CONFLICT (user_id, day, kind)
  DO UPDATE SET count = public.memoly_api_usage.count + 1,
               updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
