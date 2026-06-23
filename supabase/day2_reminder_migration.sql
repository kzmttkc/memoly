-- Day 2 リマインドメール重複防止フラグ
-- memoly_users に day2_sent_at カラムを追加
-- NULL = 未送信 / timestamptz = 送信済み（送信日時）

ALTER TABLE public.memoly_users
  ADD COLUMN IF NOT EXISTS day2_sent_at timestamptz DEFAULT NULL;

-- インデックス（Cronジョブのクエリ最適化）
CREATE INDEX IF NOT EXISTS memoly_users_day2_sent_at_idx
  ON public.memoly_users (day2_sent_at)
  WHERE day2_sent_at IS NULL;
