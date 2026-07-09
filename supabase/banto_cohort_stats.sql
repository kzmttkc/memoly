-- ============================================================================
-- banto_cohort_stats.sql — 番頭(Banto) 週次PMF コホート/継続/収益 集計RPC
-- ----------------------------------------------------------------------------
-- 目的:
--   review.py の fetch_banto_cohort() が service_role キーで叩く 1 関数。
--   「会社が登録後も使い続けているか（リテンション=黒字化の生命線）」を
--   一次データ（companies × company_conversations/company_messages の最終活動）
--   から算出する。表示やアプリ集計に依存せず、DBの実テーブルで結論づける
--   （CLAUDE.md §0.5 原則4 証拠主義）。
--
-- 番頭の Supabase（= memoly プロジェクト `hsyalzzcemtewmtorwkn`。2026-06-26 に
-- Gokaku `tdipstzxpboqyxxlogko` とは分離済み。番頭の companies/company_* はこちらに在る）
-- への「追記のみ」。既存テーブル/RLS/関数は一切変更しない。company_* 名前空間に
-- 合わせて関数を1つ追加するだけ（他製品に波及させない）。
--
-- 設計の流儀（company_schema.sql / billing_subscriptions.sql に合わせる）:
--   - public スキーマ・snake_case・timestamptz
--   - SECURITY DEFINER（service_role から呼ぶ・RLSをバイパスして全会社を集計）
--   - 返り値は単一 jsonb（REST /rpc が素直に1オブジェクトを返す）
--
-- 指標定義（CMO/CPO設計・このRPCが算出する数値）:
--   - last_activity(company) = その会社の最終メッセージ時刻
--       （company_messages を company_conversations 経由で会社へ畳む）。
--        会話/メッセージがゼロの会社は companies.created_at を最終活動とみなす。
--   - M2継続率(2ヶ月継続率) = 「登録から60日以上経過した会社」のうち
--       「直近14日に活動がある」会社の割合。母数が0なら null（捏造しない）。
--   - 週次コホート(12週) = created_at の週(月曜起点)ごとに、登録社数と
--       「直近14日アクティブ社数」を返す。新規取得と定着の推移を見る。
--   - 収益 = company_billing_events を集計。
--       直近30日の課金イベント件数 / 課金額合計 / 累計課金額。
--   - activation(§1b・8/5解禁ゲート) = 「登録7日以内に初回利用があったか」。
--       分母 activation_7d_eligible = 登録から7日以上経過した会社（右打ち切り除外）。
--       分子 activation_7d_activated = うち、登録後7日以内(created_at 〜 created_at+7日)に
--         company_messages（company_conversations 経由で会社へ帰属）または
--         company_memories（company_id 直結）が1件以上ある会社。
--       activation_7d_rate = 分子 ÷ 分母（母数0は null・捏造しない）。
--   - 週次再訪(§1c・8/5解禁ゲート) weekly_return_7d = 登録から7日以上経過し、かつ
--       直近7日に company_messages 活動(last_activity 更新)がある会社数。
--       （初回オンボーディングの余熱＝登録7日未満の会社は分子から除外する。）
--
-- fail-safe 哲学（review.py に合わせる）:
--   テーブルが存在しない/空でも例外で落とさず、0 や null を素直に返す。
--   review.py 側は鍵未設定・HTTPエラーを握って文字列ブロックを返すので、
--   このRPCは「データが無いだけ」で壊れない（COALESCE/LEFT JOIN/条件集計）。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.banto_cohort_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts        timestamptz := now();
  result        jsonb;
  -- M2継続率
  m2_eligible   int;   -- 登録60日以上の会社数（母数）
  m2_retained   int;   -- うち直近14日に活動がある会社数
  m2_rate       numeric;
  -- 全体
  total_companies int;
  active_14d      int;  -- 全会社中、直近14日活動
  -- 収益
  rev_30d_count  int;
  rev_30d_amount bigint;
  rev_total_amount bigint;
  weekly         jsonb;
  -- activation(§1b) / 週次再訪(§1c) ＝ 8/5 課金解禁ゲート正式指標
  act_eligible   int;   -- 登録7日以上経過した会社数（分母・右打ち切り除外）
  act_activated  int;   -- うち登録後7日以内に 会話 or 記憶 が1件以上ある会社数（分子）
  act_rate       numeric;
  weekly_return  int;   -- 登録7日以上経過かつ直近7日に活動がある会社数
