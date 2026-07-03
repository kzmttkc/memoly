-- ============================================================================
-- cleanup_orphan_companies.sql — 退会後データ残存の後始末（CTO P2-2 バックストップ）
-- ----------------------------------------------------------------------------
-- 目的:
--   退会（DELETE /api/account）で auth ユーザーを消すと company_members.user_id は
--   FK(ON DELETE CASCADE) で自動除去されるが、会社本体(companies)と会社スコープの
--   データ(company_memories/company_documents/company_deadlines/company_profiles/
--   company_conversations/company_messages/company_digests) は company_id をキーに
--   companies へ CASCADE する設計のため、会社が残る限り残存する。
--
--   本フィックス(app/api/account/route.ts)以降は「退会者が最後の1人だった会社」を
--   退会時にその場で削除する。本SQLは【本フィックス以前に既に無人化した孤児会社】を
--   一度だけ回収するためのバックストップ。冪等（何度流しても同じ結果）。
--
-- 安全設計:
--   - 対象は「メンバーが1人も存在しない会社」だけ（NOT EXISTS company_members）。
--     現役メンバーが1人でもいる会社は共有資産なので絶対に触らない。
--   - companies を消せば company_* 全テーブルは ON DELETE CASCADE で連鎖削除される
--     （個々の company_* を直接 DELETE しない＝取りこぼし・順序事故を防ぐ）。
--   - まず SELECT で対象を必ず目視してから DELETE を流すこと（下の手順参照）。
--
-- 適用はCEO（このファイルは書くだけ・自動適用しない）。
-- ============================================================================

-- 手順1: 削除対象（無人の孤児会社）を確認する。0件なら掃除は不要。
--   実行して件数・会社名を必ず目視してから手順2へ進む。
SELECT c.id, c.name, c.plan, c.status, c.created_at
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_members m WHERE m.company_id = c.id
)
ORDER BY c.created_at;

-- 手順2: 目視で問題なければ、無人の孤児会社を削除する（company_* は CASCADE で連鎖削除）。
--   冪等: 既に消えていれば0件更新。現役メンバーがいる会社は WHERE で除外され安全。
-- DELETE FROM public.companies c
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.company_members m WHERE m.company_id = c.id
-- );

-- 手順3（任意・検算）: company_id が companies に無い company_* 行が残っていないか確認。
--   ON DELETE CASCADE が効いていれば常に0件。1件でも出たらCASCADE未適用を疑う。
-- SELECT 'company_memories'  AS tbl, count(*) FROM public.company_memories   x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id)
-- UNION ALL SELECT 'company_documents',   count(*) FROM public.company_documents     x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id)
-- UNION ALL SELECT 'company_deadlines',   count(*) FROM public.company_deadlines     x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id)
-- UNION ALL SELECT 'company_profiles',    count(*) FROM public.company_profiles      x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id)
-- UNION ALL SELECT 'company_conversations',count(*) FROM public.company_conversations x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id)
-- UNION ALL SELECT 'company_digests',     count(*) FROM public.company_digests       x WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = x.company_id);
