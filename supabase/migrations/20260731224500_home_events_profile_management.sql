begin;

alter table public.member_profiles
  add column if not exists profile_photo_ready boolean not null default false;

alter table public.conversation_members
  add column if not exists hidden_at timestamptz;

alter table public.events
  add column if not exists event_category text not null default 'standard',
  add column if not exists cap_zone text,
  add column if not exists cap_venue text,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists moderation_status text not null default 'approved',
  add column if not exists ai_assessment jsonb not null default '{}'::jsonb;

alter table public.events
  drop constraint if exists events_event_category_check;
alter table public.events
  add constraint events_event_category_check
  check (event_category in ('standard', 'cap_dagde'));

alter table public.events
  drop constraint if exists events_moderation_status_check;
alter table public.events
  add constraint events_moderation_status_check
  check (moderation_status in ('approved', 'review', 'rejected'));

create table if not exists public.member_experience_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discovery_radius_km integer not null default 50 check (discovery_radius_km between 10 and 200),
  profile_sort text not null default 'distance' check (profile_sort in ('distance', 'compatibility', 'recent', 'affinity')),
  ai_personalization_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.member_experience_preferences enable row level security;

drop policy if exists member_experience_preferences_self_select on public.member_experience_preferences;
create policy member_experience_preferences_self_select
  on public.member_experience_preferences
  for select
  using (user_id = auth.uid());

drop policy if exists member_experience_preferences_self_insert on public.member_experience_preferences;
create policy member_experience_preferences_self_insert
  on public.member_experience_preferences
  for insert
  with check (user_id = auth.uid());

drop policy if exists member_experience_preferences_self_update on public.member_experience_preferences;
create policy member_experience_preferences_self_update
  on public.member_experience_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.member_experience_preferences to authenticated;

create or replace function public.sync_profile_photo_ready(target_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ready boolean;
begin
  if target_profile_id is null then
    return false;
  end if;

  select count(*) >= 3
  into ready
  from public.media_assets
  where profile_id = target_profile_id
    and album_id is null
    and media_type = 'image'
    and media_role in ('couple_gallery', 'individual_gallery')
    and moderation_status = 'approved';

  update public.member_profiles
  set profile_photo_ready = ready,
      updated_at = now()
  where id = target_profile_id
    and profile_photo_ready is distinct from ready;

  return ready;
end;
$$;

grant execute on function public.sync_profile_photo_ready(uuid) to authenticated;

create or replace function public.sync_profile_photo_ready_from_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_profile_photo_ready(coalesce(new.profile_id, old.profile_id));
  if tg_op = 'UPDATE' and old.profile_id is distinct from new.profile_id then
    perform public.sync_profile_photo_ready(old.profile_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists media_assets_sync_profile_photo_ready on public.media_assets;
create trigger media_assets_sync_profile_photo_ready
  after insert or update of profile_id, album_id, media_role, media_type, moderation_status or delete
  on public.media_assets
  for each row execute function public.sync_profile_photo_ready_from_media();

update public.member_profiles profile
set profile_photo_ready = (
  select count(*) >= 3
  from public.media_assets media
  where media.profile_id = profile.id
    and media.album_id is null
    and media.media_type = 'image'
    and media.media_role in ('couple_gallery', 'individual_gallery')
    and media.moderation_status = 'approved'
);

create index if not exists member_profiles_photo_ready_idx
  on public.member_profiles (profile_photo_ready, visibility, updated_at desc);
create index if not exists conversation_members_visible_idx
  on public.conversation_members (user_id, hidden_at, left_at, conversation_id);
create index if not exists events_member_discovery_idx
  on public.events (visibility, moderation_status, starts_at, organizer_profile_id, establishment_id);

alter table public.events enable row level security;

drop policy if exists events_member_insert on public.events;
create policy events_member_insert
  on public.events
  for insert
  with check (
    created_by_user_id = auth.uid()
    and organizer_profile_id is not null
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = events.organizer_profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists events_member_update on public.events;
create policy events_member_update
  on public.events
  for update
  using (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = events.organizer_profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  )
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = events.organizer_profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

drop policy if exists events_member_delete on public.events;
create policy events_member_delete
  on public.events
  for delete
  using (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = events.organizer_profile_id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );

grant insert, update, delete on public.events to authenticated;

commit;
