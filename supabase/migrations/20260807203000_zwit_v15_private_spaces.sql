-- Zwit v1.5 — Priorité capitale #7
-- Espaces privés : cercles choisis et chats de soirées confirmées.

create table if not exists public.community_spaces (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('circle','event')),
  title text not null check (char_length(title) between 1 and 80),
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  closes_at timestamptz,
  constraint community_space_event_link check (
    (kind='event' and event_id is not null) or (kind='circle' and event_id is null)
  )
);

create unique index if not exists community_spaces_one_per_event_idx
  on public.community_spaces(event_id) where kind='event' and archived_at is null;

create table if not exists public.community_space_members (
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  status text not null default 'invited' check (status in ('invited','active','left','removed')),
  invited_by_user_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  left_at timestamptz,
  muted boolean not null default false,
  last_read_at timestamptz,
  primary key(space_id,user_id)
);

create index if not exists community_space_members_user_idx
  on public.community_space_members(user_id,status,joined_at desc);

create table if not exists public.community_space_messages (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists community_space_messages_feed_idx
  on public.community_space_messages(space_id,id desc)
  where deleted_at is null;

create table if not exists public.community_space_reports (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  message_id bigint references public.community_space_messages(id) on delete set null,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 500),
  created_at timestamptz not null default now(),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed'))
);

alter table public.community_spaces enable row level security;
alter table public.community_space_members enable row level security;
alter table public.community_space_messages enable row level security;
alter table public.community_space_reports enable row level security;
revoke all on table public.community_spaces from anon,authenticated;
revoke all on table public.community_space_members from anon,authenticated;
revoke all on table public.community_space_messages from anon,authenticated;
revoke all on table public.community_space_reports from anon,authenticated;

create or replace function public.zwit_v15_create_circle(target_title text,target_description text default null)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if char_length(trim(coalesce(target_title,''))) not between 1 and 80 then raise exception 'invalid_circle_title'; end if;
  if char_length(coalesce(target_description,'')) > 500 then raise exception 'circle_description_too_long'; end if;
  insert into public.community_spaces(kind,title,description,owner_user_id)
  values('circle',trim(target_title),nullif(trim(coalesce(target_description,'')),''),v_user_id)
  returning id into v_id;
  insert into public.community_space_members(space_id,user_id,role,status,invited_by_user_id,joined_at)
  values(v_id,v_user_id,'owner','active',v_user_id,now());
  return v_id;
end;
$$;

create or replace function public.zwit_v15_invite_circle_profile(target_space_id uuid,target_profile_id uuid)
returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid();
  v_count integer:=0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists(
    select 1 from public.community_space_members sm join public.community_spaces s on s.id=sm.space_id
    where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='active'
      and sm.role in ('owner','moderator') and s.kind='circle' and s.archived_at is null
  ) then raise exception 'circle_invite_permission_required'; end if;

  insert into public.community_space_members(space_id,user_id,role,status,invited_by_user_id)
  select target_space_id,pm.user_id,'member','invited',v_user_id
  from public.profile_members pm
  where pm.profile_id=target_profile_id and pm.status='active' and pm.user_id<>v_user_id
  on conflict(space_id,user_id) do update
    set status=case when community_space_members.status in ('left','removed') then 'invited' else community_space_members.status end,
        invited_by_user_id=excluded.invited_by_user_id,
        invited_at=now(),left_at=null;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'invite_profile_not_found'; end if;
  return v_count;
end;
$$;

