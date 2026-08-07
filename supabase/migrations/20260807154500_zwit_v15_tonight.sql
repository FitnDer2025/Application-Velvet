begin;

create table if not exists public.member_tonight_statuses (
  profile_id uuid primary key references public.member_profiles(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  intent text not null default 'meet'
    check (intent in ('go_out', 'meet', 'chat', 'spontaneous')),
  venue_mode text[] not null default '{}'::text[]
    check (venue_mode <@ array['club','spa','bar','private','open']::text[]),
  wanted_profile_types text[] not null default '{}'::text[]
    check (wanted_profile_types <@ array['couple','woman','man']::text[]),
  radius_km integer not null default 50 check (radius_km between 10 and 200),
  location_label text,
  note text check (char_length(coalesce(note, '')) <= 280),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (expires_at <= starts_at + interval '12 hours')
);

create index if not exists member_tonight_statuses_live_idx
  on public.member_tonight_statuses (expires_at desc, updated_at desc);
create index if not exists member_tonight_statuses_intent_idx
  on public.member_tonight_statuses (intent, expires_at desc);

alter table public.member_tonight_statuses enable row level security;

drop policy if exists member_tonight_statuses_member_select on public.member_tonight_statuses;
create policy member_tonight_statuses_member_select
  on public.member_tonight_statuses
  for select
  using (
    expires_at > now()
    or exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = member_tonight_statuses.profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists member_tonight_statuses_owner_insert on public.member_tonight_statuses;
create policy member_tonight_statuses_owner_insert
  on public.member_tonight_statuses
  for insert
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = member_tonight_statuses.profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists member_tonight_statuses_owner_update on public.member_tonight_statuses;
create policy member_tonight_statuses_owner_update
  on public.member_tonight_statuses
  for update
  using (
    exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = member_tonight_statuses.profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  )
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = member_tonight_statuses.profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists member_tonight_statuses_owner_delete on public.member_tonight_statuses;
create policy member_tonight_statuses_owner_delete
  on public.member_tonight_statuses
  for delete
  using (
    exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = member_tonight_statuses.profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

grant select, insert, update, delete on public.member_tonight_statuses to authenticated;

commit;
