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

create table if not exists public.digest_items (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_subject text not null,
  digest_created_at timestamptz not null,
  section_title text not null,
  title text not null,
  source_label text not null,
  url text not null,
  via_handle text not null default '',
  via_url text not null default '',
  source_type text not null,
  why text not null,
  takeaway text not null,
  tags text[] not null default '{}',
  rejected_at timestamptz,
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
alter table public.digest_items enable row level security;
alter table public.article_feedback enable row level security;

drop policy if exists "Users can read their analyst profile"
  on public.analyst_profiles;

create policy "Users can read their analyst profile"
  on public.analyst_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their analyst profile"
  on public.analyst_profiles;

create policy "Users can update their analyst profile"
  on public.analyst_profiles for update
  using (auth.uid() = user_id);

drop policy if exists "Users can read their digests"
  on public.digests;

create policy "Users can read their digests"
  on public.digests for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their digest items"
  on public.digest_items;

create policy "Users can read their digest items"
  on public.digest_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their article feedback"
  on public.article_feedback;

create policy "Users can read their article feedback"
  on public.article_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their article feedback"
  on public.article_feedback;

create policy "Users can create their article feedback"
  on public.article_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their article feedback"
  on public.article_feedback;

create policy "Users can delete their article feedback"
  on public.article_feedback for delete
  using (auth.uid() = user_id);

alter table public.analyst_profiles
  add column if not exists priority_handles text[] not null default '{}';

alter table public.digest_items
  add column if not exists rejected_at timestamptz;

create index if not exists digests_user_created_idx
  on public.digests (user_id, created_at desc);

create index if not exists digest_items_user_created_idx
  on public.digest_items (user_id, digest_created_at desc);

create index if not exists digest_items_tags_idx
  on public.digest_items using gin (tags);

create index if not exists digest_items_user_rejected_idx
  on public.digest_items (user_id, rejected_at, digest_created_at desc);

create unique index if not exists digest_items_digest_item_unique_idx
  on public.digest_items (digest_id, section_title, url, title);

create index if not exists article_feedback_user_created_idx
  on public.article_feedback (user_id, created_at desc);

create or replace function public.topic_filter_tags(
  profile_user_id uuid,
  selected_tags text[] default '{}'
)
returns table(tag text)
language sql
stable
as $$
  select distinct tag
  from public.digest_items di
  cross join lateral unnest(di.tags) as tag
  where di.user_id = profile_user_id
    and di.rejected_at is null
    and (
      coalesce(cardinality(selected_tags), 0) = 0
      or di.tags @> selected_tags
    )
  order by tag;
$$;

notify pgrst, 'reload schema';
