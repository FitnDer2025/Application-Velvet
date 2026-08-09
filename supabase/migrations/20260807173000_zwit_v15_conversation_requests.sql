-- Zwit v1.5 — Priorité capitale #5
-- Demandes de conversation : 1 approche + 1 relance après 24 h tant que le destinataire n'a pas accepté/répondu.
-- Les conversations historiques sans ligne ici restent ouvertes et inchangées.

create table if not exists public.conversation_requests (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  first_message_at timestamptz,
  follow_up_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint conversation_request_distinct_users check (requester_user_id <> recipient_user_id)
);

create index if not exists conversation_requests_recipient_idx
  on public.conversation_requests (recipient_user_id, status, requested_at desc);
create index if not exists conversation_requests_requester_idx
  on public.conversation_requests (requester_user_id, status, requested_at desc);

alter table public.conversation_requests enable row level security;
revoke all on table public.conversation_requests from anon, authenticated;

create or replace function public.zwit_v15_conversation_request_state(target_conversation_id uuid)
returns table (
  status text,
  role text,
  can_send boolean,
  intro_messages_sent bigint,
  follow_up_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.conversation_requests%rowtype;
  v_sent bigint := 0;
  v_role text := 'legacy';
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = v_user_id
      and cm.left_at is null
  ) then
    raise exception 'conversation_access_denied';
  end if;

  select * into v_request
  from public.conversation_requests cr
  where cr.conversation_id = target_conversation_id;

  if not found then
    return query select 'accepted'::text, 'legacy'::text, true, 0::bigint, null::timestamptz;
    return;
  end if;

  v_role := case
    when v_request.requester_user_id = v_user_id then 'requester'
    when v_request.recipient_user_id = v_user_id then 'recipient'
    else 'member'
  end;

  select count(*)::bigint into v_sent
  from public.messages m
  where m.conversation_id = target_conversation_id
    and m.sender_user_id = v_request.requester_user_id;

  return query select
    v_request.status,
    v_role,
    case
      when v_request.status = 'accepted' then true
      when v_request.status = 'declined' then false
      when v_role = 'recipient' then true
      when v_role = 'requester' and v_sent = 0 then true
      when v_role = 'requester' and v_sent = 1
        and v_request.follow_up_sent_at is null
        and coalesce(v_request.first_message_at, v_request.requested_at) <= now() - interval '24 hours' then true
      else false
    end,
    v_sent,
    case
      when v_request.status = 'pending' and v_role = 'requester' and v_sent = 1 and v_request.follow_up_sent_at is null
        then coalesce(v_request.first_message_at, v_request.requested_at) + interval '24 hours'
      else null
    end;
end;
$$;

create or replace function public.zwit_v15_ensure_conversation_request(target_conversation_id uuid)
returns table (
  status text,
  role text,
  can_send boolean,
  intro_messages_sent bigint,
  follow_up_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipient uuid;
  v_member_count integer;
  v_existing_messages bigint;
  v_request public.conversation_requests%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select count(*)::integer into v_member_count
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.left_at is null;

  select cm.user_id into v_recipient
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.left_at is null
    and cm.user_id <> v_user_id
  limit 1;

  if v_member_count <> 2 or v_recipient is null or not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = v_user_id
      and cm.left_at is null
  ) then
    raise exception 'direct_conversation_required';
  end if;

  select * into v_request
  from public.conversation_requests cr
  where cr.conversation_id = target_conversation_id
  for update;

  if not found then
    select count(*)::bigint into v_existing_messages
    from public.messages m
    where m.conversation_id = target_conversation_id;

    insert into public.conversation_requests (
      conversation_id, requester_user_id, recipient_user_id, status, accepted_at
    ) values (
      target_conversation_id,
      v_user_id,
      v_recipient,
      case when v_existing_messages > 0 then 'accepted' else 'pending' end,
      case when v_existing_messages > 0 then now() else null end
    )
    returning * into v_request;
  end if;

  return query select * from public.zwit_v15_conversation_request_state(target_conversation_id);
end;
$$;

create or replace function public.zwit_v15_decide_conversation_request(
  target_conversation_id uuid,
  decision text
)
returns table (
  status text,
  role text,
  can_send boolean,
  intro_messages_sent bigint,
  follow_up_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.conversation_requests%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if decision not in ('accepted', 'declined') then raise exception 'invalid_request_decision'; end if;

  select * into v_request
  from public.conversation_requests cr
  where cr.conversation_id = target_conversation_id
  for update;

  if not found then raise exception 'conversation_request_not_found'; end if;
  if v_request.recipient_user_id <> v_user_id then raise exception 'conversation_request_recipient_required'; end if;

  update public.conversation_requests cr
  set status = decision,
      accepted_at = case when decision = 'accepted' then coalesce(cr.accepted_at, now()) else cr.accepted_at end,
      declined_at = case when decision = 'declined' then now() else null end,
      updated_at = now()
  where cr.conversation_id = target_conversation_id;

  return query select * from public.zwit_v15_conversation_request_state(target_conversation_id);
end;
$$;

create or replace function public.zwit_v15_enforce_conversation_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.conversation_requests%rowtype;
  v_sent bigint;
begin
  select * into v_request
  from public.conversation_requests cr
  where cr.conversation_id = new.conversation_id
  for update;

  -- Conversation historique ou groupe : comportement existant conservé.
  if not found then return new; end if;
  if v_request.status = 'accepted' then return new; end if;
  if v_request.status = 'declined' then raise exception 'conversation_request_declined'; end if;

  -- Une réponse du destinataire vaut acceptation naturelle.
  if new.sender_user_id = v_request.recipient_user_id then
    update public.conversation_requests cr
    set status = 'accepted', accepted_at = coalesce(cr.accepted_at, now()), updated_at = now()
    where cr.conversation_id = new.conversation_id;
    return new;
  end if;

  if new.sender_user_id <> v_request.requester_user_id then
    raise exception 'conversation_request_sender_invalid';
  end if;

  select count(*)::bigint into v_sent
  from public.messages m
  where m.conversation_id = new.conversation_id
    and m.sender_user_id = v_request.requester_user_id;

  if v_sent = 0 then
    update public.conversation_requests cr
    set first_message_at = coalesce(cr.first_message_at, now()), updated_at = now()
    where cr.conversation_id = new.conversation_id;
    return new;
  end if;

  if v_sent = 1
     and v_request.follow_up_sent_at is null
     and coalesce(v_request.first_message_at, v_request.requested_at) <= now() - interval '24 hours' then
    update public.conversation_requests cr
    set follow_up_sent_at = now(), updated_at = now()
    where cr.conversation_id = new.conversation_id;
    return new;
  end if;

  raise exception 'conversation_request_waiting';
end;
$$;

drop trigger if exists zwit_v15_conversation_request_guard on public.messages;
create trigger zwit_v15_conversation_request_guard
  before insert on public.messages
  for each row execute function public.zwit_v15_enforce_conversation_request();

revoke all on function public.zwit_v15_ensure_conversation_request(uuid) from public;
revoke all on function public.zwit_v15_conversation_request_state(uuid) from public;
revoke all on function public.zwit_v15_decide_conversation_request(uuid, text) from public;
grant execute on function public.zwit_v15_ensure_conversation_request(uuid) to authenticated;
grant execute on function public.zwit_v15_conversation_request_state(uuid) to authenticated;
grant execute on function public.zwit_v15_decide_conversation_request(uuid, text) to authenticated;
