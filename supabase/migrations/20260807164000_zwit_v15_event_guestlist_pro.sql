-- Zwit v1.5 — Priorité capitale #3
-- Décisions organisateur atomiques : confirmation, attente, check-in et refus.

create or replace function public.zwit_v15_manage_event_registration(
  target_registration_id uuid,
  target_status text
)
returns table (
  id uuid,
  event_id uuid,
  user_id uuid,
  places integer,
  status text,
  visible_to_participants boolean,
  updated_at timestamptz,
  promoted_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_waiting public.event_registrations%rowtype;
  v_reserved bigint := 0;
  v_remaining bigint := 0;
  v_promoted integer := 0;
  v_promoted_status text;
  v_releases_capacity boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if target_status not in ('confirmed', 'waitlisted', 'checked_in', 'declined') then
    raise exception 'invalid_registration_status';
  end if;

  select r.event_id into v_event_id
  from public.event_registrations r
  where r.id = target_registration_id;

  if v_event_id is null then
    raise exception 'registration_not_found';
  end if;

  select * into v_event
  from public.events e
  where e.id = v_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if not (
    exists (
      select 1
      from public.establishment_staff es
      where es.establishment_id = v_event.establishment_id
        and es.user_id = v_user_id
        and es.status = 'active'
    )
    or exists (
      select 1
      from public.profile_members pm
      where pm.profile_id = v_event.organizer_profile_id
        and pm.user_id = v_user_id
        and pm.status = 'active'
    )
  ) then
    raise exception 'pro_event_access_required';
  end if;

  select * into v_registration
  from public.event_registrations r
  where r.id = target_registration_id
  for update;

  if v_registration.status = 'checked_in' and target_status <> 'checked_in' then
    raise exception 'checked_in_registration_locked';
  end if;

  if target_status = 'checked_in' and v_registration.status <> 'confirmed' then
    raise exception 'registration_not_confirmed';
  end if;

  if target_status = 'confirmed' then
    select coalesce(sum(r.places), 0)::bigint into v_reserved
    from public.event_registrations r
    where r.event_id = v_event_id
      and r.status in ('pending', 'confirmed', 'checked_in')
      and r.id <> target_registration_id;

    if v_event.capacity is not null
       and v_reserved + v_registration.places > v_event.capacity then
      raise exception 'event_capacity_reached';
    end if;
  end if;

  v_releases_capacity := v_registration.status in ('pending', 'confirmed')
    and target_status in ('waitlisted', 'declined');

  update public.event_registrations r
  set status = target_status,
      updated_at = now()
  where r.id = target_registration_id
  returning * into v_registration;

  if v_releases_capacity then
    v_promoted_status := case when v_event.registration_mode = 'approval' then 'pending' else 'confirmed' end;

    loop
      if v_event.capacity is null then
        v_remaining := 2147483647;
      else
        select coalesce(sum(r.places), 0)::bigint into v_reserved
        from public.event_registrations r
        where r.event_id = v_event_id
          and r.status in ('pending', 'confirmed', 'checked_in');
        v_remaining := greatest(v_event.capacity::bigint - v_reserved, 0);
      end if;

      exit when v_remaining <= 0;

      select * into v_waiting
      from public.event_registrations r
      where r.event_id = v_event_id
        and r.status = 'waitlisted'
        and r.id <> target_registration_id
      order by r.created_at asc
      limit 1
      for update skip locked;

      exit when not found;
      exit when v_waiting.places > v_remaining;

      update public.event_registrations r
      set status = v_promoted_status, updated_at = now()
      where r.id = v_waiting.id;

      v_promoted := v_promoted + 1;
    end loop;
  end if;

  return query
    select
      v_registration.id,
      v_registration.event_id,
      v_registration.user_id,
      v_registration.places,
      v_registration.status,
      v_registration.visible_to_participants,
      v_registration.updated_at,
      v_promoted;
end;
$$;

revoke all on function public.zwit_v15_manage_event_registration(uuid, text) from public;
grant execute on function public.zwit_v15_manage_event_registration(uuid, text) to authenticated;
