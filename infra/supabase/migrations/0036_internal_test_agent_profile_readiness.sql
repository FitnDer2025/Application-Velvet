-- Velvet internal-only AI test agents — keep seeded profiles discoverable in staging.
-- Test profiles are populated by a trusted service-role seed and use approved synthetic media.

create or replace function public.sync_internal_test_agent_profile_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_profiles
  set profile_type = coalesce(nullif(new.persona->>'profile_type', ''), profile_type),
      admission_status = 'approved',
      visibility = 'beta_members',
      profile_photo_ready = true,
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = new.profile_id
    and is_internal_test_agent = true;

  return new;
end;
$$;

drop trigger if exists internal_test_agent_profile_readiness_sync
on public.internal_test_agents;

create trigger internal_test_agent_profile_readiness_sync
after insert or update of profile_id, persona, status
on public.internal_test_agents
for each row
when (new.status = 'active')
execute function public.sync_internal_test_agent_profile_readiness();

-- Backfill the six already-seeded profiles.
update public.member_profiles p
set profile_type = coalesce(nullif(a.persona->>'profile_type', ''), p.profile_type),
    admission_status = 'approved',
    visibility = 'beta_members',
    profile_photo_ready = true,
    published_at = coalesce(p.published_at, now()),
    updated_at = now()
from public.internal_test_agents a
where a.profile_id = p.id
  and a.status = 'active'
  and p.is_internal_test_agent = true;

revoke all on function public.sync_internal_test_agent_profile_readiness()
from public, anon, authenticated;

grant execute on function public.sync_internal_test_agent_profile_readiness()
to service_role;
