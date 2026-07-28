-- Velvet BETA — géolocalisation facultative et socle de vérification identité + majorité.
-- Aucune coordonnée GPS exacte, pièce d'identité, date de naissance ou identité civile
-- n'est conservée dans ces tables.

alter table public.member_profiles
  add column if not exists verification_status text not null default 'not_started';

alter table public.member_profiles
  drop constraint if exists member_profiles_verification_status_check;
alter table public.member_profiles
  add constraint member_profiles_verification_status_check
  check (verification_status in ('not_started','pending','partial','verified','failed','expired','revoked'));

create table if not exists public.member_location_settings (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  enabled boolean not null default false,
  precision_km smallint not null default 10 check (precision_km in (10,25,50)),
  latitude_bucket numeric(4,1),
  longitude_bucket numeric(5,1),
  consented_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_location_latitude_range check (latitude_bucket is null or latitude_bucket between -90 and 90),
  constraint member_location_longitude_range check (longitude_bucket is null or longitude_bucket between -180 and 180),
  constraint member_location_coordinates_pair check (
    (latitude_bucket is null and longitude_bucket is null)
    or
    (latitude_bucket is not null and longitude_bucket is not null)
  )
);

create table if not exists public.account_identity_age_verifications (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  provider text,
  status text not null default 'not_started'
    check (status in ('not_started','pending','verified','failed','expired','revoked')),
  identity_verified boolean not null default false,
  majority_verified boolean not null default false,
  provider_reference_hash text,
  verified_at timestamptz,
  expires_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_identity_and_majority_required check (
    status <> 'verified' or (identity_verified and majority_verified)
  ),
  constraint provider_reference_must_be_hashed check (
    provider_reference_hash is null or provider_reference_hash ~ '^[0-9a-f]{64}$'
  )
);

create table if not exists public.external_verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  provider text not null,
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'created'
    check (status in ('created','redirected','completed','failed','expired')),
  return_path text not null default '/membres/',
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists external_verification_sessions_user_idx
  on public.external_verification_sessions (user_id,created_at desc);

create trigger member_location_settings_updated_at
before update on public.member_location_settings
for each row execute function public.set_updated_at();

create trigger account_identity_age_verifications_updated_at
before update on public.account_identity_age_verifications
for each row execute function public.set_updated_at();

alter table public.member_location_settings enable row level security;
alter table public.account_identity_age_verifications enable row level security;
alter table public.external_verification_sessions enable row level security;

drop policy if exists member_location_self_read on public.member_location_settings;
create policy member_location_self_read on public.member_location_settings
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

drop policy if exists member_location_self_insert on public.member_location_settings;
create policy member_location_self_insert on public.member_location_settings
for insert to authenticated
with check (user_id=auth.uid());

drop policy if exists member_location_self_update on public.member_location_settings;
create policy member_location_self_update on public.member_location_settings
for update to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists member_location_self_delete on public.member_location_settings;
create policy member_location_self_delete on public.member_location_settings
for delete to authenticated
using (user_id=auth.uid());

drop policy if exists identity_age_verification_self_read on public.account_identity_age_verifications;
create policy identity_age_verification_self_read on public.account_identity_age_verifications
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

drop policy if exists external_verification_sessions_self_read on public.external_verification_sessions;
create policy external_verification_sessions_self_read on public.external_verification_sessions
for select to authenticated
using (user_id=auth.uid() or public.is_control_user());

drop policy if exists external_verification_sessions_self_insert on public.external_verification_sessions;
create policy external_verification_sessions_self_insert on public.external_verification_sessions
for insert to authenticated
with check (user_id=auth.uid());

grant select,insert,update,delete on public.member_location_settings to authenticated;
grant select on public.account_identity_age_verifications to authenticated;
grant select,insert on public.external_verification_sessions to authenticated;

create or replace function public.refresh_profile_verification(target_profile uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_members integer := 0;
  verified_members integer := 0;
  pending_members integer := 0;
  failed_members integer := 0;
  expired_members integer := 0;
  revoked_members integer := 0;
  next_status text := 'not_started';
begin
  select
    count(*),
    count(*) filter (
      where v.status='verified'
        and v.identity_verified
        and v.majority_verified
        and (v.expires_at is null or v.expires_at>now())
    ),
    count(*) filter (where v.status='pending'),
    count(*) filter (where v.status='failed'),
    count(*) filter (where v.status='expired' or (v.status='verified' and v.expires_at is not null and v.expires_at<=now())),
    count(*) filter (where v.status='revoked')
  into active_members,verified_members,pending_members,failed_members,expired_members,revoked_members
  from public.profile_members pm
  left join public.account_identity_age_verifications v on v.user_id=pm.user_id
  where pm.profile_id=target_profile and pm.status='active';

  next_status := case
    when active_members=0 then 'not_started'
    when verified_members=active_members then 'verified'
    when verified_members>0 then 'partial'
    when pending_members>0 then 'pending'
    when revoked_members>0 then 'revoked'
    when expired_members>0 then 'expired'
    when failed_members>0 then 'failed'
    else 'not_started'
  end;

  update public.member_profiles
     set verification_status=next_status
   where id=target_profile;

  return next_status;
end;
$$;

revoke all on function public.refresh_profile_verification(uuid) from public;

create or replace function public.recalculate_account_verification_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user uuid;
  target record;
begin
  affected_user := case when tg_op='DELETE' then old.user_id else new.user_id end;
  for target in
    select distinct pm.profile_id
      from public.profile_members pm
     where pm.user_id=affected_user
  loop
    perform public.refresh_profile_verification(target.profile_id);
  end loop;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists account_verification_recalculate_profiles on public.account_identity_age_verifications;
create trigger account_verification_recalculate_profiles
after insert or update or delete on public.account_identity_age_verifications
for each row execute function public.recalculate_account_verification_profiles();

create or replace function public.recalculate_membership_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_profile_verification(old.profile_id);
    return old;
  end if;
  perform public.refresh_profile_verification(new.profile_id);
  if tg_op='UPDATE' and old.profile_id<>new.profile_id then
    perform public.refresh_profile_verification(old.profile_id);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_members_recalculate_verification on public.profile_members;
create trigger profile_members_recalculate_verification
after insert or update of status,user_id,profile_id or delete on public.profile_members
for each row execute function public.recalculate_membership_verification();

-- Initialise les statuts des profils existants sans attribuer de faux badge.
do $$
declare target record;
begin
  for target in select id from public.member_profiles loop
    perform public.refresh_profile_verification(target.id);
  end loop;
end;
$$;
