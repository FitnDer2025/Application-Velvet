-- Velvet internal-only AI test agents — explicit display labels.
-- Ensures every client can derive Femme seule / Homme seul / Couple reliably.

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

update public.internal_test_agents a
set persona = jsonb_set(
  coalesce(a.persona, '{}'::jsonb),
  '{profile_label}',
  to_jsonb(case
    when a.slug in ('clara-mathieu', 'sophie-thomas', 'nina-lucas') then 'Couple'
    when a.slug = 'lea-nord' then 'Femme seule'
    when a.slug = 'maxime-lille' then 'Homme seul'
    when a.slug = 'camille-bxl' then 'Non-binaire'
    else 'Membre'
  end),
  true
),
updated_at = now()
where a.slug in (
  'clara-mathieu',
  'lea-nord',
  'sophie-thomas',
  'maxime-lille',
  'nina-lucas',
  'camille-bxl'
);
