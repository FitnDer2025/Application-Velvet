-- Velvet Contrôle — ouverture auditée de la vue modérateur d'un profil membre.
-- À exécuter manuellement dans Supabase avant d'activer la vue complète.

create or replace function public.control_open_member_profile_review(
  target_profile uuid,
  target_reason text default 'member_management_control'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_reason text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not public.can_moderate_media() then
    raise exception 'control_moderation_required';
  end if;
  if target_profile is null or not exists (
    select 1 from public.member_profiles where id=target_profile
  ) then
    raise exception 'member_profile_not_found';
  end if;

  normalized_reason := coalesce(
    nullif(left(btrim(coalesce(target_reason,'')),120),''),
    'member_management_control'
  );

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    auth.uid(),
    'control',
    'member_profile_review_opened',
    'member_profile',
    target_profile,
    jsonb_build_object(
      'reason',normalized_reason,
      'scope',jsonb_build_array('profile_content','public_media','private_media')
    )
  );
end;
$$;

revoke all on function public.control_open_member_profile_review(uuid,text) from public;
grant execute on function public.control_open_member_profile_review(uuid,text) to authenticated;
