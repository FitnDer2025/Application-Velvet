-- Velvet BETA — actions membres réelles : conversations directes,
-- favoris/blocages et inscriptions aux sorties.

create table if not exists public.direct_conversation_profiles (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  profile_a_id uuid not null references public.member_profiles(id) on delete cascade,
  profile_b_id uuid not null references public.member_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (profile_a_id <> profile_b_id),
  unique (profile_a_id,profile_b_id)
);

alter table public.direct_conversation_profiles enable row level security;

drop policy if exists direct_conversation_profiles_members_read
  on public.direct_conversation_profiles;
create policy direct_conversation_profiles_members_read
on public.direct_conversation_profiles
for select to authenticated
using (
  public.is_conversation_member(conversation_id)
  or public.is_control_user()
);

grant select on public.direct_conversation_profiles to authenticated;

create or replace function public.start_direct_profile_conversation(
  target_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_profile_id uuid;
  profile_a uuid;
  profile_b uuid;
  conversation_id_value uuid;
  source_category text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  source_profile_id := public.current_member_profile_id();
  if source_profile_id is null then raise exception 'photo_admission_required'; end if;
  if target_profile_id is null or target_profile_id=source_profile_id then
    raise exception 'invalid_target_profile';
  end if;
  if not exists (
    select 1 from public.member_profiles mp
    where mp.id=target_profile_id
      and mp.admission_status='approved'
      and mp.visibility in ('beta_members','published')
  ) then
    raise exception 'target_profile_unavailable';
  end if;

  source_category := public.profile_audience_category(auth.uid());
  if exists (
    select 1 from public.profile_privacy_settings pps
    where pps.profile_id=target_profile_id
      and not (source_category=any(pps.contactable_by))
  ) then
    raise exception 'profile_contact_not_allowed';
  end if;
  if exists (
    select 1
    from public.profile_members target_member
    join public.blocks b
      on (
        b.blocker_user_id=auth.uid()
        and b.blocked_user_id=target_member.user_id
      ) or (
        b.blocker_user_id=target_member.user_id
        and b.blocked_user_id=auth.uid()
      )
    where target_member.profile_id=target_profile_id
      and target_member.status='active'
  ) then
    raise exception 'profile_contact_blocked';
  end if;

  if source_profile_id::text < target_profile_id::text then
    profile_a := source_profile_id;
    profile_b := target_profile_id;
  else
    profile_a := target_profile_id;
    profile_b := source_profile_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(profile_a::text || profile_b::text,0)
  );
  select dcp.conversation_id into conversation_id_value
  from public.direct_conversation_profiles dcp
  where dcp.profile_a_id=profile_a and dcp.profile_b_id=profile_b;

  if conversation_id_value is null then
    insert into public.conversations (kind,subject,created_by)
    values ('direct',null,auth.uid())
    returning id into conversation_id_value;

    insert into public.direct_conversation_profiles (
      conversation_id,profile_a_id,profile_b_id
    ) values (
      conversation_id_value,profile_a,profile_b
    );
  end if;

  insert into public.conversation_members (
    conversation_id,user_id,display_identity,left_at
  )
  select
    conversation_id_value,
    pm.user_id,
    ip.first_name,
    null
  from public.profile_members pm
  left join public.individual_profiles ip
    on ip.profile_id=pm.profile_id and ip.linked_user_id=pm.user_id
  where pm.profile_id in (source_profile_id,target_profile_id)
    and pm.status='active'
  on conflict (conversation_id,user_id) do update
    set display_identity=excluded.display_identity,left_at=null;

  return conversation_id_value;
end;
$$;

create or replace function public.register_for_event(
  target_event_id uuid,
  requested_places smallint default 1,
  show_to_participants boolean default true
)
returns table (
  registration_id uuid,
  registration_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events;
  occupied integer;
  next_status text;
  saved_id uuid;
begin
  if auth.uid() is null or public.current_member_profile_id() is null then
    raise exception 'active_member_required';
  end if;
  if requested_places < 1 or requested_places > 2 then
    raise exception 'invalid_places';
  end if;

  select * into event_row
  from public.events
  where id=target_event_id and visibility='published'
  for update;
  if event_row.id is null then raise exception 'event_unavailable'; end if;
  if event_row.starts_at <= now() then raise exception 'event_registration_closed'; end if;

  select coalesce(sum(er.places),0)::integer into occupied
  from public.event_registrations er
  where er.event_id=target_event_id
    and er.user_id<>auth.uid()
    and er.status in ('confirmed','checked_in');
  next_status := case
    when occupied+requested_places <= event_row.capacity then 'confirmed'
    else 'waitlisted'
  end;

  insert into public.event_registrations (
    event_id,user_id,places,status,visible_to_participants
  ) values (
    target_event_id,auth.uid(),requested_places,next_status,show_to_participants
  )
  on conflict (event_id,user_id) do update set
    places=excluded.places,
    status=excluded.status,
    visible_to_participants=excluded.visible_to_participants,
    updated_at=now()
  returning id into saved_id;

  return query select saved_id,next_status;
end;
$$;

create or replace function public.cancel_my_event_registration(
  target_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  update public.event_registrations
  set status='cancelled',updated_at=now()
  where event_id=target_event_id and user_id=auth.uid();
end;
$$;

create or replace function public.is_registered_for_event(
  target_event_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_registrations er
    where er.event_id=target_event_id
      and er.user_id=target_user_id
      and er.status in ('pending','confirmed','waitlisted','checked_in')
  );
$$;

drop policy if exists registrations_self_read on public.event_registrations;
create policy registrations_participant_read on public.event_registrations
for select to authenticated using (
  user_id=auth.uid()
  or exists (
    select 1 from public.events e
    where e.id=event_id and e.created_by=auth.uid()
  )
  or (
    visible_to_participants
    and public.is_registered_for_event(event_id,auth.uid())
  )
  or public.is_control_user()
);

revoke all on function public.start_direct_profile_conversation(uuid) from public;
revoke all on function public.register_for_event(uuid,smallint,boolean) from public;
revoke all on function public.cancel_my_event_registration(uuid) from public;
revoke all on function public.is_registered_for_event(uuid,uuid) from public;
grant execute on function public.start_direct_profile_conversation(uuid) to authenticated;
grant execute on function public.register_for_event(uuid,smallint,boolean) to authenticated;
grant execute on function public.cancel_my_event_registration(uuid) to authenticated;
grant execute on function public.is_registered_for_event(uuid,uuid) to authenticated;
