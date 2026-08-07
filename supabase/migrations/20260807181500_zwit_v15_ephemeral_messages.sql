-- Zwit v1.5 — Priorité capitale #5
-- Médias éphémères : aucune URL n'est distribuée avant une ouverture autorisée.

create table if not exists public.message_ephemeral_attachments (
  attachment_id uuid primary key references public.message_attachments(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'view_once' check (mode in ('view_once', 'expires')),
  expires_at timestamptz,
  opened_by_user_id uuid references auth.users(id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_ephemeral_expiry_required check (
    (mode = 'view_once') or (mode = 'expires' and expires_at is not null)
  )
);

create index if not exists message_ephemeral_conversation_idx
  on public.message_ephemeral_attachments (conversation_id, created_at desc);
create index if not exists message_ephemeral_expiry_idx
  on public.message_ephemeral_attachments (expires_at)
  where expires_at is not null;

alter table public.message_ephemeral_attachments enable row level security;
revoke all on table public.message_ephemeral_attachments from anon, authenticated;

create or replace function public.zwit_v15_open_ephemeral_message(target_message_id uuid)
returns table (
  attachment_id uuid,
  storage_path text,
  mime_type text,
  original_name text,
  mode text,
  expires_at timestamptz,
  opened_at timestamptz,
  sender boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_meta public.message_ephemeral_attachments%rowtype;
  v_attachment public.message_attachments%rowtype;
  v_member_count integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select count(*)::integer into v_member_count
  from public.conversation_members cm
  where cm.conversation_id = (
    select m.conversation_id from public.messages m where m.id = target_message_id
  )
    and cm.left_at is null;

  if v_member_count <> 2 then raise exception 'direct_conversation_required'; end if;

  select meta.* into v_meta
  from public.message_ephemeral_attachments meta
  where meta.message_id = target_message_id
  limit 1
  for update;

  if not found then raise exception 'ephemeral_message_not_found'; end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = v_meta.conversation_id
      and cm.user_id = v_user_id
      and cm.left_at is null
  ) then
    raise exception 'conversation_access_denied';
  end if;

  if v_meta.mode = 'expires' and v_meta.expires_at <= v_now then
    raise exception 'ephemeral_message_expired';
  end if;

  if v_user_id <> v_meta.sender_user_id and v_meta.mode = 'view_once' and v_meta.opened_at is not null then
    raise exception 'ephemeral_message_consumed';
  end if;

  if v_user_id <> v_meta.sender_user_id and v_meta.opened_at is null then
    update public.message_ephemeral_attachments meta
    set opened_by_user_id = v_user_id,
        opened_at = v_now
    where meta.attachment_id = v_meta.attachment_id
    returning meta.* into v_meta;
  end if;

  select a.* into v_attachment
  from public.message_attachments a
  where a.id = v_meta.attachment_id;

  if not found then raise exception 'ephemeral_attachment_missing'; end if;

  return query select
    v_attachment.id,
    v_attachment.storage_path,
    v_attachment.mime_type,
    v_attachment.original_name,
    v_meta.mode,
    v_meta.expires_at,
    v_meta.opened_at,
    (v_user_id = v_meta.sender_user_id);
end;
$$;

revoke all on function public.zwit_v15_open_ephemeral_message(uuid) from public;
grant execute on function public.zwit_v15_open_ephemeral_message(uuid) to authenticated;
