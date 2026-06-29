-- ============================================================================
-- company_leads.sql — 番頭(Banto) micro-CV リード捕捉テーブル
-- ----------------------------------------------------------------------------
-- 目的:
--   会社の「無料登録」は番頭にとって重い一歩（会社作成＋席＋初回相談）。
--   その手前に「メアドだけ」の軽い micro-CV を置き、LP訪問者の漏れを塞ぐ。
--   ここで集めるのは「就業規則チェックリストDL / 労務リスク3分診断」等の
--   無料配布をフックにしたメール（＝後で本登録へナーチャできる連絡先）。
--
-- 共有 Supabase（banto/gokaku/memoly 共有・project tdipstzxpboqyxxlogko）への
-- 「追記のみ」。既存テーブル/RLS/関数は一切変更しない。番頭名前空間 company_* に
-- 合わせて新テーブル company_leads を1枚追加するだけ（他製品に波及させない）。
--
-- 設計の流儀は supabase/company_schema.sql / extraction_logs.sql に厳密に合わせる:
--   - public スキーマ・snake_case・timestamptz DEFAULT now()
--   - RLS 有効
--   - インデックス命名 <table>_<col>_idx
--
-- RLS 方針（このテーブル固有の要件）:
--   - リードは「公開LPの匿名訪問者」が作る＝anon ロールに INSERT のみ許可する。
--   - 他者のリード（メール）は機密。anon の SELECT/UPDATE/DELETE は一切許可しない
--     （ポリシーを作らない＝RLS有効下では拒否）。運用閲覧は service role
--     （RLSバイパス）でのみ行う。これで「誰も他人のリードを読めない」を満たす。
--
-- メール重複の扱い（設計判断・UNIQUE を張らない）:
--   ★ あえて email に UNIQUE 制約を付けない。理由は3つ。
--     1) micro-CV は「同じ人が別フック（チェックリスト/診断）で再度メアドを置く」
--        ことが正常な行動。source 別に獲得経路を残したい（どのフックが効いたか）。
--     2) UNIQUE 違反は anon INSERT で 409/エラーを返し、フロントで分岐実装が要る。
--        重複を「サイレントに受理」する方がUX・実装ともに軽い（重い登録の手前
--        なので厳密な一意性は不要）。
--     3) 一意制約があると「既存メールの存在確認」を anon に許す副作用（列挙攻撃で
--        メールの在/不在が判る）になりうる。重複許容なら漏れない。
--   → 重複排除は集計/配信側（service role の DISTINCT email）で行う。捕捉は緩く、
--     名寄せは後段で、という分業にする。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- company_leads — micro-CV で集めたメール（本登録の手前のファネル）。
--   company_id は任意(null許容): リード時点では会社未作成が普通なので基本 null。
--   将来「会社を作ったユーザーが追加でDL」した等で紐付けたい場合のために列だけ用意。
--   meta(jsonb): 診断結果やフックのバリアント等の非個人メタ（PIIは入れない方針）。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1),
  source text NOT NULL DEFAULT 'unknown'
    CHECK (char_length(source) BETWEEN 1 AND 64),
  company_id uuid, -- 任意。基本は null。リード時点は会社未作成のためFKは付けない(companies非依存)
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,                            -- 診断結果メタ等（PIIなし）。
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- RLS 有効化（既定で全ロール拒否 → 必要な許可だけポリシーで開ける）
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_leads ENABLE ROW LEVEL SECURITY;

-- anon は INSERT のみ可（公開LPの匿名訪問者がメアドを置ける）。
-- WITH CHECK true = 行の内容に追加制約は課さない（列のCHECK制約で形式は担保済み）。
-- ※ authenticated ロールも anon を継承する文脈で INSERT できるよう public に付与する。
CREATE POLICY "company_leads_anon_insert" ON public.company_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- SELECT / UPDATE / DELETE ポリシーは「作らない」。
--   RLS 有効下でポリシーが無い操作は全ロールで拒否される＝anon/authenticated は
--   他者のリードを読めない・書き換えられない・消せない。閲覧/集計/配信は
--   service role（RLSバイパス）でのみ行う（運用側の責務）。

-- ----------------------------------------------------------------------------
-- インデックス（company_schema.sql の命名規則 <table>_<col>_idx を踏襲）
--   - created_at DESC: 直近リードの取得・日次集計用。
--   - source: フック別（チェックリスト/診断）の獲得数集計用。
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS company_leads_created_at_idx ON public.company_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS company_leads_source_idx     ON public.company_leads (source);
