-- Velvet BETA — messagerie enrichie, projets de sorties, suivi et cycle de vie.
-- À exécuter manuellement dans Supabase après déploiement du code applicatif.

alter table public.messages
  alter column body drop not null;
alter table public.messages
  drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check
  check (body is null or char_length(body) between 1 and 10000);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploader_user_id uuid not null references public.accounts(user_id) on delete restrict,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video','document')),
  mime_type text not null,
  original_name text not null check (char_length(original_name) between 1 and 240),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now()
);
create index if not exists message_attachments_message_idx
  on public.message_attachments(message_id,created_at);
alter table public.message_attachments enable row level security;
drop policy if exists message_attachments_conversation_read on public.message_attachments;
create policy message_attachments_conversation_read
on public.message_attachments for select to authenticated
using (public.is_conversation_member(conversation_id) or public.is_control_user());
drop policy if exists message_attachments_member_create on public.message_attachments;
create policy message_attachments_member_create
on public.message_attachments for insert to authenticated
with check (
  uploader_user_id=auth.uid()
  and public.is_conversation_member(conversation_id)
  and exists (
    select 1 from public.messages m
    where m.id=message_id
      and m.conversation_id=message_attachments.conversation_id
      and m.sender_user_id=auth.uid()
  )
);
grant select,insert on public.message_attachments to authenticated;

drop policy if exists velvet_media_message_read on storage.objects;
create policy velvet_media_message_read on storage.objects
for select to authenticated
using (
  bucket_id='velvet-media'
  and (storage.foldername(name))[1]='messages'
  and exists (
    select 1 from public.message_attachments attachment
    where attachment.storage_path=name
      and (
        public.is_conversation_member(attachment.conversation_id)
        or public.is_control_user()
      )
  )
);
drop policy if exists velvet_media_message_insert on storage.objects;
create policy velvet_media_message_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='velvet-media'
  and (storage.foldername(name))[1]='messages'
  and (storage.foldername(name))[3]=auth.uid()::text
  and public.is_conversation_member(((storage.foldername(name))[2])::uuid)
);
drop policy if exists velvet_media_message_delete on storage.objects;
create policy velvet_media_message_delete on storage.objects
for delete to authenticated
using (
  bucket_id='velvet-media'
  and (storage.foldername(name))[1]='messages'
  and (storage.foldername(name))[3]=auth.uid()::text
);

create table if not exists public.profile_venue_visits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  venue_id uuid not null references public.venue_directory(id) on delete cascade,
  visit_date date not null,
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,venue_id,visit_date)
);
create index if not exists profile_venue_visits_venue_date_idx
  on public.profile_venue_visits(venue_id,visit_date);
alter table public.profile_venue_visits enable row level security;
drop policy if exists profile_venue_visits_visible on public.profile_venue_visits;
create policy profile_venue_visits_visible
on public.profile_venue_visits for select to authenticated
using (public.can_view_profile(profile_id));
drop policy if exists profile_venue_visits_owner on public.profile_venue_visits;
create policy profile_venue_visits_owner
on public.profile_venue_visits for all to authenticated
using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id) and created_by=auth.uid());
grant select,insert,update,delete on public.profile_venue_visits to authenticated;

create table if not exists public.profile_travel_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  location_label text not null check (char_length(location_label) between 2 and 240),
  starts_on date not null,
  ends_on date not null,
  latitude double precision,
  longitude double precision,
  precise_location_consent boolean not null default false,
  destination_type text not null default 'general'
    check (destination_type in ('general','cap_dagde_village')),
  cap_zone text,
  cap_venue text,
  notes text check (notes is null or char_length(notes)<=2000),
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on>=starts_on),
  check (
    (latitude is null and longitude is null)
    or (
      precise_location_consent
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),
  check (
    destination_type<>'cap_dagde_village'
    or cap_zone is not null
  )
);
create index if not exists profile_travel_plans_schedule_idx
  on public.profile_travel_plans(starts_on,ends_on);
alter table public.profile_travel_plans enable row level security;
drop policy if exists profile_travel_plans_visible on public.profile_travel_plans;
create policy profile_travel_plans_visible
on public.profile_travel_plans for select to authenticated
using (public.can_view_profile(profile_id));
drop policy if exists profile_travel_plans_owner on public.profile_travel_plans;
create policy profile_travel_plans_owner
on public.profile_travel_plans for all to authenticated
using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id) and created_by=auth.uid());
grant select,insert,update,delete on public.profile_travel_plans to authenticated;

