-- ============================================================================
-- billing_past_due_grace.sql — 滞納(past_due)に時間上限を入れる（監査 2026-07-30 #2）
-- ----------------------------------------------------------------------------
-- 【何を守るか】
--   支払い失敗後の「猶予(grace)」に期限を持たせ、無償で有料機能を持ち続けられる
--   状態を有限にする。webhook が past_due に落ちた初回時刻を companies.past_due_since
--   に刻み、日次 cron（/api/company/billing/past-due-sweep）が 21 日超過を
--   plan='free' へ落とす。支払いが成功すれば webhook が NULL に戻す（自動復帰）。
--
-- 【落ちたら（＝適用しないと）何が起きるか】
--   past_due の降格は customer.subscription.deleted の到着に完全依存する。Stripe 側の
--   リトライ終了時の挙動が「何もしない」だと deleted は永遠に来ず、1円も払わないまま
--   有料プラン（最大 ¥29,800/月 相当の機能）を無期限に使い続けられる。
--   なお **未適用でもアプリは壊れない**: webhook の past_due_since 更新はエラーをログに
--   落とすだけの best-effort、cron は列が無ければ skipped で 200 を返す設計にしてある。
--   未適用の間は「上限が効かない」＝従来どおりの挙動になるだけ。
--
-- 【適用手順（Takeshi 手番）】
--   1. Supabase ダッシュボード → SQL Editor に本ファイル全文を貼って実行
--   2. 反映確認:
--        select column_name, data_type from information_schema.columns
--         where table_name='companies' and column_name='past_due_since';
--        select grantee, privilege_type, column_name
--          from information_schema.column_privileges
--         where table_name='companies' and grantee='authenticated';
--      → past_due_since が存在し、authenticated の UPDATE は name 列のみ
--   3. Vercel env に OPS_SLACK_WEBHOOK_URL（任意）を入れると降格前に ops へ通知が飛ぶ
--   4. 動作確認（本番を壊さない順）:
--        update public.companies set status='past_due',
--               past_due_since = now() - interval '22 days'
--         where id = '<検証用の会社ID>';
--        curl -H "Authorization: Bearer $CRON_SECRET" \
--          "https://banto-roumu.com/api/company/billing/past-due-sweep?dryRun=1"
--      → 対象に出ることを確認してから dryRun を外す
--
-- 冪等: 何度流しても安全（IF NOT EXISTS / revoke+grant の再実行）。
-- ============================================================================

BEGIN;

-- 1. 滞納開始時刻。NULL = 滞納していない。webhook が past_due 初回にだけ刻む
--    （リトライごとに上書きすると猶予期限が一生来ないため、更新は past_due_since IS NULL 限定）。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

COMMENT ON COLUMN public.companies.past_due_since IS
  '支払い失敗で past_due に落ちた最初の時刻。21日超過で /api/company/billing/past-due-sweep が plan=free へ降格する。支払い成功で NULL に戻る。';

-- 2. sweep の抽出（status='past_due' かつ plan<>'free' を past_due_since 昇順）を効かせる。
CREATE INDEX IF NOT EXISTS companies_past_due_since_idx
  ON public.companies (status, past_due_since)
  WHERE past_due_since IS NOT NULL;

-- 3. 列権限の再確認（high1_companies_column_grant.sql と同じ least-privilege）。
--    past_due_since を authenticated が書けると、滞納の時計を自分で巻き戻して
--    猶予を無限に延長できる。UPDATE は name 列のみに絞ったままにする。
--    課金 webhook / cron は service role で更新するため影響なし。
REVOKE UPDATE ON public.companies FROM anon, authenticated;
GRANT  UPDATE (name) ON public.companies TO authenticated;

COMMIT;
