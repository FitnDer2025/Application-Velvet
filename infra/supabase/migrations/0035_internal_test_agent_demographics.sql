-- Velvet internal-only AI test agents — demographic labels for native clients.
-- Keeps synthetic profile labels explicit without weakening external profile visibility.

create or replace function public.sync_internal_test_agent_demographics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.individual_profiles ip
  set gender_identity = case
    when new.slug = 'clara-mathieu' and ip.member_slot = 'partner_a' then 'femme'
    when new.slug = 'clara-mathieu' and ip.member_slot = 'partner_b' then 'homme'
    when new.slug = 'lea-nord' and ip.member_slot = 'individual' then 'femme'
    when new.slug = 'sophie-thomas' and ip.member_slot = 'partner_a' then 'femme'
    when new.slug = 'sophie-thomas' and ip.member_slot = 'partner_b' then 'homme'
    when new.slug = 'maxime-lille' and ip.member_slot = 'individual' then 'homme'
    when new.slug = 'nina-lucas' and ip.member_slot = 'partner_a' then 'femme'
    when new.slug = 'nina-lucas' and ip.member_slot = 'partner_b' then 'homme'
    when new.slug = 'camille-bxl' and ip.member_slot = 'individual' then 'non-binaire'
    else ip.gender_identity
  end
  where ip.profile_id = new.profile_id;

  return new;
end;
$$;

drop trigger if exists internal_test_agent_demographics_sync
on public.internal_test_agents;

create trigger internal_test_agent_demographics_sync
after insert or update of profile_id, slug
on public.internal_test_agents
for each row
execute function public.sync_internal_test_agent_demographics();

-- Backfill the six profiles that may already exist in staging.
update public.individual_profiles ip
set gender_identity = case
  when a.slug = 'clara-mathieu' and ip.member_slot = 'partner_a' then 'femme'
  when a.slug = 'clara-mathieu' and ip.member_slot = 'partner_b' then 'homme'
  when a.slug = 'lea-nord' and ip.member_slot = 'individual' then 'femme'
  when a.slug = 'sophie-thomas' and ip.member_slot = 'partner_a' then 'femme'
  when a.slug = 'sophie-thomas' and ip.member_slot = 'partner_b' then 'homme'
  when a.slug = 'maxime-lille' and ip.member_slot = 'individual' then 'homme'
  when a.slug = 'nina-lucas' and ip.member_slot = 'partner_a' then 'femme'
  when a.slug = 'nina-lucas' and ip.member_slot = 'partner_b' then 'homme'
  when a.slug = 'camille-bxl' and ip.member_slot = 'individual' then 'non-binaire'
  else ip.gender_identity
end
from public.internal_test_agents a
where a.profile_id = ip.profile_id;

revoke all on function public.sync_internal_test_agent_demographics()
from public, anon, authenticated;

grant execute on function public.sync_internal_test_agent_demographics()
to service_role;
