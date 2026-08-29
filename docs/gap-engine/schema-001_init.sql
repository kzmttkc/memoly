-- 就業規則AI core schema
-- Postgres 15+ / Supabase

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create type plan_code as enum ('free', 'entry', 'standard', 'shiwa');
create type gap_status as enum ('written', 'ops_missing', 'unmentioned', 'unread', 'not_applicable');
create type gap_priority as enum ('p0_deadline', 'p1_absolute', 'p2_dispute', 'p3_optional');
create type memory_confidence as enum ('high', 'medium');
create type doc_source as enum ('file', 'paste');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'company' check (kind in ('company', 'firm')),
  industry text,
  headcount_band text,
  plan plan_code not null default 'free',
  seat_limit int not null default 3,
  document_limit int not null default 1,
  chat_limit_per_day int not null default 20,
  stripe_customer_id text,
  stripe_subscription_id text,
  invoice_email text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.firm_clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,
  client_org_id uuid not null references public.organizations(id) on delete cascade,
  unique (firm_id, client_org_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source doc_source not null,
  filename text,
  mime text,
  byte_size int,
  page_count int,
  pages_read int,
  pages_unread int[],
  text_sha256 text not null,
  extracted_text text,
  schema_version text not null default '2026-08-29.1',
  saved_at timestamptz not null default now(),
  superseded_at timestamptz
);

create table public.gap_sheets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  schema_version text not null,
  model text not null,
  prompt_version text not null,
  payload jsonb not null,
  p0_count int not null default 0,
  p1_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  key text not null,
  label text not null,
  value text not null,
  locus text,
  quote text,
  confidence memory_confidence not null,
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'done', 'ignored')),
  unique (org_id, code)
);

create table public.consultation_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.consultation_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  body text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create table public.usage_counters (
  org_id uuid not null references public.organizations(id) on delete cascade,
  day date not null,
  chats int not null default 0,
  drafts int not null default 0,
  diagnoses int not null default 0,
  primary key (org_id, day)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  actor_id uuid,
  action text not null,
  target text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table public.gap_stats_anonymous (
  yyyymm char(6) not null,
  industry text not null,
  headcount_band text not null,
  item_id text not null,
  status gap_status not null,
  n int not null default 0,
  primary key (yyyymm, industry, headcount_band, item_id, status)
);

create table public.pre_auth_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip_hash, window_start)
);

create index gap_sheets_org_idx on public.gap_sheets (org_id, created_at desc);
create index documents_org_idx on public.documents (org_id, saved_at desc);
create index memories_org_idx on public.memories (org_id);
create index consult_msg_thread_idx on public.consultation_messages (thread_id, created_at);
create index audit_org_idx on public.audit_logs (org_id, created_at desc);
