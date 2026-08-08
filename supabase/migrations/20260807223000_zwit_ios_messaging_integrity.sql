begin;

alter table public.message_attachments
  add column if not exists attachment_kind text not null default 'media',
  add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.message_attachments'::regclass
      and conname = 'message_attachments_kind_check'
  ) then
    alter table public.message_attachments
      add constraint message_attachments_kind_check
      check (attachment_kind in ('media', 'voice', 'ephemeral'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.message_attachments'::regclass
      and conname = 'message_attachments_duration_check'
  ) then
    alter table public.message_attachments
      add constraint message_attachments_duration_check
      check (duration_seconds is null or duration_seconds between 1 and 300);
  end if;
end $$;

create or replace function public.zwit_v15_register_message_attachment(
  target_message_id uuid,
  target_conversation_id uuid,
  target_storage_path text,
  target_media_type text,
  target_mime_type text,
  target_original_name text,
  target_size_bytes bigint,
  target_attachment_kind text default 'media',
  target_duration_seconds integer default null
)
returns table (
  id uuid,
  message_id uuid,
  conversation_id uuid,
  media_type text,
  mime_type text,
  original_name text,
  size_bytes bigint,
  storage_path text,
  attachment_kind text,
  duration_seconds integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  path_parts text[];
begin
  if caller is null then
    raise exception 'authentication_required';
  end if;
  if target_message_id is null or target_conversation_id is null then
    raise exception 'invalid_message_attachment';
  end if;
  if target_media_type not in ('image', 'video', 'document')
     or target_attachment_kind not in ('media', 'voice', 'ephemeral')
     or coalesce(target_mime_type, '') = ''
     or char_length(coalesce(target_original_name, '')) not between 1 and 240
     or target_size_bytes not between 1 and 52428800
     or (target_duration_seconds is not null and target_duration_seconds not between 1 and 300) then
    raise exception 'invalid_message_attachment';
  end if;

  if not exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
     and cm.user_id = caller
     and cm.left_at is null
    where m.id = target_message_id
      and m.conversation_id = target_conversation_id
      and m.sender_user_id = caller
      and m.deleted_at is null
  ) then
    raise exception 'conversation_access_denied';
  end if;

  path_parts := storage.foldername(target_storage_path);
  if array_length(path_parts, 1) < 4
     or lower(path_parts[1]) not in ('messages', 'messages-ephemeral')
     or lower(path_parts[2]) <> lower(target_conversation_id::text)
     or lower(path_parts[3]) <> lower(caller::text) then
    raise exception 'invalid_message_storage_path';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'velvet-media'
      and o.name = target_storage_path
      and lower(coalesce(o.owner_id::text, '')) = lower(caller::text)
  ) then
    raise exception 'message_storage_object_missing';
  end if;

  return query
  insert into public.message_attachments (
    message_id,
    conversation_id,
    uploader_user_id,
    storage_path,
    media_type,
    mime_type,
    original_name,
    size_bytes,
    attachment_kind,
    duration_seconds
  ) values (
    target_message_id,
    target_conversation_id,
    caller,
    target_storage_path,
    target_media_type,
    target_mime_type,
    target_original_name,
    target_size_bytes,
    target_attachment_kind,
    target_duration_seconds
  )
  returning
    message_attachments.id,
    message_attachments.message_id,
    message_attachments.conversation_id,
    message_attachments.media_type,
    message_attachments.mime_type,
    message_attachments.original_name,
    message_attachments.size_bytes,
    message_attachments.storage_path,
    message_attachments.attachment_kind,
    message_attachments.duration_seconds,
    message_attachments.created_at;
end;
$$;

revoke all on function public.zwit_v15_register_message_attachment(uuid, uuid, text, text, text, text, bigint, text, integer) from public;
revoke all on function public.zwit_v15_register_message_attachment(uuid, uuid, text, text, text, text, bigint, text, integer) from anon;
grant execute on function public.zwit_v15_register_message_attachment(uuid, uuid, text, text, text, text, bigint, text, integer) to authenticated;

drop policy if exists velvet_media_ephemeral_insert on storage.objects;
create policy velvet_media_ephemeral_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'velvet-media'
    and lower((storage.foldername(name))[1]) = 'messages-ephemeral'
    and lower((storage.foldername(name))[3]) = lower(auth.uid()::text)
    and public.is_conversation_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists velvet_media_ephemeral_delete on storage.objects;
create policy velvet_media_ephemeral_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'velvet-media'
    and lower((storage.foldername(name))[1]) = 'messages-ephemeral'
    and lower((storage.foldername(name))[3]) = lower(auth.uid()::text)
  );

drop policy if exists velvet_media_ephemeral_read on storage.objects;
create policy velvet_media_ephemeral_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'velvet-media'
    and lower((storage.foldername(name))[1]) = 'messages-ephemeral'
    and exists (
      select 1
      from public.message_attachments attachment
      join public.message_ephemeral_attachments ephemeral
        on ephemeral.attachment_id = attachment.id
      where attachment.storage_path = storage.objects.name
        and ephemeral.expires_at > now()
        and public.is_conversation_member(attachment.conversation_id)
    )
  );

commit;
