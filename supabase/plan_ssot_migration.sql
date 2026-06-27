-- ============================================================================
-- plan_ssot_migration.sql — companies.plan を lib/plans.ts の SSOT に統一する
-- ----------------------------------------------------------------------------
-- 背景:
--   旧 company_schema.sql は companies.plan の CHECK を
--     ('trial', 'starter', 'pro', 'enterprise')
--   と定義していたが、LP/UI は Entry/Standard/士業、コードの SSOT(lib/plans.ts)は
--     ('free', 'starter', 'standard', 'shigyo')
--   で運用する。この齟齬を解消し、課金結線の誤付与を防ぐ。
--
-- 安全な順序（CHECK 制約変更で既存行が弾かれないように）:
--   1. 既存値を新enumへマップ（trial→free, pro→standard, enterprise→shigyo,
--      starter→starter）
--   2. 旧 CHECK を外して新 CHECK を付け直す
--   3. DEFAULT を 'trial' → 'free' に変更（無料モニターが既定）
--
-- 冪等性: 何度流しても安全になるよう IF EXISTS / マップは現値前提で書く。
-- 適用は CEO（Supabase Management API / SQL Editor）。RLSポリシーは変更しない。
-- ============================================================================

BEGIN;

-- 1. 先に旧 CHECK を外す（新enum値へUPDATEする前に外さないと旧CHECK違反で失敗する）。
--    制約名は Postgres の既定命名（<table>_<col>_check）。IF EXISTS で冪等。
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_plan_check;

-- 2. 既存データを新enumへ寄せる（未知値は free に丸める）。
UPDATE public.companies SET plan = 'free'     WHERE plan = 'trial';
UPDATE public.companies SET plan = 'standard' WHERE plan = 'pro';
UPDATE public.companies SET plan = 'shigyo'   WHERE plan = 'enterprise';
UPDATE public.companies
   SET plan = 'free'
 WHERE plan NOT IN ('free', 'starter', 'standard', 'shigyo');

-- 3. 新 CHECK を付与。
ALTER TABLE public.companies
  ADD CONSTRAINT companies_plan_check
  CHECK (plan IN ('free', 'starter', 'standard', 'shigyo'));

-- 4. 既定値を無料モニターに。
ALTER TABLE public.companies ALTER COLUMN plan SET DEFAULT 'free';

-- 5. Stripe サブスクID列（subscription.updated/deleted を stripe_subscription_id で引くため）。
--    company_schema.sql は stripe_customer_id のみ持つ。subscription_id を追加。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- 既存行のうち plan を持たない/NULL を free に（NOT NULL 既定だが保険）。
UPDATE public.companies SET plan = 'free' WHERE plan IS NULL;

COMMIT;

-- 確認用（手動）:
--   SELECT plan, count(*) FROM public.companies GROUP BY plan;
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid = 'public.companies'::regclass AND contype = 'c';
