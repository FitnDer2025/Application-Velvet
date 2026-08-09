create or replace function public.can_read_ephemeral_media(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.message_attachments attachment
    join public.message_ephemeral_attachments ephemeral
      on ephemeral.attachment_id = attachment.id
    where attachment.storage_path = target_path
      and ephemeral.expires_at > current_timestamp
      and public.is_conversation_member(attachment.conversation_id)
      and (
        ephemeral.sender_user_id = auth.uid()
        or (
          ephemeral.opened_by_user_id = auth.uid()
          and ephemeral.opened_at is not null
        )
      )
  )
$$;

revoke all on function public.can_read_ephemeral_media(text) from public;
grant execute on function public.can_read_ephemeral_media(text) to authenticated, service_role;

drop policy if exists velvet_media_ephemeral_read on storage.objects;

create policy velvet_media_ephemeral_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'velvet-media'
  and lower((storage.foldername(name))[1]) = 'messages-ephemeral'
  and public.can_read_ephemeral_media(name)
);
