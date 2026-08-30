-- pack_invites: カスハラ実務パック購入者を Free（ずれ1枚）へ案内する記録
create table if not exists public.pack_invites (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'mailed', 'existing_user', 'error')),
  user_id uuid null,
  mailed_at timestamptz null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists pack_invites_email_idx on public.pack_invites (email);

comment on table public.pack_invites is
  '就業規則AI: パック Payment Link 購入者への Free 招待（Word配信は Agent 側）';
