create extension if not exists pgcrypto;

create table if not exists public.analyst_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  interest_profile_md text not null default '',
  x_list_id text,
  discovery_queries text[] not null default '{}',
  priority_handles text[] not null default '{}',
  digest_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body_md text not null,
  item_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.article_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_id uuid references public.digests(id) on delete set null,
  item_url text not null,
  item_title text not null,
  source_label text not null,
  via_handle text not null default '',
  tags text[] not null default '{}',
  direction text not null check (direction in ('more', 'less')),
  reason text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.analyst_profiles enable row level security;
alter table public.digests enable row level security;
alter table public.article_feedback enable row level security;

create policy "Users can read their analyst profile"
  on public.analyst_profiles for select
  using (auth.uid() = user_id);

create policy "Users can update their analyst profile"
  on public.analyst_profiles for update
  using (auth.uid() = user_id);

create policy "Users can read their digests"
  on public.digests for select
  using (auth.uid() = user_id);

create policy "Users can read their article feedback"
  on public.article_feedback for select
  using (auth.uid() = user_id);

create policy "Users can create their article feedback"
  on public.article_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their article feedback"
  on public.article_feedback for delete
  using (auth.uid() = user_id);

create index if not exists digests_user_created_idx
  on public.digests (user_id, created_at desc);

create index if not exists article_feedback_user_created_idx
  on public.article_feedback (user_id, created_at desc);

alter table public.analyst_profiles
  add column if not exists priority_handles text[] not null default '{}';

notify pgrst, 'reload schema';
