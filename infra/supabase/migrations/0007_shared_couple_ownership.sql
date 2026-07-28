-- Velvet BETA — propriété partagée du couple et propriété individuelle stricte.
-- Aucun partenaire n'est invité par cette migration.

create table if not exists public.couple_partner_invitations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  inviter_user_id uuid not null references public.accounts(user_id) on delete cascade,
  invited_email text not null,
  invite_id uuid not null unique references public.beta_invites(id) on delete cascade,
  member_slot text not null default 'partner_b' check (member_slot = 'partner_b'),
  status text not null default 'pending'
    check (status in ('pending','accepted','revoked','expired')),
  accepted_user_id uuid references public.accounts(user_id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists couple_partner_one_pending_idx
  on public.couple_partner_invitations (profile_id)
  where status = 'pending';

alter table public.couple_partner_invitations enable row level security;

drop policy if exists couple_partner_invites_read on public.couple_partner_invitations;
create policy couple_partner_invites_read on public.couple_partner_invitations
for select to authenticated
using (
  inviter_user_id = auth.uid()
  or accepted_user_id = auth.uid()
  or public.is_control_user()
);

grant select on public.couple_partner_invitations to authenticated;

-- Un membre du couple peut modifier la fiche commune, mais jamais la fiche
-- personnelle ni l'appartenance de son/sa partenaire.
drop policy if exists individual_profiles_write on public.individual_profiles;
drop policy if exists individual_profiles_owner_insert on public.individual_profiles;
create policy individual_profiles_owner_insert on public.individual_profiles
for insert to authenticated
with check (
  linked_user_id = auth.uid()
  and public.is_profile_member(profile_id)
);

drop policy if exists individual_profiles_owner_update on public.individual_profiles;
create policy individual_profiles_owner_update on public.individual_profiles
for update to authenticated
using (linked_user_id = auth.uid())
with check (
  linked_user_id = auth.uid()
  and public.is_profile_member(profile_id)
);

drop policy if exists individual_profiles_owner_delete on public.individual_profiles;
create policy individual_profiles_owner_delete on public.individual_profiles
for delete to authenticated
using (linked_user_id = auth.uid());

revoke update on public.profile_members from authenticated;

create or replace function public.upsert_my_beta_profile(profile_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
  profile_kind text := profile_payload ->> 'profile_type';
  existing_kind text;
  display_name_value text := btrim(coalesce(profile_payload ->> 'display_name',''));
  member_slot_value text;
  person jsonb := coalesce(profile_payload -> 'person','{}'::jsonb);
  birth_year_value smallint;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if not public.is_beta_approved() then
    raise exception 'beta_account_not_active';
  end if;
  if profile_kind not in ('couple','individual') then
    raise exception 'invalid_profile_type';
  end if;
  if char_length(display_name_value) < 2 or char_length(display_name_value) > 120 then
    raise exception 'invalid_display_name';
  end if;
  if jsonb_typeof(person) <> 'object'
     or char_length(btrim(coalesce(person ->> 'first_name',''))) < 2 then
    raise exception 'personal_profile_required';
  end if;

  select pm.profile_id, pm.member_slot, p.profile_type
    into profile_id_value, member_slot_value, existing_kind
    from public.profile_members pm
    join public.member_profiles p on p.id = pm.profile_id
   where pm.user_id = auth.uid()
     and pm.status = 'active'
   order by pm.created_at
   limit 1
   for update of p;

  if profile_id_value is null then
    insert into public.member_profiles (
      created_by, profile_type, display_name, city, location_zone,
      story, description, search_text, practices, values_list,
      visibility, is_demo, published_at, relationship_since,
      journey, favorite_places, availability_text
    ) values (
      auth.uid(),
      profile_kind,
      display_name_value,
      nullif(btrim(profile_payload ->> 'city'),''),
      nullif(btrim(profile_payload ->> 'location_zone'),''),
      nullif(btrim(profile_payload ->> 'story'),''),
      nullif(btrim(profile_payload ->> 'description'),''),
      nullif(btrim(profile_payload ->> 'search_text'),''),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'practices','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'values_list','[]'::jsonb))),
      'beta_members',
      false,
      now(),
      nullif(profile_payload ->> 'relationship_since','')::smallint,
      nullif(btrim(profile_payload ->> 'journey'),''),
      array(select jsonb_array_elements_text(coalesce(profile_payload -> 'favorite_places','[]'::jsonb))),
      nullif(btrim(profile_payload ->> 'availability_text'),'')
    )
    returning id into profile_id_value;

    member_slot_value := case when profile_kind = 'couple' then 'partner_a' else 'individual' end;
    insert into public.profile_members (
      profile_id, user_id, member_slot, status, accepted_at
    ) values (
      profile_id_value, auth.uid(), member_slot_value, 'active', now()
    );
  else
    profile_kind := existing_kind;
    update public.member_profiles set
      display_name = display_name_value,
      city = nullif(btrim(profile_payload ->> 'city'),''),
      location_zone = nullif(btrim(profile_payload ->> 'location_zone'),''),
      story = nullif(btrim(profile_payload ->> 'story'),''),
      description = nullif(btrim(profile_payload ->> 'description'),''),
      search_text = nullif(btrim(profile_payload ->> 'search_text'),''),
      practices = array(select jsonb_array_elements_text(coalesce(profile_payload -> 'practices','[]'::jsonb))),
      values_list = array(select jsonb_array_elements_text(coalesce(profile_payload -> 'values_list','[]'::jsonb))),
      relationship_since = nullif(profile_payload ->> 'relationship_since','')::smallint,
      journey = nullif(btrim(profile_payload ->> 'journey'),''),
      favorite_places = array(select jsonb_array_elements_text(coalesce(profile_payload -> 'favorite_places','[]'::jsonb))),
      availability_text = nullif(btrim(profile_payload ->> 'availability_text'),''),
      visibility = case when visibility = 'suspended' then visibility else 'beta_members' end,
      is_demo = false,
      published_at = coalesce(published_at,now()),
      updated_at = now()
    where id = profile_id_value;
  end if;

  birth_year_value := nullif(person ->> 'birth_year','')::smallint;
  if birth_year_value is not null
     and birth_year_value > extract(year from current_date)::integer - 18 then
    raise exception 'adult_profiles_only';
  end if;

  insert into public.individual_profiles (
    profile_id, linked_user_id, member_slot, first_name, birth_year,
    height_cm, weight_kg, morphology, hair_color, eye_color,
    children_status, profession, profession_private, orientation,
    frequency, biography, attracted_to, desired_practices,
    partner_permissions, visibility
  ) values (
    profile_id_value,
    auth.uid(),
    member_slot_value,
    nullif(btrim(person ->> 'first_name'),''),
    birth_year_value,
    nullif(person ->> 'height_cm','')::smallint,
    nullif(person ->> 'weight_kg','')::smallint,
    nullif(btrim(person ->> 'morphology'),''),
    nullif(btrim(person ->> 'hair_color'),''),
    nullif(btrim(person ->> 'eye_color'),''),
    nullif(person ->> 'children_status',''),
    nullif(btrim(person ->> 'profession'),''),
    coalesce((person ->> 'profession_private')::boolean,true),
    nullif(btrim(person ->> 'orientation'),''),
    nullif(btrim(person ->> 'frequency'),''),
    nullif(btrim(person ->> 'biography'),''),
    array(select jsonb_array_elements_text(coalesce(person -> 'attracted_to','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(person -> 'desired_practices','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(person -> 'partner_permissions','[]'::jsonb))),
    coalesce(person -> 'visibility','{}'::jsonb)
  )
  on conflict (profile_id,member_slot) do update set
    linked_user_id = auth.uid(),
    first_name = excluded.first_name,
    birth_year = excluded.birth_year,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    morphology = excluded.morphology,
    hair_color = excluded.hair_color,
    eye_color = excluded.eye_color,
    children_status = excluded.children_status,
    profession = excluded.profession,
    profession_private = excluded.profession_private,
    orientation = excluded.orientation,
    frequency = excluded.frequency,
    biography = excluded.biography,
    attracted_to = excluded.attracted_to,
    desired_practices = excluded.desired_practices,
    partner_permissions = excluded.partner_permissions,
    visibility = excluded.visibility,
    updated_at = now()
  where public.individual_profiles.linked_user_id = auth.uid();

  if not exists (
    select 1 from public.individual_profiles ip
     where ip.profile_id = profile_id_value
       and ip.member_slot = member_slot_value
       and ip.linked_user_id = auth.uid()
  ) then
    raise exception 'personal_profile_ownership_violation';
  end if;

  insert into public.audit_events (
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'shared_member_profile_upserted', 'member_profile',
    profile_id_value, jsonb_build_object(
      'profile_type',profile_kind,
      'member_slot',member_slot_value,
      'source','beta_onboarding'
    )
  );

  return profile_id_value;
end;
$$;

revoke all on function public.upsert_my_beta_profile(jsonb) from public;
grant execute on function public.upsert_my_beta_profile(jsonb) to authenticated;

create or replace function public.invite_my_couple_partner(
  partner_email text,
  validity_days integer default 7
)
returns table (
  partner_invitation_id uuid,
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
  raw_code text;
  beta_invite_id uuid;
  expiry timestamptz;
  partner_invitation_id_value uuid;
begin
  if auth.uid() is null or not public.is_beta_approved() then
    raise exception 'active_member_required';
  end if;
  if partner_email is null or position('@' in partner_email) < 2 then
    raise exception 'invalid_partner_email';
  end if;
  if validity_days < 1 or validity_days > 30 then
    raise exception 'invalid_validity';
  end if;

  select pm.profile_id into profile_id_value
    from public.profile_members pm
    join public.member_profiles p on p.id = pm.profile_id
   where pm.user_id = auth.uid()
     and pm.status = 'active'
     and pm.member_slot = 'partner_a'
     and p.profile_type = 'couple'
   limit 1;

  if profile_id_value is null then
    raise exception 'couple_creator_required';
  end if;
  if exists (
    select 1 from public.profile_members
     where profile_id = profile_id_value
       and member_slot = 'partner_b'
       and status in ('pending','active')
  ) then
    raise exception 'couple_partner_already_linked';
  end if;

  update public.beta_invites bi
     set revoked_at = now()
   where bi.id in (
     select cpi.invite_id
       from public.couple_partner_invitations cpi
      where cpi.profile_id = profile_id_value
        and cpi.status = 'pending'
   );
  update public.couple_partner_invitations
     set status = 'revoked'
   where profile_id = profile_id_value
     and status = 'pending';

  raw_code := upper(encode(extensions.gen_random_bytes(8),'hex'));
  expiry := now() + make_interval(days => validity_days);

  insert into public.beta_invites (
    email, code_hash, intended_role, expires_at, max_uses, created_by
  ) values (
    lower(btrim(partner_email)),
    extensions.crypt(raw_code,extensions.gen_salt('bf')),
    'member',
    expiry,
    1,
    auth.uid()
  )
  returning id into beta_invite_id;

  insert into public.couple_partner_invitations (
    profile_id, inviter_user_id, invited_email, invite_id
  ) values (
    profile_id_value, auth.uid(), lower(btrim(partner_email)), beta_invite_id
  )
  returning id into partner_invitation_id_value;

  insert into public.audit_events (
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'couple_partner_invited', 'member_profile',
    profile_id_value, jsonb_build_object('invitation_id',partner_invitation_id_value)
  );

  return query select partner_invitation_id_value, raw_code, expiry;
end;
$$;

revoke all on function public.invite_my_couple_partner(text,integer) from public;
grant execute on function public.invite_my_couple_partner(text,integer) to authenticated;

create or replace function public.accept_invited_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.beta_invites%rowtype;
  partner_invite public.couple_partner_invitations%rowtype;
  supplied_code text;
begin
  supplied_code := new.raw_user_meta_data ->> 'invite_code';
  if supplied_code is null or new.email is null then
    raise exception 'beta_invitation_required';
  end if;

  select *
    into invite
    from public.beta_invites
   where lower(email::text) = lower(new.email)
     and revoked_at is null
     and expires_at > now()
     and use_count < max_uses
     and code_hash = extensions.crypt(supplied_code,code_hash)
   order by created_at desc
   limit 1
   for update;

  if invite.id is null then
    raise exception 'beta_invitation_invalid';
  end if;

  update public.beta_invites
     set use_count = use_count + 1,
         consumed_at = case when use_count + 1 >= max_uses then now() else consumed_at end
   where id = invite.id;

  insert into public.accounts (user_id,email,status,invited_role,invitation_id)
  values (new.id,new.email,'pending_consent',invite.intended_role,invite.id);

  insert into public.account_roles (user_id,role_code)
  values (new.id,'member')
  on conflict do nothing;

  if invite.intended_role <> 'member' then
    insert into public.account_roles (user_id,role_code)
    values (new.id,invite.intended_role)
    on conflict do nothing;
  end if;

  select * into partner_invite
    from public.couple_partner_invitations
   where invite_id = invite.id
     and status = 'pending'
   limit 1
   for update;

  if partner_invite.id is not null then
    insert into public.profile_members (
      profile_id, user_id, member_slot, status
    ) values (
      partner_invite.profile_id, new.id, 'partner_b', 'pending'
    );
    update public.couple_partner_invitations set
      status = 'accepted',
      accepted_user_id = new.id,
      accepted_at = now()
    where id = partner_invite.id;
  end if;

  return new;
end;
$$;

create or replace function public.complete_beta_activation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='terms' and granted and withdrawn_at is null
  ) then raise exception 'terms_consent_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='privacy' and granted and withdrawn_at is null
  ) then raise exception 'privacy_acknowledgement_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='adult_declaration' and granted and withdrawn_at is null
  ) then raise exception 'adult_declaration_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='sensitive_profile' and granted and withdrawn_at is null
  ) then raise exception 'explicit_sensitive_data_consent_required'; end if;

  update public.accounts
     set status='active'
   where user_id=auth.uid()
     and status='pending_consent';

  update public.profile_members
     set status='active',
         accepted_at=coalesce(accepted_at,now())
   where user_id=auth.uid()
     and status='pending';
end;
$$;

revoke all on function public.complete_beta_activation() from public;
grant execute on function public.complete_beta_activation() to authenticated;
