-- 匿名の欠落分布のみ。本文・PIIは載せない。
-- 既存 companies スキーマとは独立。フル DDL は docs/gap-engine/schema-001_init.sql。

create table if not exists public.gap_stats_anonymous (
  yyyymm char(6) not null,
  industry text not null,
  headcount_band text not null,
  item_id text not null,
  status text not null check (status in ('written', 'ops_missing', 'unmentioned', 'unread', 'not_applicable')),
  n int not null default 0,
  primary key (yyyymm, industry, headcount_band, item_id, status)
);

comment on table public.gap_stats_anonymous is
  '登録後のずれ1枚から集計する匿名欠落分布。本文は保存しない。';

alter table public.gap_stats_anonymous enable row level security;

-- クライアント直書き禁止。service role のみ。
drop policy if exists gap_stats_anon_no_client on public.gap_stats_anonymous;
create policy gap_stats_anon_no_client
  on public.gap_stats_anonymous
  for all
  to authenticated, anon
  using (false)
  with check (false);
