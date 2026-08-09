begin;

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
        and (
          ephemeral.sender_user_id = auth.uid()
          or (
            ephemeral.opened_by_user_id = auth.uid()
            and ephemeral.opened_at is not null
          )
        )
    )
  );

commit;
