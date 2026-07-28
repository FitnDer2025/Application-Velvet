-- Velvet BETA neutre — profils réels, demandes organisateur et invitations admin.
-- Cette migration ne crée aucune donnée fictive et ne modifie aucun compte existant.

alter table public.member_profiles
  add column if not exists relationship_since smallint
    check (relationship_since between 1900 and 2100),
  add column if not exists journey text,
  add column if not exists favorite_places text[] not null default '{}',
  add column if not exists availability_text text;

create unique index if not exists member_profiles_one_creator_idx
  on public.member_profiles (created_by);

create table if not exists public.organizer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  member_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending'
    check (status in ('pending','approved','declined','cancelled')),
  reviewed_by uuid references public.accounts(user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizer_requests_one_pending_idx
  on public.organizer_requests (user_id)
  where status = 'pending';

alter table public.organizer_requests enable row level security;

drop policy if exists organizer_requests_self_read on public.organizer_requests;
create policy organizer_requests_self_read on public.organizer_requests
for select to authenticated
using (user_id = auth.uid() or public.is_control_user());

drop policy if exists organizer_requests_self_create on public.organizer_requests;
create policy organizer_requests_self_create on public.organizer_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_profile_member(member_profile_id)
  and public.is_beta_approved()
);

drop policy if exists organizer_requests_self_cancel on public.organizer_requests;
create policy organizer_requests_self_cancel on public.organizer_requests
for update to authenticated
using (user_id = auth.uid() or public.is_control_user())
with check (user_id = auth.uid() or public.is_control_user());

grant select, insert, update on public.organizer_requests to authenticated;

create or replace function public.upsert_my_beta_profile(profile_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
  profile_kind text := profile_payload ->> 'profile_type';
  display_name_value text := btrim(coalesce(profile_payload ->> 'display_name',''));
  people jsonb := coalesce(profile_payload -> 'people','[]'::jsonb);
  person_record record;
  expected_people integer;
  slot_value text;
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

  expected_people := case when profile_kind = 'couple' then 2 else 1 end;
  if jsonb_typeof(people) <> 'array' or jsonb_array_length(people) <> expected_people then
    raise exception 'invalid_people_count';
  end if;

  select id into profile_id_value
    from public.member_profiles
   where created_by = auth.uid()
   limit 1
   for update;

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
  else
    update public.member_profiles set
      profile_type = profile_kind,
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

  insert into public.profile_members (
    profile_id, user_id, member_slot, status, accepted_at
  ) values (
    profile_id_value,
    auth.uid(),
    case when profile_kind = 'couple' then 'partner_a' else 'individual' end,
    'active',
    now()
  )
  on conflict (profile_id,user_id) do update set
    member_slot = excluded.member_slot,
    status = 'active',
    accepted_at = coalesce(public.profile_members.accepted_at,now());

  delete from public.individual_profiles where profile_id = profile_id_value;

  for person_record in
    select value as person, (ordinality - 1)::integer as position
      from jsonb_array_elements(people) with ordinality
  loop
    slot_value := case
      when profile_kind = 'individual' then 'individual'
      when person_record.position = 0 then 'partner_a'
      else 'partner_b'
    end;
    birth_year_value := nullif(person_record.person ->> 'birth_year','')::smallint;
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
      case when person_record.position = 0 then auth.uid() else null end,
      slot_value,
      nullif(btrim(person_record.person ->> 'first_name'),''),
      birth_year_value,
      nullif(person_record.person ->> 'height_cm','')::smallint,
      nullif(person_record.person ->> 'weight_kg','')::smallint,
      nullif(btrim(person_record.person ->> 'morphology'),''),
      nullif(btrim(person_record.person ->> 'hair_color'),''),
      nullif(btrim(person_record.person ->> 'eye_color'),''),
      nullif(person_record.person ->> 'children_status',''),
      nullif(btrim(person_record.person ->> 'profession'),''),
      coalesce((person_record.person ->> 'profession_private')::boolean,true),
      nullif(btrim(person_record.person ->> 'orientation'),''),
      nullif(btrim(person_record.person ->> 'frequency'),''),
      nullif(btrim(person_record.person ->> 'biography'),''),
      array(select jsonb_array_elements_text(coalesce(person_record.person -> 'attracted_to','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(person_record.person -> 'desired_practices','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(person_record.person -> 'partner_permissions','[]'::jsonb))),
      coalesce(person_record.person -> 'visibility','{}'::jsonb)
    );
  end loop;

  insert into public.audit_events (
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'member_profile_upserted', 'member_profile',
    profile_id_value, jsonb_build_object('profile_type',profile_kind,'source','beta_onboarding')
  );

  return profile_id_value;
end;
$$;

revoke all on function public.upsert_my_beta_profile(jsonb) from public;
grant execute on function public.upsert_my_beta_profile(jsonb) to authenticated;

create or replace function public.admin_create_beta_invite(
  invited_email text,
  invited_role text default 'member',
  validity_days integer default 7
)
returns table (invite_id uuid, invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_code text;
  result_id uuid;
  result_expiry timestamptz;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'admin_required';
  end if;
  if invited_email is null or position('@' in invited_email) < 2 then
    raise exception 'invalid_email';
  end if;
  if invited_role not in ('member','organizer','pro_owner','pro_staff','moderator','support','auditor','direction','admin') then
    raise exception 'invalid_role';
  end if;
  if validity_days < 1 or validity_days > 30 then
    raise exception 'invalid_validity';
  end if;

  raw_code := upper(encode(extensions.gen_random_bytes(8),'hex'));
  result_expiry := now() + make_interval(days => validity_days);

  insert into public.beta_invites (
    email, code_hash, intended_role, expires_at, max_uses, created_by
  ) values (
    lower(btrim(invited_email)),
    extensions.crypt(raw_code,extensions.gen_salt('bf')),
    invited_role,
    result_expiry,
    1,
    auth.uid()
  )
  returning id into result_id;

  insert into public.audit_events (
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'beta_invite_created', 'beta_invite',
    result_id, jsonb_build_object('role',invited_role,'validity_days',validity_days)
  );

  return query select result_id, raw_code, result_expiry;
end;
$$;

revoke all on function public.admin_create_beta_invite(text,text,integer) from public;
grant execute on function public.admin_create_beta_invite(text,text,integer) to authenticated;
