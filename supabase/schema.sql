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
  digest_delivery_time text,
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

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  objective text not null,
  x_query text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  source_digest_id uuid references public.digests(id) on delete set null,
  source_followup_id uuid,
  last_checked_at timestamptz,
  last_check_status text
    check (last_check_status in ('quiet', 'material', 'error')),
  last_error text,
  last_material_update_at timestamptz,
  quiet_run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_checks (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.watches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_id uuid not null references public.digests(id) on delete cascade,
  digest_item_id uuid references public.digest_items(id) on delete set null,
  status text not null check (status in ('quiet', 'material', 'error')),
  source_url text,
  headline text not null default '',
  evidence_summary text not null default '',
  error_message text not null default '',
  created_at timestamptz not null default now()
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
alter table public.watches enable row level security;
alter table public.watch_checks enable row level security;
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

drop policy if exists "Users can read their watches"
  on public.watches;

create policy "Users can read their watches"
  on public.watches for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their watches"
  on public.watches;

create policy "Users can create their watches"
  on public.watches for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their watches"
  on public.watches;

create policy "Users can update their watches"
  on public.watches for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their watches"
  on public.watches;

create policy "Users can delete their watches"
  on public.watches for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their watch checks"
  on public.watch_checks;

create policy "Users can read their watch checks"
  on public.watch_checks for select
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

alter table public.digests
  add column if not exists digest_delivery_time text;

alter table public.digests
  add column if not exists watch_state_finalized_at timestamptz;

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

drop index if exists public.digests_user_local_date_unique_idx;

create unique index if not exists digests_user_local_date_delivery_time_unique_idx
  on public.digests (user_id, digest_local_date, digest_delivery_time)
  where digest_local_date is not null and digest_delivery_time is not null;

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

create unique index if not exists watches_user_source_followup_unique_idx
  on public.watches (user_id, source_digest_id, source_followup_id)
  where source_digest_id is not null and source_followup_id is not null;

create index if not exists watches_user_status_updated_idx
  on public.watches (user_id, status, updated_at desc);

create unique index if not exists watch_checks_watch_digest_unique_idx
  on public.watch_checks (watch_id, digest_id);

create index if not exists watch_checks_watch_created_idx
  on public.watch_checks (watch_id, created_at desc);

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

create or replace function public.activate_watch_from_followup(
  p_user_id uuid,
  p_source_digest_id uuid,
  p_source_followup_id uuid,
  p_title text,
  p_objective text,
  p_x_query text
)
returns public.watches
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_watch public.watches;
  active_count integer;
  inserted_watch public.watches;
begin
  perform 1
  from public.analyst_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.digests
    where id = p_source_digest_id
      and user_id = p_user_id
  ) then
    raise exception 'invalid_source_digest' using errcode = 'P0001';
  end if;

  select *
  into existing_watch
  from public.watches
  where user_id = p_user_id
    and source_digest_id = p_source_digest_id
    and source_followup_id = p_source_followup_id
  limit 1;

  if found then
    return existing_watch;
  end if;

  select count(*)
  into active_count
  from public.watches
  where user_id = p_user_id
    and status = 'active';

  if active_count >= 5 then
    raise exception 'active_watch_limit' using errcode = 'P0001';
  end if;

  insert into public.watches (
    user_id,
    title,
    objective,
    x_query,
    status,
    source_digest_id,
    source_followup_id
  ) values (
    p_user_id,
    p_title,
    p_objective,
    p_x_query,
    'active',
    p_source_digest_id,
    p_source_followup_id
  )
  returning * into inserted_watch;

  return inserted_watch;
end;
$$;

create or replace function public.finalize_watch_checks(
  p_user_id uuid,
  p_digest_id uuid,
  p_checks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  check_row record;
  inserted_check_id uuid;
begin
  if not exists (
    select 1
    from public.digests
    where id = p_digest_id
      and user_id = p_user_id
  ) then
    raise exception 'invalid_digest' using errcode = 'P0001';
  end if;

  for check_row in
    select *
    from jsonb_to_recordset(coalesce(p_checks, '[]'::jsonb)) as item(
      watch_id uuid,
      digest_item_id uuid,
      status text,
      source_url text,
      headline text,
      evidence_summary text,
      error_message text
    )
  loop
    if check_row.status not in ('quiet', 'material', 'error') then
      raise exception 'invalid_watch_check_status' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.watches
      where id = check_row.watch_id
        and user_id = p_user_id
    ) then
      raise exception 'invalid_watch' using errcode = 'P0001';
    end if;

    if check_row.digest_item_id is not null and not exists (
      select 1
      from public.digest_items
      where id = check_row.digest_item_id
        and digest_id = p_digest_id
        and user_id = p_user_id
    ) then
      raise exception 'invalid_digest_item' using errcode = 'P0001';
    end if;

    inserted_check_id := null;

    insert into public.watch_checks (
      watch_id,
      user_id,
      digest_id,
      digest_item_id,
      status,
      source_url,
      headline,
      evidence_summary,
      error_message
    ) values (
      check_row.watch_id,
      p_user_id,
      p_digest_id,
      check_row.digest_item_id,
      check_row.status,
      nullif(check_row.source_url, ''),
      coalesce(check_row.headline, ''),
      coalesce(check_row.evidence_summary, ''),
      coalesce(check_row.error_message, '')
    )
    on conflict (watch_id, digest_id) do nothing
    returning id into inserted_check_id;

    if inserted_check_id is not null then
      update public.watches
      set
        last_checked_at = now(),
        last_check_status = check_row.status,
        last_error = case
          when check_row.status = 'error'
            then nullif(coalesce(check_row.error_message, ''), '')
          else null
        end,
        last_material_update_at = case
          when check_row.status = 'material' then now()
          else last_material_update_at
        end,
        quiet_run_count = case
          when check_row.status = 'quiet' then quiet_run_count + 1
          when check_row.status = 'material' then 0
          else quiet_run_count
        end,
        updated_at = now()
      where id = check_row.watch_id
        and user_id = p_user_id;
    end if;
  end loop;

  update public.digests
  set watch_state_finalized_at = coalesce(watch_state_finalized_at, now())
  where id = p_digest_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.set_watch_status(
  p_user_id uuid,
  p_watch_id uuid,
  p_status text
)
returns public.watches
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
  updated_watch public.watches;
begin
  if p_status not in ('active', 'paused', 'archived') then
    raise exception 'invalid_watch_status' using errcode = 'P0001';
  end if;

  perform 1
  from public.analyst_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.watches
    where id = p_watch_id
      and user_id = p_user_id
  ) then
    raise exception 'invalid_watch' using errcode = 'P0001';
  end if;

  if p_status = 'active' then
    select count(*)
    into active_count
    from public.watches
    where user_id = p_user_id
      and status = 'active'
      and id <> p_watch_id;

    if active_count >= 5 then
      raise exception 'active_watch_limit' using errcode = 'P0001';
    end if;
  end if;

  update public.watches
  set status = p_status, updated_at = now()
  where id = p_watch_id
    and user_id = p_user_id
  returning * into updated_watch;

  return updated_watch;
end;
$$;

revoke all on function public.activate_watch_from_followup(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.activate_watch_from_followup(
  uuid, uuid, uuid, text, text, text
) to service_role;

revoke all on function public.finalize_watch_checks(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_watch_checks(
  uuid, uuid, jsonb
) to service_role;

revoke all on function public.set_watch_status(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.set_watch_status(
  uuid, uuid, text
) to service_role;

notify pgrst, 'reload schema';
