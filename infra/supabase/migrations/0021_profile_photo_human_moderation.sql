-- Velvet BETA — résolution humaine des photos de profil restées en attente.
-- L'IA conserve la priorité ; seuls admin, direction et modérateur peuvent
-- prendre la décision finale sur un cas ambigu ou une panne technique.

create or replace function public.control_decide_profile_photo(
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
  previous_status text;
  normalized_reason text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (
    public.has_role('admin')
    or public.has_role('direction')
    or public.has_role('moderator')
  ) then
    raise exception 'photo_moderation_access_required';
  end if;
  if target_decision not in ('approved','rejected') then
    raise exception 'invalid_photo_moderation_decision';
  end if;

  normalized_reason := nullif(left(trim(coalesce(target_reason,'')),500),'');
  if target_decision='rejected' and normalized_reason is null then
    raise exception 'photo_rejection_reason_required';
  end if;

  select profile_id,moderation_status
    into target_profile,previous_status
    from public.media_assets
   where id=target_media
     and album_id is null
     and media_role in ('couple_gallery','individual_gallery','individual_portrait')
   for update;

  if target_profile is null then raise exception 'profile_photo_not_found'; end if;

  update public.media_assets
     set moderation_status=target_decision,
         ai_reviewed_at=now(),
         rejection_reason=case when target_decision='rejected' then normalized_reason else null end,
         ai_assessment=coalesce(ai_assessment,'{}'::jsonb) || jsonb_build_object(
           'human_review',true,
           'human_reviewer',auth.uid(),
           'human_reviewed_at',now(),
           'human_reason',normalized_reason
         )
   where id=target_media;

  perform public.refresh_profile_admission(target_profile);

  insert into public.audit_events(
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  )
  values (
    auth.uid(),'control','profile_photo_' || target_decision,'media_asset',target_media,
    jsonb_build_object(
      'profile_id',target_profile,
      'previous_status',previous_status,
      'decision',target_decision,
      'reason',normalized_reason
    )
  );

  return target_decision;
end;
$$;

revoke all on function public.control_decide_profile_photo(uuid,text,text) from public;
grant execute on function public.control_decide_profile_photo(uuid,text,text) to authenticated;
