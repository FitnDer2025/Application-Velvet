-- Velvet BETA — private media storage.
-- Object path: <profile_uuid>/<album_uuid-or-profile>/<random_uuid>.<ext>

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'velvet-media',
  'velvet-media',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy media_bucket_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='velvet-media'
  and public.is_profile_member(((storage.foldername(name))[1])::uuid)
);

create policy media_bucket_authorized_select
on storage.objects for select to authenticated
using (
  bucket_id='velvet-media'
  and exists (
    select 1
      from public.media_assets ma
     where ma.storage_path=storage.objects.name
       and (
         public.is_profile_member(ma.profile_id)
         or (
           ma.visibility='profile'
           and ma.moderation_status='approved'
           and public.can_view_profile(ma.profile_id)
         )
         or (
           ma.album_id is not null
           and exists (
             select 1 from public.album_access_grants g
              where g.album_id=ma.album_id
                and g.grantee_user_id=auth.uid()
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at>now())
           )
         )
         or public.is_control_user()
       )
  )
);

create policy media_bucket_owner_update
on storage.objects for update to authenticated
using (
  bucket_id='velvet-media'
  and public.is_profile_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id='velvet-media'
  and public.is_profile_member(((storage.foldername(name))[1])::uuid)
);

create policy media_bucket_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id='velvet-media'
  and public.is_profile_member(((storage.foldername(name))[1])::uuid)
);