create or replace function public.member_visible_event_plans()
returns table (
  profile_id uuid,
  event_id uuid,
  registration_status text,
  places smallint,
  created_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  select distinct pm.profile_id,r.event_id,r.status,r.places,r.created_at
  from public.event_registrations r
  join public.profile_members pm
    on pm.user_id=r.user_id and pm.status='active'
  join public.events e on e.id=r.event_id
  where auth.uid() is not null
    and r.status in ('pending','confirmed','waitlisted','checked_in')
    and e.visibility='published'
    and (r.visible_to_participants or public.is_profile_member(pm.profile_id))
    and public.can_view_profile(pm.profile_id);
$$;
revoke all on function public.member_visible_event_plans() from public;
grant execute on function public.member_visible_event_plans() to authenticated;

alter table public.member_profiles
  add column if not exists lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active','paused','deletion_pending')),
  add column if not exists visibility_before_lifecycle text;

create table if not exists public.profile_lifecycle_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  action_type text not null check (action_type in ('pause','delete')),
  requested_by uuid not null references public.accounts(user_id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','executed')),
  previous_visibility text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  execute_after timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists profile_lifecycle_one_pending_idx
  on public.profile_lifecycle_actions(profile_id)
  where status in ('pending','confirmed');

create table if not exists public.profile_lifecycle_confirmations (
  action_id uuid not null references public.profile_lifecycle_actions(id) on delete cascade,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash)=64),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  email_sent_at timestamptz,
  primary key(action_id,user_id)
);
alter table public.profile_lifecycle_actions enable row level security;
alter table public.profile_lifecycle_confirmations enable row level security;
drop policy if exists profile_lifecycle_actions_members_read on public.profile_lifecycle_actions;
create policy profile_lifecycle_actions_members_read
on public.profile_lifecycle_actions for select to authenticated
using (public.is_profile_member(profile_id) or public.is_control_user());
drop policy if exists profile_lifecycle_confirmations_self_read on public.profile_lifecycle_confirmations;
create policy profile_lifecycle_confirmations_self_read
on public.profile_lifecycle_confirmations for select to authenticated
using (
  user_id=auth.uid()
  or exists (
    select 1 from public.profile_lifecycle_actions action
    where action.id=action_id and public.is_profile_member(action.profile_id)
  )
  or public.is_control_user()
);
grant select on public.profile_lifecycle_actions,public.profile_lifecycle_confirmations to authenticated;

create or replace function public.profile_lifecycle_recipients()
returns table(profile_id uuid,user_id uuid,email text)
language sql stable security definer set search_path=''
as $$
  select pm.profile_id,pm.user_id,u.email::text
  from public.profile_members pm
  join auth.users u on u.id=pm.user_id
  where pm.profile_id=public.current_member_profile_id()
    and pm.status='active'
    and u.email is not null;
$$;