BEGIN
  -- ------------------------------------------------------------------
  -- 会社ごとの最終活動を一時的に組み立てる。
  --   last_msg = company_messages.created_at の最大（会話経由で会社へ畳む）。
  --   会話/メッセージが無い会社は created_at を最終活動とみなす。
  -- ------------------------------------------------------------------
  CREATE TEMP TABLE _banto_company_activity ON COMMIT DROP AS
  SELECT
    c.id,
    c.created_at,
    GREATEST(
      c.created_at,
      COALESCE(mx.last_msg, c.created_at)
    ) AS last_activity
  FROM public.companies c
  LEFT JOIN (
    SELECT conv.company_id, MAX(m.created_at) AS last_msg
    FROM public.company_messages m
    JOIN public.company_conversations conv ON conv.id = m.conversation_id
    GROUP BY conv.company_id
  ) mx ON mx.company_id = c.id;

  -- ------------------------------------------------------------------
  -- 全体
  -- ------------------------------------------------------------------
  SELECT count(*) INTO total_companies FROM _banto_company_activity;
  SELECT count(*) INTO active_14d
    FROM _banto_company_activity
    WHERE last_activity >= now_ts - interval '14 days';

  -- ------------------------------------------------------------------
  -- M2継続率（2ヶ月継続率）
  --   母数 = 登録60日以上経過した会社。分子 = うち直近14日活動。
  -- ------------------------------------------------------------------
  SELECT count(*) INTO m2_eligible
    FROM _banto_company_activity
    WHERE created_at <= now_ts - interval '60 days';
  SELECT count(*) INTO m2_retained
    FROM _banto_company_activity
    WHERE created_at <= now_ts - interval '60 days'
      AND last_activity >= now_ts - interval '14 days';
  IF m2_eligible > 0 THEN
    m2_rate := round(m2_retained::numeric / m2_eligible, 4);
  ELSE
    m2_rate := NULL;  -- 母数ゼロは「継続率0%」ではない。捏造しない。
  END IF;

  -- ------------------------------------------------------------------
  -- 週次コホート（直近12週・月曜起点）
  --   各週: 登録社数 signups と、その週登録の会社で直近14日活動の active 数。
  -- ------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week_start), '[]'::jsonb)
    INTO weekly
  FROM (
    SELECT
      to_char(date_trunc('week', a.created_at), 'YYYY-MM-DD') AS week_start,
      count(*) AS signups,
      count(*) FILTER (WHERE a.last_activity >= now_ts - interval '14 days') AS active_now
    FROM _banto_company_activity a
    WHERE a.created_at >= date_trunc('week', now_ts) - interval '11 weeks'
    GROUP BY date_trunc('week', a.created_at)
  ) t;

  -- ------------------------------------------------------------------
  -- 収益（company_billing_events）
  --   直近30日の課金イベント件数・額合計、累計課金額。
  --   amount は円(最小単位)。null は 0 とみなす。
  -- ------------------------------------------------------------------
  BEGIN
    SELECT
      count(*),
      COALESCE(sum(amount), 0)
      INTO rev_30d_count, rev_30d_amount
      FROM public.company_billing_events
      WHERE created_at >= now_ts - interval '30 days'
        AND amount IS NOT NULL;
    SELECT COALESCE(sum(amount), 0) INTO rev_total_amount
      FROM public.company_billing_events
      WHERE amount IS NOT NULL;
  EXCEPTION WHEN undefined_table THEN
    rev_30d_count := 0; rev_30d_amount := 0; rev_total_amount := 0;
  END;

  -- ------------------------------------------------------------------
  -- activation(§1b・8/5解禁ゲート) と 週次再訪(§1c・8/5解禁ゲート)
  --   BANTO_BILLING_GATE.md §6.3 で計画された4フィールド。
  --   分母は「登録7日以上経過の会社」（右打ち切り除外）。分子は「登録後7日以内の初回利用」。
  --   company_memories が存在しない環境でも落とさない（fail-safe: 会話のみで判定に縮退）。
  -- ------------------------------------------------------------------
  SELECT count(*) INTO act_eligible
    FROM _banto_company_activity
    WHERE created_at <= now_ts - interval '7 days';

  BEGIN
    SELECT count(*) INTO act_activated
      FROM _banto_company_activity a
      WHERE a.created_at <= now_ts - interval '7 days'
        AND (
          EXISTS (
            SELECT 1
            FROM public.company_messages m
            JOIN public.company_conversations conv ON conv.id = m.conversation_id
            WHERE conv.company_id = a.id
              AND m.created_at <= a.created_at + interval '7 days'
          )
          OR EXISTS (
            SELECT 1
            FROM public.company_memories mem
            WHERE mem.company_id = a.id
              AND mem.created_at <= a.created_at + interval '7 days'
          )
        );
  EXCEPTION WHEN undefined_table THEN
    -- company_memories 不在などの環境では会話のみで分子を算出（fail-safe）。
    SELECT count(*) INTO act_activated
      FROM _banto_company_activity a
      WHERE a.created_at <= now_ts - interval '7 days'
        AND EXISTS (
          SELECT 1
          FROM public.company_messages m
          JOIN public.company_conversations conv ON conv.id = m.conversation_id
          WHERE conv.company_id = a.id
            AND m.created_at <= a.created_at + interval '7 days'
        );
  END;

  IF act_eligible > 0 THEN
    act_rate := round(act_activated::numeric / act_eligible, 4);
  ELSE
    act_rate := NULL;  -- 母数ゼロは「activation 0%」ではない。捏造しない。
  END IF;

  -- 週次再訪(§1c): 登録7日以上経過（オンボーディング余熱除外）かつ直近7日に活動。
  SELECT count(*) INTO weekly_return
    FROM _banto_company_activity
    WHERE created_at <= now_ts - interval '7 days'
      AND last_activity >= now_ts - interval '7 days';

  -- ------------------------------------------------------------------
  -- 返り値
  -- ------------------------------------------------------------------
  result := jsonb_build_object(
    'generated_at',       now_ts,
    'total_companies',    total_companies,
    'active_14d',         active_14d,
    'm2_eligible',        m2_eligible,
    'm2_retained',        m2_retained,
    'm2_retention_rate',  m2_rate,           -- 2ヶ月継続率（null=母数ゼロ）
    'weekly_cohorts',     weekly,            -- [{week_start, signups, active_now}, ...]
    'revenue_30d_count',  rev_30d_count,
    'revenue_30d_amount', rev_30d_amount,    -- 円
    'revenue_total_amount', rev_total_amount, -- 円
    -- 8/5 課金解禁ゲート（BANTO_BILLING_GATE.md §1(b)(c)・§6.3）
    'activation_7d_eligible',  act_eligible,   -- 分母: 登録7日以上経過の会社数
    'activation_7d_activated', act_activated,  -- 分子: うち登録7日以内に会話or記憶1件以上
    'activation_7d_rate',      act_rate,       -- 分子÷分母（null=母数ゼロ・§1b しきい値≥0.40）
    'weekly_return_7d',        weekly_return   -- 登録7日以上経過かつ直近7日活動（§1c しきい値≥3）
  );

  RETURN result;
