begin;

create table if not exists public.velvet_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('member', 'pro')),
  email text not null,
  email_normalized text not null,
  member_type text check (member_type is null or member_type in ('couple', 'woman', 'man', 'other')),
  business_name text,
  professional_type text check (professional_type is null or professional_type in ('club', 'spa', 'love_room', 'event_organizer', 'photographer', 'other')),
  contact_name text,
  phone text,
  location text not null,
  country_code text not null check (country_code in ('FR', 'BE')),
  wants_beta boolean not null default false,
  adult_attestation_at timestamptz not null,
  launch_consent_at timestamptz not null,
  source text not null default 'direct',
  campaign text,
  medium text,
  content text,
  referral_code text not null unique,
  referred_by uuid references public.velvet_waitlist_entries(id) on delete set null,
  status text not null default 'registered' check (status in ('registered', 'qualified', 'invited', 'converted', 'withdrawn', 'rejected')),
  invited_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audience, email_normalized),
  check (
    (audience = 'member' and member_type is not null and business_name is null and professional_type is null)
    or
    (audience = 'pro' and member_type is null and business_name is not null and professional_type is not null and contact_name is not null)
  )
);

comment on table public.velvet_waitlist_entries is
  'Préinscriptions minimisées à l’accès privé Velvet. Ne contient ni préférences intimes, ni médias, ni pièces d’identité.';

create table if not exists public.velvet_waitlist_status_history (
  id bigint generated always as identity primary key,
  waitlist_entry_id uuid not null references public.velvet_waitlist_entries(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists velvet_waitlist_created_idx
  on public.velvet_waitlist_entries (created_at desc);
create index if not exists velvet_waitlist_audience_status_idx
  on public.velvet_waitlist_entries (audience, status, created_at desc);
create index if not exists velvet_waitlist_location_idx
  on public.velvet_waitlist_entries (country_code, location);
create index if not exists velvet_waitlist_source_idx
  on public.velvet_waitlist_entries (source, campaign);

alter table public.velvet_waitlist_entries enable row level security;
alter table public.velvet_waitlist_status_history enable row level security;

revoke all on public.velvet_waitlist_entries from anon, authenticated;
revoke all on public.velvet_waitlist_status_history from anon, authenticated;

create or replace function public.touch_velvet_waitlist_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists velvet_waitlist_touch_updated_at on public.velvet_waitlist_entries;
create trigger velvet_waitlist_touch_updated_at
  before update on public.velvet_waitlist_entries
  for each row execute function public.touch_velvet_waitlist_updated_at();

create or replace function public.register_velvet_waitlist(
  p_audience text,
  p_email text,
  p_location text,
  p_country_code text,
  p_member_type text default null,
  p_business_name text default null,
  p_professional_type text default null,
  p_contact_name text default null,
  p_phone text default null,
  p_wants_beta boolean default false,
  p_adult_attestation boolean default false,
  p_launch_consent boolean default false,
  p_source text default 'direct',
  p_campaign text default null,
  p_medium text default null,
  p_content text default null,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(p_email));
  existing_entry public.velvet_waitlist_entries;
  saved_entry public.velvet_waitlist_entries;
  referrer_id uuid;
  generated_referral text;
begin
  if p_audience not in ('member', 'pro')
    or normalized_email = ''
    or position('@' in normalized_email) < 2
    or trim(coalesce(p_location, '')) = ''
    or p_country_code not in ('FR', 'BE') then
    raise exception 'invalid_waitlist_request';
  end if;
  if not p_adult_attestation then raise exception 'adult_attestation_required'; end if;
  if not p_launch_consent then raise exception 'launch_consent_required'; end if;
  if p_audience = 'member' and p_member_type not in ('couple', 'woman', 'man', 'other') then
    raise exception 'invalid_member_type';
  end if;
  if p_audience = 'pro' and (
    p_professional_type not in ('club', 'spa', 'love_room', 'event_organizer', 'photographer', 'other')
    or trim(coalesce(p_business_name, '')) = ''
    or trim(coalesce(p_contact_name, '')) = ''
  ) then
    raise exception 'invalid_professional_request';
  end if;

  select * into existing_entry
  from public.velvet_waitlist_entries
  where audience = p_audience and email_normalized = normalized_email
  limit 1;

  if existing_entry.id is not null then
    update public.velvet_waitlist_entries
    set wants_beta = wants_beta or coalesce(p_wants_beta, false),
        launch_consent_at = now(),
        adult_attestation_at = now(),
        source = coalesce(nullif(trim(p_source), ''), source),
        campaign = coalesce(nullif(trim(p_campaign), ''), campaign),
        medium = coalesce(nullif(trim(p_medium), ''), medium),
        content = coalesce(nullif(trim(p_content), ''), content)
    where id = existing_entry.id
    returning * into saved_entry;
    return jsonb_build_object('id', saved_entry.id, 'referral_code', saved_entry.referral_code, 'existing', true);
  end if;

  if nullif(trim(p_referral_code), '') is not null then
    select id into referrer_id
    from public.velvet_waitlist_entries
    where referral_code = upper(trim(p_referral_code))
    limit 1;
  end if;

  loop
    generated_referral := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (
      select 1 from public.velvet_waitlist_entries where referral_code = generated_referral
    );
  end loop;

  insert into public.velvet_waitlist_entries (
    audience, email, email_normalized, member_type, business_name, professional_type,
    contact_name, phone, location, country_code, wants_beta, adult_attestation_at,
    launch_consent_at, source, campaign, medium, content, referral_code, referred_by
  ) values (
    p_audience,
    trim(p_email),
    normalized_email,
    case when p_audience = 'member' then p_member_type else null end,
    case when p_audience = 'pro' then left(trim(p_business_name), 120) else null end,
    case when p_audience = 'pro' then p_professional_type else null end,
    case when p_audience = 'pro' then left(trim(p_contact_name), 100) else null end,
    case when p_audience = 'pro' then nullif(left(trim(p_phone), 30), '') else null end,
    left(trim(p_location), 90),
    p_country_code,
    coalesce(p_wants_beta, false),
    now(),
    now(),
    coalesce(nullif(left(trim(p_source), 80), ''), 'direct'),
    nullif(left(trim(p_campaign), 120), ''),
    nullif(left(trim(p_medium), 80), ''),
    nullif(left(trim(p_content), 120), ''),
    generated_referral,
    referrer_id
  ) returning * into saved_entry;

  return jsonb_build_object('id', saved_entry.id, 'referral_code', saved_entry.referral_code, 'existing', false);
end;
$$;

create or replace function public.control_waitlist_dashboard(
  p_audience text default null,
  p_status text default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_roles
    where user_id = auth.uid()
      and role_code in ('admin', 'direction', 'moderator', 'support', 'auditor')
  ) then
    raise exception 'control_access_required' using errcode = '42501';
  end if;

  with filtered as (
    select
      id, audience, email, member_type, business_name, professional_type, contact_name,
      phone, location, country_code, wants_beta, launch_consent_at, source, campaign,
      medium, content, referral_code, referred_by, status, invited_at, converted_at,
      created_at, updated_at
    from public.velvet_waitlist_entries
    where (p_audience is null or audience = p_audience)
      and (p_status is null or status = p_status)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or email ilike '%' || trim(p_search) || '%'
        or location ilike '%' || trim(p_search) || '%'
        or coalesce(business_name, '') ilike '%' || trim(p_search) || '%'
        or coalesce(contact_name, '') ilike '%' || trim(p_search) || '%'
      )
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 250)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  metrics as (
    select jsonb_build_object(
      'total', count(*),
      'members', count(*) filter (where audience = 'member'),
      'professionals', count(*) filter (where audience = 'pro'),
      'last7Days', count(*) filter (where created_at >= now() - interval '7 days'),
      'invited', count(*) filter (where status = 'invited'),
      'converted', count(*) filter (where status = 'converted'),
      'consented', count(*) filter (where launch_consent_at is not null),
      'betaCandidates', count(*) filter (where wants_beta)
    ) value from public.velvet_waitlist_entries
  ),
  territories as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb) value
    from (
      select location, country_code as country, count(*) total
      from public.velvet_waitlist_entries
      group by location, country_code
      order by total desc
      limit 10
    ) t
  ),
  sources as (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.total desc), '[]'::jsonb) value
    from (
      select source, coalesce(campaign, '') campaign, count(*) total
      from public.velvet_waitlist_entries
      group by source, campaign
      order by total desc
      limit 10
    ) s
  ),
  entries_json as (
    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb) value from filtered f
  )
  select jsonb_build_object(
    'metrics', metrics.value,
    'entries', entries_json.value,
    'topTerritories', territories.value,
    'topSources', sources.value
  ) into result
  from metrics, territories, sources, entries_json;

  return result;
