-- Row Level Security
-- auth.uid() が memberships.user_id と一致する組織の行だけ読める

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.firm_clients enable row level security;
alter table public.documents enable row level security;
alter table public.gap_sheets enable row level security;
alter table public.memories enable row level security;
alter table public.deadlines enable row level security;
alter table public.consultation_threads enable row level security;
alter table public.consultation_messages enable row level security;
alter table public.usage_counters enable row level security;
alter table public.audit_logs enable row level security;

-- 匿名集計とレート制限は service role のみ
alter table public.gap_stats_anonymous enable row level security;
alter table public.pre_auth_rate_limits enable row level security;

create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.firm_clients fc
    join public.memberships fm on fm.org_id = fc.firm_id
    where fc.client_org_id = target and fm.user_id = auth.uid()
  );
$$;

create policy org_select on public.organizations
  for select using (public.is_org_member(id));

create policy org_update on public.organizations
  for update using (
    exists (
      select 1 from public.memberships
      where org_id = organizations.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy membership_select on public.memberships
  for select using (public.is_org_member(org_id));

create policy docs_all on public.documents
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy sheets_all on public.gap_sheets
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy memories_all on public.memories
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy deadlines_all on public.deadlines
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy threads_all on public.consultation_threads
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy messages_all on public.consultation_messages
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy usage_select on public.usage_counters
  for select using (public.is_org_member(org_id));

create policy audit_select on public.audit_logs
  for select using (public.is_org_member(org_id));

-- gap_stats_anonymous / pre_auth_rate_limits にはポリシーを置かない
-- = authenticated からは見えない。service role のみ。