create or replace function public.zwit_v15_accept_space_invite(target_space_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  update public.community_space_members sm
  set status='active',joined_at=coalesce(joined_at,now()),left_at=null
  where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='invited';
  if not found then raise exception 'space_invite_not_found'; end if;
  return true;
end;
$$;

create or replace function public.zwit_v15_event_chat(target_event_id uuid)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid();
  v_event public.events%rowtype;
  v_space_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_event from public.events e where e.id=target_event_id;
  if not found then raise exception 'event_not_found'; end if;
  if not exists(
    select 1 from public.event_registrations r
    where r.event_id=target_event_id and r.user_id=v_user_id and r.status in ('confirmed','checked_in')
  ) then raise exception 'confirmed_registration_required'; end if;
  if v_event.starts_at > now()+interval '48 hours' then raise exception 'event_chat_not_open_yet'; end if;
  if coalesce(v_event.ends_at,v_event.starts_at+interval '12 hours') < now()-interval '48 hours' then
    raise exception 'event_chat_closed';
  end if;

  select s.id into v_space_id from public.community_spaces s
  where s.kind='event' and s.event_id=target_event_id and s.archived_at is null limit 1;
  if v_space_id is null then
    begin
      insert into public.community_spaces(kind,title,event_id,closes_at)
      values('event',left(v_event.title,80),target_event_id,coalesce(v_event.ends_at,v_event.starts_at+interval '12 hours')+interval '48 hours')
      returning id into v_space_id;
    exception when unique_violation then
      select s.id into v_space_id from public.community_spaces s
      where s.kind='event' and s.event_id=target_event_id and s.archived_at is null limit 1;
    end;
  end if;
  insert into public.community_space_members(space_id,user_id,role,status,joined_at)
  values(v_space_id,v_user_id,'member','active',now())
  on conflict(space_id,user_id) do update set status='active',joined_at=coalesce(community_space_members.joined_at,now()),left_at=null;
  return v_space_id;
end;
$$;

create or replace function public.zwit_v15_send_space_message(target_space_id uuid,target_body text)
returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid();
  v_space public.community_spaces%rowtype;
  v_id bigint;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if char_length(trim(coalesce(target_body,''))) not between 1 and 4000 then raise exception 'invalid_space_message'; end if;
  select * into v_space from public.community_spaces s where s.id=target_space_id and s.archived_at is null;
  if not found then raise exception 'space_not_found'; end if;
  if v_space.closes_at is not null and v_space.closes_at<=now() then raise exception 'space_closed'; end if;
  if not exists(select 1 from public.community_space_members sm where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='active') then
    raise exception 'space_membership_required';
  end if;
  insert into public.community_space_messages(space_id,sender_user_id,body)
  values(target_space_id,v_user_id,trim(target_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.zwit_v15_leave_space(target_space_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user_id uuid:=auth.uid();
  v_role text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select sm.role into v_role from public.community_space_members sm where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='active';
  if v_role='owner' then raise exception 'circle_owner_cannot_leave'; end if;
  update public.community_space_members sm set status='left',left_at=now() where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status in ('active','invited');
  if not found then raise exception 'space_membership_not_found'; end if;
  return true;
end;
$$;

create or replace function public.zwit_v15_report_space_message(target_space_id uuid,target_message_id bigint,target_reason text)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if char_length(trim(coalesce(target_reason,''))) not between 2 and 500 then raise exception 'invalid_report_reason'; end if;
  if not exists(select 1 from public.community_space_members sm where sm.space_id=target_space_id and sm.user_id=v_user_id and sm.status='active') then raise exception 'space_membership_required'; end if;
  if not exists(select 1 from public.community_space_messages m where m.id=target_message_id and m.space_id=target_space_id and m.deleted_at is null) then raise exception 'space_message_not_found'; end if;
  insert into public.community_space_reports(space_id,message_id,reporter_user_id,reason)
  values(target_space_id,target_message_id,v_user_id,trim(target_reason)) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.zwit_v15_create_circle(text,text) from public;
revoke all on function public.zwit_v15_invite_circle_profile(uuid,uuid) from public;
revoke all on function public.zwit_v15_accept_space_invite(uuid) from public;
revoke all on function public.zwit_v15_event_chat(uuid) from public;
revoke all on function public.zwit_v15_send_space_message(uuid,text) from public;
revoke all on function public.zwit_v15_leave_space(uuid) from public;
revoke all on function public.zwit_v15_report_space_message(uuid,bigint,text) from public;
grant execute on function public.zwit_v15_create_circle(text,text) to authenticated;
grant execute on function public.zwit_v15_invite_circle_profile(uuid,uuid) to authenticated;
grant execute on function public.zwit_v15_accept_space_invite(uuid) to authenticated;
grant execute on function public.zwit_v15_event_chat(uuid) to authenticated;
grant execute on function public.zwit_v15_send_space_message(uuid,text) to authenticated;
grant execute on function public.zwit_v15_leave_space(uuid) to authenticated;
grant execute on function public.zwit_v15_report_space_message(uuid,bigint,text) to authenticated;