end;
$$;

create or replace function public.control_update_waitlist_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_status text;
  saved public.velvet_waitlist_entries;
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_roles
    where user_id = auth.uid() and role_code in ('admin', 'direction')
  ) then
    raise exception 'waitlist_write_forbidden' using errcode = '42501';
  end if;
  if p_status not in ('registered', 'qualified', 'invited', 'converted', 'withdrawn', 'rejected') then
    raise exception 'invalid_waitlist_status';
  end if;

  select status into previous_status
  from public.velvet_waitlist_entries
  where id = p_id
  for update;
  if previous_status is null then raise exception 'waitlist_entry_not_found'; end if;

  update public.velvet_waitlist_entries
  set status = p_status,
      invited_at = case when p_status = 'invited' then coalesce(invited_at, now()) else invited_at end,
      converted_at = case when p_status = 'converted' then coalesce(converted_at, now()) else converted_at end
  where id = p_id
  returning * into saved;

  if previous_status is distinct from p_status then
    insert into public.velvet_waitlist_status_history(waitlist_entry_id, previous_status, new_status, changed_by)
    values (p_id, previous_status, p_status, auth.uid());
  end if;

  return jsonb_build_object('id', saved.id, 'status', saved.status, 'updated_at', saved.updated_at);
end;
$$;

revoke all on function public.register_velvet_waitlist(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,text,text,text,text,text) from public;
grant execute on function public.register_velvet_waitlist(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,text,text,text,text,text) to anon, authenticated;
revoke all on function public.control_waitlist_dashboard(text,text,text,integer,integer) from public;
grant execute on function public.control_waitlist_dashboard(text,text,text,integer,integer) to authenticated;
revoke all on function public.control_update_waitlist_status(uuid,text) from public;
grant execute on function public.control_update_waitlist_status(uuid,text) to authenticated;

commit;