create or replace function public.request_profile_lifecycle_action(
  target_action text,
  confirmation_rows jsonb
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  target_profile uuid;
  saved_action uuid;
  expected_count integer;
  supplied_count integer;
  previous_value text;
begin
  target_profile := public.current_member_profile_id();
  if auth.uid() is null or target_profile is null then
    raise exception 'member_profile_required';
  end if;
  if target_action not in ('pause','delete') then
    raise exception 'invalid_lifecycle_action';
  end if;
  if exists (
    select 1 from public.profile_lifecycle_actions
    where profile_id=target_profile and status in ('pending','confirmed')
  ) then
    raise exception 'lifecycle_action_already_pending';
  end if;
  select count(*) into expected_count
  from public.profile_members
  where profile_id=target_profile and status='active';
  select count(*) into supplied_count
  from jsonb_to_recordset(confirmation_rows)
    as item(user_id uuid,token_hash text);
  if supplied_count<>expected_count or exists (
    select 1
    from public.profile_members pm
    where pm.profile_id=target_profile and pm.status='active'
      and not exists (
        select 1 from jsonb_to_recordset(confirmation_rows)
          as item(user_id uuid,token_hash text)
        where item.user_id=pm.user_id
          and item.token_hash~'^[0-9a-f]{64}$'
      )
  ) then
    raise exception 'lifecycle_confirmation_mismatch';
  end if;

  select visibility into previous_value
  from public.member_profiles where id=target_profile for update;
  insert into public.profile_lifecycle_actions(
    profile_id,action_type,requested_by,previous_visibility
  ) values (
    target_profile,target_action,auth.uid(),previous_value
  ) returning id into saved_action;
  insert into public.profile_lifecycle_confirmations(
    action_id,user_id,token_hash,expires_at
  )
  select saved_action,item.user_id,item.token_hash,now()+interval '48 hours'
  from jsonb_to_recordset(confirmation_rows)
    as item(user_id uuid,token_hash text);
  return saved_action;
end;
$$;

create or replace function public.confirm_profile_lifecycle_action(
  target_token_hash text
)
returns table(action_type text,action_status text,waiting_for integer,execute_after timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
  target_action public.profile_lifecycle_actions;
  remaining integer;
begin
  select action.* into target_action
  from public.profile_lifecycle_actions action
  join public.profile_lifecycle_confirmations confirmation
    on confirmation.action_id=action.id
  where confirmation.token_hash=target_token_hash
    and confirmation.confirmed_at is null
    and confirmation.expires_at>now()
    and action.status='pending'
  for update of action;
  if target_action.id is null then raise exception 'lifecycle_confirmation_invalid'; end if;

  update public.profile_lifecycle_confirmations
  set confirmed_at=now()
  where action_id=target_action.id and token_hash=target_token_hash;
  select count(*) into remaining
  from public.profile_lifecycle_confirmations
  where action_id=target_action.id and confirmed_at is null;

  if remaining=0 then
    if target_action.action_type='pause' then
      update public.member_profiles
      set lifecycle_state='paused',
          visibility_before_lifecycle=target_action.previous_visibility,
          visibility='private',
          updated_at=now()
      where id=target_action.profile_id;
      update public.profile_lifecycle_actions
      set status='executed',confirmed_at=now(),completed_at=now()
      where id=target_action.id;
    else
      update public.member_profiles
      set lifecycle_state='deletion_pending',
          visibility_before_lifecycle=target_action.previous_visibility,
          visibility='private',
          updated_at=now()
      where id=target_action.profile_id;
      update public.profile_lifecycle_actions
      set status='confirmed',confirmed_at=now(),execute_after=now()+interval '30 days'
      where id=target_action.id;
    end if;
  end if;
  return query
  select target_action.action_type,
    case when remaining=0 then
      case when target_action.action_type='pause' then 'executed' else 'confirmed' end
    else 'pending' end,
    remaining,
    case when remaining=0 and target_action.action_type='delete'
      then now()+interval '30 days' else null end;
end;
$$;

create or replace function public.cancel_my_profile_lifecycle()
returns void
language plpgsql security definer set search_path=''
as $$
declare
  target_profile uuid;
  target_action public.profile_lifecycle_actions;
begin
  target_profile := public.current_member_profile_id();
  if target_profile is null then raise exception 'member_profile_required'; end if;
  select * into target_action
  from public.profile_lifecycle_actions
  where profile_id=target_profile and status in ('pending','confirmed')
  order by requested_at desc limit 1 for update;
  if target_action.id is null then
    select id,visibility_before_lifecycle into target_profile,target_action.previous_visibility
    from public.member_profiles
    where id=target_profile and lifecycle_state='paused';
  else
    update public.profile_lifecycle_actions
    set status='cancelled',completed_at=now()
    where id=target_action.id;
  end if;
  update public.member_profiles
  set lifecycle_state='active',
      visibility=coalesce(
        nullif(target_action.previous_visibility,''),
        nullif(visibility_before_lifecycle,''),
        'beta_members'
      ),
      visibility_before_lifecycle=null,
      updated_at=now()
  where id=target_profile;
end;
$$;

create or replace function public.purge_expired_profile_deletions()
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  action_row record;
  account_id uuid;
  account_ids uuid[];
  purged integer := 0;
begin
  for action_row in
    select id,profile_id
    from public.profile_lifecycle_actions
    where action_type='delete'
      and status='confirmed'
      and execute_after<=now()
    for update skip locked
  loop
    select array_agg(user_id) into account_ids
    from public.profile_members
    where profile_id=action_row.profile_id and status='active';

    delete from public.reports
    where subject_type='profile' and subject_id=action_row.profile_id;
    delete from public.member_profiles where id=action_row.profile_id;

    foreach account_id in array coalesce(account_ids,'{}'::uuid[])
    loop
      delete from public.messages where sender_user_id=account_id;
      delete from public.conversations where created_by=account_id;
      delete from public.events where created_by=account_id;
      delete from public.reports where reporter_user_id=account_id;
      delete from public.establishment_drafts where updated_by=account_id;
      delete from auth.users target
      where target.id=account_id
        and not exists (
          select 1 from public.profile_members remaining
          where remaining.user_id=account_id and remaining.status='active'
        );
    end loop;
    purged := purged+1;
  end loop;
  return purged;
end;
$$;

revoke all on function public.profile_lifecycle_recipients() from public;
revoke all on function public.request_profile_lifecycle_action(text,jsonb) from public;
revoke all on function public.confirm_profile_lifecycle_action(text) from public;
revoke all on function public.cancel_my_profile_lifecycle() from public;
revoke all on function public.purge_expired_profile_deletions() from public;
grant execute on function public.profile_lifecycle_recipients() to authenticated;
grant execute on function public.request_profile_lifecycle_action(text,jsonb) to authenticated;
grant execute on function public.confirm_profile_lifecycle_action(text) to anon,authenticated;
grant execute on function public.cancel_my_profile_lifecycle() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if not exists (
      select 1 from cron.job where jobname='velvet-purge-expired-profile-deletions'
    ) then
      perform cron.schedule(
        'velvet-purge-expired-profile-deletions',
        '17 * * * *',
        'select public.purge_expired_profile_deletions();'
      );
    end if;
  end if;
end
$$;
