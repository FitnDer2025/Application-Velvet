-- Velvet BETA — premier workspace Velvet Pro réellement connecté.

alter table public.events
  add column if not exists price_cents integer not null default 0
    check (price_cents between 0 and 10000000),
  add column if not exists currency text not null default 'EUR'
    check (currency in ('EUR')),
  add column if not exists registration_open boolean not null default true,
  add column if not exists dress_code text
    check (dress_code is null or char_length(dress_code) <= 300);

create table if not exists public.establishment_drafts (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.accounts(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.establishment_drafts enable row level security;

create policy establishment_drafts_staff
on public.establishment_drafts
for all to authenticated
using (public.is_venue_staff(establishment_id))
with check (public.is_venue_staff(establishment_id) and updated_by=auth.uid());

grant select,insert,update,delete on public.establishment_drafts to authenticated;

drop policy if exists registrations_self_read on public.event_registrations;
create policy registrations_self_read on public.event_registrations
for select to authenticated using (
  user_id=auth.uid()
  or exists (
    select 1 from public.events e
    where e.id=event_id
      and (e.created_by=auth.uid() or public.is_venue_staff(e.establishment_id))
  )
  or public.is_control_user()
);

drop policy if exists registrations_self_update on public.event_registrations;
create policy registrations_self_update on public.event_registrations
for update to authenticated using (
  user_id=auth.uid()
  or exists (
    select 1 from public.events e
    where e.id=event_id
      and (e.created_by=auth.uid() or public.is_venue_staff(e.establishment_id))
  )
  or public.is_control_user()
)
with check (
  user_id=auth.uid()
  or exists (
    select 1 from public.events e
    where e.id=event_id
      and (e.created_by=auth.uid() or public.is_venue_staff(e.establishment_id))
  )
  or public.is_control_user()
);

create or replace function public.pro_workspace_participants(target_establishment uuid)
returns table (
  registration_id uuid,
  event_id uuid,
  user_id uuid,
  places smallint,
  registration_status text,
  visible_to_participants boolean,
  registered_at timestamptz,
  profile_id uuid,
  display_name text,
  profile_type text,
  location_zone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_venue_staff(target_establishment) then
    raise exception 'pro_venue_access_required';
  end if;
  return query
  select r.id,r.event_id,r.user_id,r.places,r.status,r.visible_to_participants,r.created_at,
         p.id,p.display_name,p.profile_type,p.location_zone
  from public.event_registrations r
  join public.events e on e.id=r.event_id and e.establishment_id=target_establishment
  left join lateral (
    select mp.id,mp.display_name,mp.profile_type,mp.location_zone
    from public.profile_members pm
    join public.member_profiles mp on mp.id=pm.profile_id
    where pm.user_id=r.user_id and pm.status='active'
    limit 1
  ) p on true
  order by r.created_at desc;
end;
$$;

grant execute on function public.pro_workspace_participants(uuid) to authenticated;
