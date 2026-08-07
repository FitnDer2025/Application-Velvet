-- Zwit v1.5 — Priorité capitale #3
-- Réservation, capacité, liste d'attente et promotion automatique.
-- Migration additive : les événements existants restent sans limite tant qu'aucune capacité n'est configurée.

alter table if exists public.events
  add column if not exists capacity_places integer,
  add column if not exists registration_mode text not null default 'instant',
  add column if not exists registration_closes_at timestamptz,
  add column if not exists max_places_per_registration integer not null default 4,
  add column if not exists guest_list_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_capacity_places_positive'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_capacity_places_positive
      check (capacity_places is null or capacity_places > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'events_registration_mode_valid'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_registration_mode_valid
      check (registration_mode in ('instant', 'approval', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'events_max_places_per_registration_valid'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_max_places_per_registration_valid
      check (max_places_per_registration between 1 and 12);
  end if;
end $$;

create index if not exists event_registrations_event_queue_idx
  on public.event_registrations (event_id, status, created_at);

create or replace function public.zwit_v15_event_booking_state(target_event_id uuid)
returns table (
  capacity_places integer,
  occupied_places bigint,
  pending_places bigint,
  waitlisted_places bigint,
  places_remaining bigint,
  registration_mode text,
  registration_closes_at timestamptz,
  max_places_per_registration integer,
  guest_list_enabled boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    e.capacity_places,
    coalesce(sum(r.places) filter (where r.status in ('confirmed', 'checked_in')), 0)::bigint as occupied_places,
    coalesce(sum(r.places) filter (where r.status = 'pending'), 0)::bigint as pending_places,
    coalesce(sum(r.places) filter (where r.status = 'waitlisted'), 0)::bigint as waitlisted_places,
    case
      when e.capacity_places is null then null
      else greatest(
        e.capacity_places::bigint
          - coalesce(sum(r.places) filter (where r.status in ('pending', 'confirmed', 'checked_in')), 0)::bigint,
        0
      )
    end as places_remaining,
    e.registration_mode,
    e.registration_closes_at,
    e.max_places_per_registration,
    e.guest_list_enabled
  from public.events e
  left join public.event_registrations r on r.event_id = e.id
  where e.id = target_event_id
  group by e.id;
$$;

create or replace function public.zwit_v15_register_for_event(
  target_event_id uuid,
  requested_places integer default 1,
  show_to_participants boolean default true
)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  places integer,
  status text,
  visible_to_participants boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_reserved bigint := 0;
  v_next_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_event
  from public.events
  where public.events.id = target_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if coalesce(v_event.published, false) is not true then
    raise exception 'event_not_available';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'event_already_started';
  end if;

  if v_event.registration_mode = 'closed'
     or (v_event.registration_closes_at is not null and v_event.registration_closes_at <= now()) then
    raise exception 'registrations_closed';
  end if;

  if requested_places is null
     or requested_places < 1
     or requested_places > coalesce(v_event.max_places_per_registration, 4) then
    raise exception 'invalid_places';
  end if;

  select * into v_registration
  from public.event_registrations r
  where r.event_id = target_event_id
    and r.user_id = v_user_id
  order by r.created_at desc
  limit 1
  for update;

  select coalesce(sum(r.places), 0)::bigint into v_reserved
  from public.event_registrations r
  where r.event_id = target_event_id
    and r.status in ('pending', 'confirmed', 'checked_in')
    and (v_registration.id is null or r.id <> v_registration.id);

  if v_event.capacity_places is not null
     and v_reserved + requested_places > v_event.capacity_places then
    v_next_status := 'waitlisted';
  elsif v_event.registration_mode = 'approval' then
    v_next_status := 'pending';
  else
    v_next_status := 'confirmed';
  end if;

  if v_registration.id is null then
    insert into public.event_registrations (
      event_id, user_id, places, status, visible_to_participants
    ) values (
      target_event_id, v_user_id, requested_places, v_next_status, coalesce(show_to_participants, true)
    )
    returning * into v_registration;
  else
    update public.event_registrations r
    set places = requested_places,
        status = v_next_status,
        visible_to_participants = coalesce(show_to_participants, true),
        updated_at = now()
    where r.id = v_registration.id
    returning * into v_registration;
  end if;

  return query
    select
      v_registration.id,
      v_registration.event_id,
      v_registration.user_id,
      v_registration.places,
      v_registration.status,
      v_registration.visible_to_participants,
      v_registration.created_at,
      v_registration.updated_at;
end;
$$;

create or replace function public.zwit_v15_cancel_event_registration(target_event_id uuid)
returns table (
  cancelled boolean,
  promoted_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_waiting public.event_registrations%rowtype;
  v_reserved bigint := 0;
  v_remaining bigint;
  v_promoted integer := 0;
  v_promoted_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_event
  from public.events
  where public.events.id = target_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  update public.event_registrations r
  set status = 'cancelled', updated_at = now()
  where r.event_id = target_event_id
    and r.user_id = v_user_id
    and r.status in ('pending', 'confirmed', 'waitlisted')
  returning true into cancelled;

  cancelled := coalesce(cancelled, false);

  if not cancelled then
    promoted_count := 0;
    return next;
    return;
  end if;

  v_promoted_status := case when v_event.registration_mode = 'approval' then 'pending' else 'confirmed' end;

  loop
    if v_event.capacity_places is null then
      v_remaining := 2147483647;
    else
      select coalesce(sum(r.places), 0)::bigint into v_reserved
      from public.event_registrations r
      where r.event_id = target_event_id
        and r.status in ('pending', 'confirmed', 'checked_in');
      v_remaining := greatest(v_event.capacity_places::bigint - v_reserved, 0);
    end if;

    exit when v_remaining <= 0;

    select * into v_waiting
    from public.event_registrations r
    where r.event_id = target_event_id
      and r.status = 'waitlisted'
    order by r.created_at asc
    limit 1
    for update skip locked;

    exit when not found;
    -- Préserve l'ordre de la file : on ne double pas une réservation plus ancienne.
    exit when v_waiting.places > v_remaining;

    update public.event_registrations r
    set status = v_promoted_status, updated_at = now()
    where r.id = v_waiting.id;

    v_promoted := v_promoted + 1;
  end loop;

  promoted_count := v_promoted;
  return next;
end;
$$;

revoke all on function public.zwit_v15_event_booking_state(uuid) from public;
revoke all on function public.zwit_v15_register_for_event(uuid, integer, boolean) from public;
revoke all on function public.zwit_v15_cancel_event_registration(uuid) from public;

grant execute on function public.zwit_v15_event_booking_state(uuid) to authenticated;
grant execute on function public.zwit_v15_register_for_event(uuid, integer, boolean) to authenticated;
grant execute on function public.zwit_v15_cancel_event_registration(uuid) to authenticated;
