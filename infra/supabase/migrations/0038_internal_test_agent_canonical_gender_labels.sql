-- Velvet internal-only AI test agents — canonical gender identities.
-- Database stores stable machine values; clients render French labels.

begin;

create or replace function public.sync_internal_test_agent_demographics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.individual_profiles ip
  set gender_identity = case
    when new.slug = 'clara-mathieu' and ip.member_slot = 'partner_a' then 'woman'
    when new.slug = 'clara-mathieu' and ip.member_slot = 'partner_b' then 'man'
    when new.slug = 'lea-nord' and ip.member_slot = 'individual' then 'woman'
    when new.slug = 'sophie-thomas' and ip.member_slot = 'partner_a' then 'woman'
    when new.slug = 'sophie-thomas' and ip.member_slot = 'partner_b' then 'man'
    when new.slug = 'maxime-lille' and ip.member_slot = 'individual' then 'man'
    when new.slug = 'nina-lucas' and ip.member_slot = 'partner_a' then 'woman'
    when new.slug = 'nina-lucas' and ip.member_slot = 'partner_b' then 'man'
    when new.slug = 'camille-bxl' and ip.member_slot = 'individual' then 'non_binary'
    else ip.gender_identity
  end
  where ip.profile_id = new.profile_id;

  update public.member_profiles profile
  set
    profile_type = case
      when new.slug in ('clara-mathieu', 'sophie-thomas', 'nina-lucas') then 'couple'
      else 'individual'
    end,
    updated_at = now()
  where profile.id = new.profile_id;

  update public.internal_test_agents agent
  set
    persona = jsonb_set(
      coalesce(agent.persona, '{}'::jsonb),
      '{profile_label}',
      to_jsonb(case
        when new.slug in ('clara-mathieu', 'sophie-thomas', 'nina-lucas') then 'Couple'
        when new.slug = 'lea-nord' then 'Femme seule'
        when new.slug = 'maxime-lille' then 'Homme seul'
        when new.slug = 'camille-bxl' then 'Non-binaire'
        else 'Membre'
      end),
      true
    ),
    updated_at = now()
  where agent.id = new.id;

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

update public.individual_profiles ip
set gender_identity = case
  when agent.slug = 'clara-mathieu' and ip.member_slot = 'partner_a' then 'woman'
  when agent.slug = 'clara-mathieu' and ip.member_slot = 'partner_b' then 'man'
  when agent.slug = 'lea-nord' and ip.member_slot = 'individual' then 'woman'
  when agent.slug = 'sophie-thomas' and ip.member_slot = 'partner_a' then 'woman'
  when agent.slug = 'sophie-thomas' and ip.member_slot = 'partner_b' then 'man'
  when agent.slug = 'maxime-lille' and ip.member_slot = 'individual' then 'man'
  when agent.slug = 'nina-lucas' and ip.member_slot = 'partner_a' then 'woman'
  when agent.slug = 'nina-lucas' and ip.member_slot = 'partner_b' then 'man'
  when agent.slug = 'camille-bxl' and ip.member_slot = 'individual' then 'non_binary'
  else ip.gender_identity
end
from public.internal_test_agents agent
where agent.profile_id = ip.profile_id;

update public.member_profiles profile
set
  profile_type = case
    when agent.slug in ('clara-mathieu', 'sophie-thomas', 'nina-lucas') then 'couple'
    else 'individual'
  end,
  updated_at = now()
from public.internal_test_agents agent
where agent.profile_id = profile.id
  and agent.slug in (
    'clara-mathieu',
    'lea-nord',
    'sophie-thomas',
    'maxime-lille',
    'nina-lucas',
    'camille-bxl'
  );

update public.internal_test_agents agent
set
  persona = jsonb_set(
    coalesce(agent.persona, '{}'::jsonb),
    '{profile_label}',
    to_jsonb(case
      when agent.slug in ('clara-mathieu', 'sophie-thomas', 'nina-lucas') then 'Couple'
      when agent.slug = 'lea-nord' then 'Femme seule'
      when agent.slug = 'maxime-lille' then 'Homme seul'
      when agent.slug = 'camille-bxl' then 'Non-binaire'
      else 'Membre'
    end),
    true
  ),
  updated_at = now()
where agent.slug in (
  'clara-mathieu',
  'lea-nord',
  'sophie-thomas',
  'maxime-lille',
  'nina-lucas',
  'camille-bxl'
);

revoke all on function public.sync_internal_test_agent_demographics()
from public, anon, authenticated;

grant execute on function public.sync_internal_test_agent_demographics()
to service_role;

commit;
