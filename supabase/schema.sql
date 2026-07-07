create extension if not exists pgcrypto;

create table if not exists public.analyst_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  interest_profile_md text not null default '',
  x_list_id text,
  discovery_queries text[] not null default '{}',
  priority_handles text[] not null default '{}',
  digest_email text,
  delivery_timezone text not null default 'Europe/Berlin',
  delivery_time text not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body_md text not null,
  item_count integer not null default 0,
  digest_local_date date,
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
  final_url text not null default '',
  content_title text not null default '',
  content_description text not null default '',
  content_text text not null default '',
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

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_id uuid references public.digests(id) on delete set null,
  digest_item_id uuid references public.digest_items(id) on delete set null,
  digest_subject text not null default '',
  digest_created_at timestamptz,
  section_title text not null default '',
  title text not null,
  source_label text not null,
  url text not null,
  final_url text not null default '',
  via_handle text not null default '',
  via_url text not null default '',
  source_type text not null default '',
  why text not null default '',
  takeaway text not null default '',
  tags text[] not null default '{}',
  note text not null default '',
  content_title text not null default '',
  content_description text not null default '',
  content_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waitlist_requests (
  email text primary key,
  status text not null default 'pending',
  source text not null default 'login',
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_access (
  email text primary key,
  status text not null default 'approved' check (status in ('approved', 'blocked')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.analyst_profiles enable row level security;
alter table public.digests enable row level security;
alter table public.digest_items enable row level security;
alter table public.article_feedback enable row level security;
alter table public.collection_items enable row level security;
alter table public.waitlist_requests enable row level security;
alter table public.user_access enable row level security;

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

drop policy if exists "Users can read their collection items"
  on public.collection_items;

create policy "Users can read their collection items"
  on public.collection_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their collection items"
  on public.collection_items;

create policy "Users can create their collection items"
  on public.collection_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their collection items"
  on public.collection_items;

create policy "Users can update their collection items"
  on public.collection_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their collection items"
  on public.collection_items;

create policy "Users can delete their collection items"
  on public.collection_items for delete
  using (auth.uid() = user_id);

drop policy if exists "Allowed users can read waitlist requests"
  on public.waitlist_requests;

alter table public.analyst_profiles
  add column if not exists priority_handles text[] not null default '{}';

alter table public.analyst_profiles
  add column if not exists delivery_timezone text not null default 'Europe/Berlin';

alter table public.analyst_profiles
  add column if not exists delivery_time text not null default '08:00';

alter table public.digests
  add column if not exists digest_local_date date;

alter table public.digest_items
  add column if not exists rejected_at timestamptz;

alter table public.digest_items
  add column if not exists final_url text not null default '';

alter table public.digest_items
  add column if not exists content_title text not null default '';

alter table public.digest_items
  add column if not exists content_description text not null default '';

alter table public.digest_items
  add column if not exists content_text text not null default '';

create index if not exists digests_user_created_idx
  on public.digests (user_id, created_at desc);

create unique index if not exists digests_user_local_date_unique_idx
  on public.digests (user_id, digest_local_date)
  where digest_local_date is not null;

create index if not exists digest_items_user_created_idx
  on public.digest_items (user_id, digest_created_at desc);

create index if not exists digest_items_tags_idx
  on public.digest_items using gin (tags);

create index if not exists digest_items_user_rejected_idx
  on public.digest_items (user_id, rejected_at, digest_created_at desc);

create index if not exists digest_items_user_url_idx
  on public.digest_items (user_id, url);

create index if not exists digest_items_user_final_url_idx
  on public.digest_items (user_id, final_url);

create unique index if not exists digest_items_digest_item_unique_idx
  on public.digest_items (digest_id, section_title, url, title);

create index if not exists article_feedback_user_created_idx
  on public.article_feedback (user_id, created_at desc);

create unique index if not exists collection_items_user_url_unique_idx
  on public.collection_items (user_id, url);

create index if not exists collection_items_user_created_idx
  on public.collection_items (user_id, created_at desc);

create index if not exists waitlist_requests_status_created_idx
  on public.waitlist_requests (status, created_at desc);

create index if not exists user_access_status_updated_idx
  on public.user_access (status, updated_at desc);

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
