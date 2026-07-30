-- Velvet BETA — modération IA unifiée des photos et vidéos.
-- À exécuter manuellement dans Supabase après déploiement du code applicatif.

create or replace function public.can_moderate_media()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin')
      or public.has_role('direction')
      or public.has_role('moderator');
$$;

revoke all on function public.can_moderate_media() from public;
grant execute on function public.can_moderate_media() to authenticated;

-- Le bucket reste privé. La limite et les types couvrent aussi les vidéos
-- d'album et les pièces jointes déjà prévues par la migration 0024.
update storage.buckets
   set public=false,
       file_size_limit=52428800,
       allowed_mime_types=array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif',
         'video/mp4',
         'video/webm',
         'video/quicktime',
         'application/pdf'
       ]
 where id='velvet-media';

drop policy if exists media_authorized_read on public.media_assets;
create policy media_authorized_read on public.media_assets
for select to authenticated
using (
  public.is_profile_member(profile_id)
  or (
    visibility='profile'
    and moderation_status='approved'
    and public.can_view_profile(profile_id)
  )
  or (
    album_id is not null
    and moderation_status='approved'
    and exists (
      select 1
        from public.album_access_grants g
       where g.album_id=media_assets.album_id
         and g.grantee_user_id=auth.uid()
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at>now())
    )
  )
  or public.can_moderate_media()
);

drop policy if exists media_bucket_authorized_select on storage.objects;
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
           and ma.moderation_status='approved'
           and exists (
             select 1
               from public.album_access_grants g
              where g.album_id=ma.album_id
                and g.grantee_user_id=auth.uid()
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at>now())
           )
         )
         or public.can_moderate_media()
       )
  )
);

create index if not exists media_assets_moderation_queue_idx
  on public.media_assets (moderation_status,created_at)
  where moderation_status='pending';

create or replace function public.control_decide_media(
  target_media uuid,
  target_decision text,
  target_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile uuid;
  target_album uuid;
  target_media_type text;
  target_visibility text;
  previous_status text;
  normalized_reason text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.can_moderate_media() then
    raise exception 'media_moderation_access_required';
  end if;
  if target_decision not in ('approved','rejected') then
    raise exception 'invalid_media_moderation_decision';
  end if;

  normalized_reason := nullif(left(trim(coalesce(target_reason,'')),500),'');
  if target_decision='rejected' and normalized_reason is null then
    raise exception 'media_rejection_reason_required';
  end if;

  select profile_id,album_id,media_type,visibility,moderation_status
    into target_profile,target_album,target_media_type,target_visibility,previous_status
    from public.media_assets
   where id=target_media
     and moderation_status='pending'
   for update;

  if target_profile is null then raise exception 'pending_media_not_found'; end if;

  update public.media_assets
     set moderation_status=target_decision,
         ai_reviewed_at=coalesce(ai_reviewed_at,now()),
         rejection_reason=case when target_decision='rejected' then normalized_reason else null end,
         ai_assessment=coalesce(ai_assessment,'{}'::jsonb) || jsonb_build_object(
           'human_review',true,
           'human_reviewer',auth.uid(),
           'human_reviewed_at',now(),
           'human_reason',normalized_reason,
           'human_decision',target_decision
         )
   where id=target_media;

  perform public.refresh_profile_admission(target_profile);

  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  )
  values (
    auth.uid(),'control','media_' || target_decision,'media_asset',target_media,
    jsonb_build_object(
      'profile_id',target_profile,
      'album_id',target_album,
      'media_type',target_media_type,
      'visibility',target_visibility,
      'previous_status',previous_status,
      'decision',target_decision,
      'reason',normalized_reason
    )
  );

  return target_decision;
end;
$$;

revoke all on function public.control_decide_media(uuid,text,text) from public;
grant execute on function public.control_decide_media(uuid,text,text) to authenticated;
