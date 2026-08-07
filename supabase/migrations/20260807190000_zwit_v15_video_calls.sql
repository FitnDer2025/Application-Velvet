-- Zwit v1.5 — Priorité capitale #5
-- Appels vidéo directs : signalisation privée, conversation acceptée, TTL court.

create table if not exists public.conversation_video_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  started_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'ringing' check (status in ('ringing','active','declined','ended','missed')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

create index if not exists conversation_video_calls_conversation_idx
  on public.conversation_video_calls (conversation_id, created_at desc);
create index if not exists conversation_video_calls_active_idx
  on public.conversation_video_calls (expires_at)
  where status in ('ringing','active');

create table if not exists public.conversation_video_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.conversation_video_calls(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_video_signals_call_idx
  on public.conversation_video_signals (call_id, id asc);

alter table public.conversation_video_calls enable row level security;
alter table public.conversation_video_signals enable row level security;
revoke all on table public.conversation_video_calls from anon, authenticated;
revoke all on table public.conversation_video_signals from anon, authenticated;

create or replace function public.zwit_v15_video_call_access(target_conversation_id uuid)
returns table (peer_user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_peer uuid;
  v_count integer;
  v_request_status text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select count(*)::integer into v_count
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id and cm.left_at is null;
  select cm.user_id into v_peer
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.left_at is null
    and cm.user_id <> v_user_id
  limit 1;
  if v_count <> 2 or v_peer is null or not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id and cm.user_id = v_user_id and cm.left_at is null
  ) then raise exception 'direct_conversation_required'; end if;

  select cr.status into v_request_status
  from public.conversation_requests cr
  where cr.conversation_id = target_conversation_id;
  if v_request_status is not null and v_request_status <> 'accepted' then
    raise exception 'conversation_acceptance_required';
  end if;
  return query select v_peer;
end;
$$;

create or replace function public.zwit_v15_start_video_call(target_conversation_id uuid)
returns table (call_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.conversation_video_calls%rowtype;
begin
  perform public.zwit_v15_video_call_access(target_conversation_id);

  update public.conversation_video_calls c
  set status='missed', ended_at=now()
  where c.conversation_id=target_conversation_id
    and c.status='ringing' and c.expires_at <= now();

  select * into v_call
  from public.conversation_video_calls c
  where c.conversation_id=target_conversation_id
    and c.status in ('ringing','active') and c.expires_at > now()
  order by c.created_at desc limit 1 for update;

  if not found then
    insert into public.conversation_video_calls(conversation_id,started_by_user_id)
    values(target_conversation_id,v_user_id)
    returning * into v_call;
  end if;

  return query select v_call.id,v_call.status,v_call.expires_at;
end;
$$;

create or replace function public.zwit_v15_video_call_action(target_call_id uuid, action text)
returns table (call_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.conversation_video_calls%rowtype;
  v_peer uuid;
begin
  select * into v_call from public.conversation_video_calls c where c.id=target_call_id for update;
  if not found then raise exception 'video_call_not_found'; end if;
  select peer_user_id into v_peer from public.zwit_v15_video_call_access(v_call.conversation_id);
  if action='accept' then
    if v_call.status <> 'ringing' or v_call.started_by_user_id = v_user_id or v_call.expires_at <= now() then
      raise exception 'video_call_not_acceptable';
    end if;
    update public.conversation_video_calls c set status='active',accepted_by_user_id=v_user_id,
      accepted_at=now(),expires_at=now()+interval '2 hours' where c.id=target_call_id returning * into v_call;
  elsif action='decline' then
    if v_call.status <> 'ringing' or v_call.started_by_user_id = v_user_id then raise exception 'video_call_not_declineable'; end if;
    update public.conversation_video_calls c set status='declined',ended_at=now() where c.id=target_call_id returning * into v_call;
  elsif action='end' then
    if v_call.status not in ('ringing','active') then raise exception 'video_call_already_ended'; end if;
    update public.conversation_video_calls c set status='ended',ended_at=now() where c.id=target_call_id returning * into v_call;
  else raise exception 'invalid_video_call_action'; end if;
  return query select v_call.id,v_call.status,v_call.expires_at;
end;
$$;

create or replace function public.zwit_v15_video_call_signal(target_call_id uuid,target_kind text,target_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.conversation_video_calls%rowtype;
  v_id bigint;
begin
  if target_kind not in ('offer','answer','ice') then raise exception 'invalid_video_signal'; end if;
  if pg_column_size(target_payload) > 65536 then raise exception 'video_signal_too_large'; end if;
  select * into v_call from public.conversation_video_calls c where c.id=target_call_id;
  if not found or v_call.status not in ('ringing','active') or v_call.expires_at <= now() then raise exception 'video_call_inactive'; end if;
  perform public.zwit_v15_video_call_access(v_call.conversation_id);
  insert into public.conversation_video_signals(call_id,sender_user_id,kind,payload)
  values(target_call_id,v_user_id,target_kind,target_payload) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.zwit_v15_video_call_state(target_conversation_id uuid,after_signal_id bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.conversation_video_calls%rowtype;
  v_peer uuid;
  v_signals jsonb := '[]'::jsonb;
begin
  select peer_user_id into v_peer from public.zwit_v15_video_call_access(target_conversation_id);
  update public.conversation_video_calls c set status='missed',ended_at=now()
   where c.conversation_id=target_conversation_id and c.status='ringing' and c.expires_at<=now();
  select * into v_call from public.conversation_video_calls c
   where c.conversation_id=target_conversation_id and c.status in ('ringing','active') and c.expires_at>now()
   order by c.created_at desc limit 1;
  if not found then return jsonb_build_object('call',null,'signals','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'payload',s.payload,'createdAt',s.created_at) order by s.id),'[]'::jsonb)
    into v_signals from public.conversation_video_signals s
    where s.call_id=v_call.id and s.id>greatest(after_signal_id,0) and s.sender_user_id<>v_user_id;
  return jsonb_build_object('call',jsonb_build_object('id',v_call.id,'status',v_call.status,'incoming',v_call.started_by_user_id<>v_user_id,'expiresAt',v_call.expires_at),'signals',v_signals);
end;
$$;

revoke all on function public.zwit_v15_video_call_access(uuid) from public;
revoke all on function public.zwit_v15_start_video_call(uuid) from public;
revoke all on function public.zwit_v15_video_call_action(uuid,text) from public;
revoke all on function public.zwit_v15_video_call_signal(uuid,text,jsonb) from public;
revoke all on function public.zwit_v15_video_call_state(uuid,bigint) from public;
grant execute on function public.zwit_v15_video_call_access(uuid) to authenticated;
grant execute on function public.zwit_v15_start_video_call(uuid) to authenticated;
grant execute on function public.zwit_v15_video_call_action(uuid,text) to authenticated;
grant execute on function public.zwit_v15_video_call_signal(uuid,text,jsonb) to authenticated;
grant execute on function public.zwit_v15_video_call_state(uuid,bigint) to authenticated;
