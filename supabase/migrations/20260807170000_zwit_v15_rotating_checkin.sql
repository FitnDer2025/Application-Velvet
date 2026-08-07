-- Zwit v1.5 — Priorité capitale #4
-- QR tournant établissement : le secret brut n'est jamais persisté.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.event_checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  scan_count integer not null default 0,
  last_scanned_at timestamptz,
  constraint event_checkin_sessions_future_expiry check (expires_at > created_at),
  constraint event_checkin_sessions_scan_count check (scan_count >= 0)
);

create index if not exists event_checkin_sessions_event_active_idx
  on public.event_checkin_sessions (event_id, expires_at desc)
  where revoked_at is null;

alter table public.event_checkin_sessions enable row level security;
-- Pas de policy directe : lecture/écriture uniquement via les RPC security definer ci-dessous.

create or replace function public.zwit_v15_open_checkin_session(
  target_event_id uuid,
  ttl_seconds integer default 120
)
returns table (
  session_id uuid,
  event_id uuid,
  establishment_id uuid,
  event_title text,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_token text;
  v_session public.event_checkin_sessions%rowtype;
  v_ttl integer := greatest(60, least(coalesce(ttl_seconds, 120), 300));
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_event
  from public.events e
  where e.id = target_event_id
  for update;

  if not found or v_event.establishment_id is null then
    raise exception 'venue_event_required';
  end if;

  if not exists (
    select 1
    from public.establishment_staff es
    where es.establishment_id = v_event.establishment_id
      and es.user_id = v_user_id
      and es.status = 'active'
  ) then
    raise exception 'pro_event_access_required';
  end if;

  if v_event.starts_at > now() + interval '12 hours' then
    raise exception 'checkin_too_early';
  end if;

  if coalesce(v_event.ends_at, v_event.starts_at + interval '12 hours') < now() - interval '4 hours' then
    raise exception 'checkin_window_closed';
  end if;

  update public.event_checkin_sessions s
  set revoked_at = now()
  where s.event_id = target_event_id
    and s.revoked_at is null
    and s.expires_at > now();

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.event_checkin_sessions (
    event_id,
    establishment_id,
    token_hash,
    expires_at,
    created_by
  ) values (
    target_event_id,
    v_event.establishment_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(secs => v_ttl),
    v_user_id
  )
  returning * into v_session;

  return query
    select
      v_session.id,
      v_session.event_id,
      v_session.establishment_id,
      v_event.title,
      v_token,
      v_session.expires_at;
end;
$$;

create or replace function public.zwit_v15_redeem_checkin_session(target_token text)
returns table (
  event_id uuid,
  establishment_id uuid,
  event_title text,
  registration_id uuid,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_session public.event_checkin_sessions%rowtype;
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_checked_in_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if target_token is null or length(target_token) < 32 or length(target_token) > 128 then
    raise exception 'invalid_checkin_token';
  end if;

  v_hash := encode(extensions.digest(target_token, 'sha256'), 'hex');

  select * into v_session
  from public.event_checkin_sessions s
  where s.token_hash = v_hash
    and s.revoked_at is null
    and s.expires_at > now()
  limit 1
  for update;

  if not found then
    raise exception 'checkin_session_expired';
  end if;

  select * into v_event
  from public.events e
  where e.id = v_session.event_id;

  if not found or v_event.establishment_id <> v_session.establishment_id then
    raise exception 'invalid_checkin_event';
  end if;

  select * into v_registration
  from public.event_registrations r
  where r.event_id = v_session.event_id
    and r.user_id = v_user_id
    and r.status in ('confirmed', 'checked_in')
  order by r.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'confirmed_registration_required';
  end if;

  if v_registration.status <> 'checked_in' then
    update public.event_registrations r
    set status = 'checked_in', updated_at = v_checked_in_at
    where r.id = v_registration.id
    returning * into v_registration;
  else
    v_checked_in_at := coalesce(v_registration.updated_at, now());
  end if;

  update public.event_checkin_sessions s
  set scan_count = scan_count + 1,
      last_scanned_at = now()
  where s.id = v_session.id;

  return query
    select
      v_event.id,
      v_event.establishment_id,
      v_event.title,
      v_registration.id,
      v_checked_in_at;
end;
$$;

revoke all on table public.event_checkin_sessions from anon, authenticated;
revoke all on function public.zwit_v15_open_checkin_session(uuid, integer) from public;
revoke all on function public.zwit_v15_redeem_checkin_session(text) from public;

grant execute on function public.zwit_v15_open_checkin_session(uuid, integer) to authenticated;
grant execute on function public.zwit_v15_redeem_checkin_session(text) to authenticated;
