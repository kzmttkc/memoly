-- AIコンテンツ報告テーブル（App Store審査対応）
CREATE TABLE IF NOT EXISTS memoly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE memoly_reports ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の報告のみ挿入可能（閲覧はservice roleのみ）
CREATE POLICY "Users can insert own reports" ON memoly_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