END;
$$;

-- service_role（RLSバイパス・review.py が使う）に実行権限を付与。
-- anon/authenticated には付与しない（集計は運用専用）。
REVOKE ALL ON FUNCTION public.banto_cohort_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banto_cohort_stats() TO service_role;

-- ============================================================================
-- 適用手順（Supabase SQL Editor / project hsyalzzcemtewmtorwkn = 番頭=memoly）:
--   ※ 2026-07-10 に Management API 経由で本番(hsyalzzcemtewmtorwkn)へ適用済み。
--     以後の再適用は冪等（CREATE OR REPLACE）。
--   1) このファイル全体を SQL Editor に貼って Run（または Management API /database/query）。
--   2) review.py の fetch_banto_cohort() が読む鍵を config/x_keys.json に追加:
--        BANTO_SUPABASE_URL         = https://hsyalzzcemtewmtorwkn.supabase.co
--        BANTO_SUPABASE_SERVICE_KEY = <service_role キー>
--      （番頭は memoly プロジェクトを器として転用。Gokaku とは別プロジェクト。
--        GOKAKU_SUPABASE_* を使うと companies が無く空/誤集計になるので使わない）
--   3) 動作確認: curl -X POST \
--        "$URL/rest/v1/rpc/banto_cohort_stats" \
--        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
--        -H "Content-Type: application/json" -d '{}'
-- ============================================================================
