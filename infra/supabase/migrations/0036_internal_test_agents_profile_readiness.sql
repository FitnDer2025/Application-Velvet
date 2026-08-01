-- Velvet internal test agents — restore profile readiness after service-role seeding.
-- Internal/staging only. Keeps the three-photo rule for real member profiles.

update public.media_assets media
set
  album_id = null,
  visibility = 'profile',
  moderation_status = 'approved',
  media_role = case
    when coalesce(agent.persona->>'profile_type', profile.profile_type) = 'couple'
      then 'couple_gallery'
    else 'individual_gallery'
  end
from public.internal_test_agents agent
join public.member_profiles profile on profile.id = agent.profile_id
where media.profile_id = agent.profile_id
  and media.media_type = 'image';

update public.member_profiles profile
set
  profile_type = case
    when coalesce(agent.persona->>'profile_type', profile.profile_type) = 'couple'
      then 'couple'
    else 'individual'
  end,
  profile_photo_ready = (
    select count(*) >= 3
    from public.media_assets media
    where media.profile_id = profile.id
      and media.album_id is null
      and media.media_type = 'image'
      and media.media_role in ('couple_gallery', 'individual_gallery')
      and media.moderation_status = 'approved'
  ),
  visibility = 'beta_members',
  admission_status = 'approved',
  published_at = coalesce(profile.published_at, now()),
  is_internal_test_agent = true,
  updated_at = now()
from public.internal_test_agents agent
where agent.profile_id = profile.id;

-- Reapply the canonical helper where available, so the persisted flag remains
-- aligned with the same readiness rule used by member discovery.
do $$
declare
  row record;
begin
  if to_regprocedure('public.sync_profile_photo_ready(uuid)') is not null then
    for row in select profile_id from public.internal_test_agents loop
      perform public.sync_profile_photo_ready(row.profile_id);
    end loop;
  end if;
end;
$$;
