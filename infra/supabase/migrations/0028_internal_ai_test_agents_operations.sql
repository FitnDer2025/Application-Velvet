-- Velvet internal-only AI test agents — service and control operations.

create or replace function public.internal_prepare_test_agent_invite(
  target_email text,
  raw_code text,
  target_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'service_role_required';
  end if;
  if target_email is null or position('@' in target_email)<2 then
    raise exception 'invalid_email';
  end if;
  if raw_code is null or char_length(raw_code)<12 then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.beta_invites (
    email,code_hash,intended_role,expires_at,max_uses,created_by
  ) values (
    lower(btrim(target_email)),
    extensions.crypt(raw_code,extensions.gen_salt('bf')),
    'member',
    now()+interval '1 day',
    1,
    target_actor
  ) returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.internal_register_test_agent(
  target_user_id uuid,
  target_email text,
  target_slug text,
  target_persona jsonb,
  target_behavior jsonb,
  target_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_value uuid;
  profile_kind text := coalesce(target_persona->>'profile_type','individual');
  display_name_value text := btrim(coalesce(target_persona->>'display_name',target_slug));
  people jsonb := coalesce(target_persona->'people','[]'::jsonb);
  person_record record;
  slot_value text;
  birth_year_value smallint;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'service_role_required';
  end if;
  if target_user_id is null or target_slug is null then
    raise exception 'invalid_test_agent';
  end if;
  if profile_kind not in ('individual','couple') then
    raise exception 'invalid_profile_type';
  end if;
  if jsonb_typeof(people)<>'array' or jsonb_array_length(people)<1 then
    raise exception 'test_agent_people_required';
  end if;
  if profile_kind='individual' and jsonb_array_length(people)<>1 then
    raise exception 'invalid_people_count';
  end if;
  if profile_kind='couple' and jsonb_array_length(people)<>2 then
    raise exception 'invalid_people_count';
  end if;

  if not exists (select 1 from public.accounts where user_id=target_user_id) then
    raise exception 'test_agent_account_missing';
  end if;

  update public.accounts
  set status='active', invited_role='member', updated_at=now()
  where user_id=target_user_id;

  insert into public.account_roles (user_id,role_code,granted_by)
  values (target_user_id,'member',target_actor)
  on conflict (user_id,role_code) do update set
    expires_at=null,
    granted_by=coalesce(excluded.granted_by,public.account_roles.granted_by);

  select p.id into profile_id_value
  from public.member_profiles p
  where p.created_by=target_user_id
  limit 1
  for update;

  if profile_id_value is null then
    insert into public.member_profiles (
      created_by,profile_type,display_name,city,location_zone,story,description,
      search_text,practices,values_list,visibility,is_demo,published_at,
      relationship_since,journey,favorite_places,availability_text,
      admission_status,is_internal_test_agent
    ) values (
      target_user_id,
      profile_kind,
      display_name_value,
      nullif(btrim(target_persona->>'city'),''),
      nullif(btrim(target_persona->>'location_zone'),''),
      nullif(btrim(target_persona->>'story'),''),
      nullif(btrim(target_persona->>'description'),''),
      nullif(btrim(target_persona->>'search_text'),''),
      array(select jsonb_array_elements_text(coalesce(target_persona->'practices','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(target_persona->'values_list','[]'::jsonb))),
      'beta_members',
      true,
      now(),
      nullif(target_persona->>'relationship_since','')::smallint,
      nullif(btrim(target_persona->>'journey'),''),
      array(select jsonb_array_elements_text(coalesce(target_persona->'favorite_places','[]'::jsonb))),
      nullif(btrim(target_persona->>'availability_text'),''),
      'approved',
      true
    ) returning id into profile_id_value;
  else
    update public.member_profiles set
      profile_type=profile_kind,
      display_name=display_name_value,
      city=nullif(btrim(target_persona->>'city'),''),
      location_zone=nullif(btrim(target_persona->>'location_zone'),''),
      story=nullif(btrim(target_persona->>'story'),''),
      description=nullif(btrim(target_persona->>'description'),''),
      search_text=nullif(btrim(target_persona->>'search_text'),''),
      practices=array(select jsonb_array_elements_text(coalesce(target_persona->'practices','[]'::jsonb))),
      values_list=array(select jsonb_array_elements_text(coalesce(target_persona->'values_list','[]'::jsonb))),
      visibility='beta_members',
      is_demo=true,
      published_at=coalesce(published_at,now()),
      relationship_since=nullif(target_persona->>'relationship_since','')::smallint,
      journey=nullif(btrim(target_persona->>'journey'),''),
      favorite_places=array(select jsonb_array_elements_text(coalesce(target_persona->'favorite_places','[]'::jsonb))),
      availability_text=nullif(btrim(target_persona->>'availability_text'),''),
      admission_status='approved',
      is_internal_test_agent=true,
      updated_at=now()
    where id=profile_id_value;
  end if;

  insert into public.profile_members (
    profile_id,user_id,member_slot,status,accepted_at
  ) values (
    profile_id_value,
    target_user_id,
    case when profile_kind='couple' then 'partner_a' else 'individual' end,
    'active',
    now()
  )
  on conflict (profile_id,user_id) do update set
    member_slot=excluded.member_slot,
    status='active',
    accepted_at=coalesce(public.profile_members.accepted_at,now());

  delete from public.individual_profiles where profile_id=profile_id_value;

  for person_record in
    select value as person,(ordinality-1)::integer as position
    from jsonb_array_elements(people) with ordinality
  loop
    slot_value := case
      when profile_kind='individual' then 'individual'
      when person_record.position=0 then 'partner_a'
      else 'partner_b'
    end;
    birth_year_value := nullif(person_record.person->>'birth_year','')::smallint;
    if birth_year_value is null
       or birth_year_value>extract(year from current_date)::integer-18 then
      raise exception 'adult_profiles_only';
    end if;

    insert into public.individual_profiles (
      profile_id,linked_user_id,member_slot,first_name,birth_year,height_cm,
      morphology,hair_color,eye_color,children_status,profession,
      profession_private,orientation,frequency,biography,attracted_to,
      desired_practices,partner_permissions,visibility
    ) values (
      profile_id_value,
      case when person_record.position=0 then target_user_id else null end,
      slot_value,
      nullif(btrim(person_record.person->>'first_name'),''),
      birth_year_value,
      nullif(person_record.person->>'height_cm','')::smallint,
      nullif(btrim(person_record.person->>'morphology'),''),
      nullif(btrim(person_record.person->>'hair_color'),''),
      nullif(btrim(person_record.person->>'eye_color'),''),
      nullif(person_record.person->>'children_status',''),
      nullif(btrim(person_record.person->>'profession'),''),
      true,
      nullif(btrim(person_record.person->>'orientation'),''),
      nullif(btrim(person_record.person->>'frequency'),''),
      nullif(btrim(person_record.person->>'biography'),''),
      array(select jsonb_array_elements_text(coalesce(person_record.person->'attracted_to','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(person_record.person->'desired_practices','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(person_record.person->'partner_permissions','[]'::jsonb))),
      coalesce(person_record.person->'visibility','{}'::jsonb)
    );
  end loop;

  insert into public.internal_test_agents (
    user_id,profile_id,slug,display_name,persona,behavior,status,
    next_run_at,last_error_code,created_by,updated_at
  ) values (
    target_user_id,profile_id_value,target_slug,display_name_value,
    target_persona,target_behavior,'active',now(),null,target_actor,now()
  )
  on conflict (slug) do update set
    user_id=excluded.user_id,
    profile_id=excluded.profile_id,
    display_name=excluded.display_name,
    persona=excluded.persona,
    behavior=excluded.behavior,
    status='active',
    next_run_at=now(),
    last_error_code=null,
    updated_at=now();

  if target_actor is not null then
    insert into public.internal_test_agent_viewers (user_id,enabled,added_by)
    values (target_actor,true,target_actor)
    on conflict (user_id) do update set
      enabled=true,updated_at=now();
  end if;

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,entity_id,metadata
  ) values (
    target_actor,'user','internal_test_agent_registered','member_profile',
    profile_id_value,jsonb_build_object('slug',target_slug,'email',target_email)
  );

  return profile_id_value;
end;
$$;

create or replace function public.internal_test_agent_open_conversation(
  target_agent_user_id uuid,
  target_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  agent_profile_id uuid;
  profile_a uuid;
  profile_b uuid;
  conversation_id_value uuid;
begin
  -- L'exécution est limitée par les GRANT : service_role via PostgREST et
  -- propriétaire de la fonction pour le worker PostgreSQL interne.
  select a.profile_id into agent_profile_id
  from public.internal_test_agents a
  where a.user_id=target_agent_user_id and a.status='active';
  if agent_profile_id is null then raise exception 'active_test_agent_required'; end if;
  if target_profile_id is null or target_profile_id=agent_profile_id then
    raise exception 'invalid_target_profile';
  end if;
  if not exists (
    select 1
    from public.member_profiles p
    where p.id=target_profile_id
      and p.admission_status='approved'
      and p.visibility in ('beta_members','published')
      and (
        p.is_internal_test_agent
        or exists (
          select 1
          from public.profile_members pm
          join public.internal_test_agent_viewers v on v.user_id=pm.user_id and v.enabled
          where pm.profile_id=p.id and pm.status='active'
        )
      )
  ) then
    raise exception 'target_not_in_internal_test_cohort';
  end if;

  if agent_profile_id::text<target_profile_id::text then
    profile_a:=agent_profile_id;
    profile_b:=target_profile_id;
  else
    profile_a:=target_profile_id;
    profile_b:=agent_profile_id;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(profile_a::text||profile_b::text,0)
  );

  select dcp.conversation_id into conversation_id_value
  from public.direct_conversation_profiles dcp
  where dcp.profile_a_id=profile_a and dcp.profile_b_id=profile_b;

  if conversation_id_value is null then
    insert into public.conversations (kind,subject,created_by)
    values ('direct',null,target_agent_user_id)
    returning id into conversation_id_value;

    insert into public.direct_conversation_profiles (
      conversation_id,profile_a_id,profile_b_id
    ) values (conversation_id_value,profile_a,profile_b);
  end if;

  insert into public.conversation_members (
    conversation_id,user_id,display_identity,left_at
  )
  select
    conversation_id_value,
    pm.user_id,
    coalesce(ip.first_name,mp.display_name),
    null
  from public.profile_members pm
  join public.member_profiles mp on mp.id=pm.profile_id
  left join public.individual_profiles ip
    on ip.profile_id=pm.profile_id and ip.linked_user_id=pm.user_id
  where pm.profile_id in (agent_profile_id,target_profile_id)
    and pm.status='active'
  on conflict (conversation_id,user_id) do update set
    display_identity=excluded.display_identity,left_at=null;

  return conversation_id_value;
end;
$$;

create or replace function public.control_add_internal_test_viewer(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'internal_test_agent_control_required';
  end if;
  if not exists (select 1 from public.accounts where user_id=target_user_id) then
    raise exception 'account_not_found';
  end if;
  insert into public.internal_test_agent_viewers (user_id,enabled,added_by)
  values (target_user_id,true,auth.uid())
  on conflict (user_id) do update set
    enabled=true,added_by=auth.uid(),updated_at=now();
end;
$$;

create or replace function public.control_remove_internal_test_viewer(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'internal_test_agent_control_required';
  end if;
  update public.internal_test_agent_viewers
  set enabled=false,updated_at=now()
  where user_id=target_user_id;
end;
$$;

create or replace function public.control_set_internal_test_agents_enabled(target_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'internal_test_agent_control_required';
  end if;
  update public.internal_test_agent_settings
  set enabled=target_enabled,updated_by=auth.uid(),updated_at=now()
  where singleton=true;

  insert into public.audit_events (
    actor_user_id,actor_type,action,entity_type,metadata
  ) values (
    auth.uid(),'user',
    case when target_enabled then 'internal_test_agents_enabled' else 'internal_test_agents_disabled' end,
    'internal_test_agent_settings',
    jsonb_build_object('enabled',target_enabled)
  );
end;
$$;

create or replace function public.control_set_internal_test_agent_status(
  target_agent_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'internal_test_agent_control_required';
  end if;
  if target_status not in ('active','paused','retired') then
    raise exception 'invalid_test_agent_status';
  end if;
  update public.internal_test_agents
  set status=target_status,
      next_run_at=case when target_status='active' then now() else next_run_at end,
      updated_at=now()
  where id=target_agent_id;
end;
$$;

create or replace function public.control_internal_test_agent_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null
     or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'internal_test_agent_control_required';
  end if;

  select jsonb_build_object(
    'enabled',coalesce(s.enabled,false),
    'environmentLabel',coalesce(s.environment_label,'internal'),
    'viewerCount',(select count(*) from public.internal_test_agent_viewers v where v.enabled),
    'agentCount',(select count(*) from public.internal_test_agents a),
    'activeAgentCount',(select count(*) from public.internal_test_agents a where a.status='active'),
    'agents',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'slug',a.slug,
        'displayName',a.display_name,
        'status',a.status,
        'nextRunAt',a.next_run_at,
        'lastRunAt',a.last_run_at,
        'lastErrorCode',a.last_error_code,
        'profileId',a.profile_id,
        'userId',a.user_id
      ) order by a.created_at)
      from public.internal_test_agents a
    ),'[]'::jsonb)
  ) into payload
  from public.internal_test_agent_settings s
  where s.singleton=true;

  return coalesce(payload,jsonb_build_object(
    'enabled',false,'environmentLabel','internal','viewerCount',0,
    'agentCount',0,'activeAgentCount',0,'agents','[]'::jsonb
  ));
end;
$$;

create or replace function public.internal_purge_test_agent(target_agent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  target_profile uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  select a.user_id,a.profile_id into target_user,target_profile
  from public.internal_test_agents a
  where a.id=target_agent_id
  for update;
  if target_user is null then return null; end if;

  delete from public.conversations c
  where c.created_by=target_user
     or c.id in (
       select cm.conversation_id
       from public.conversation_members cm
       where cm.user_id=target_user
     );

  delete from public.events where created_by=target_user;
  delete from public.member_profiles where id=target_profile;

  -- audit_events reste append-only ; la suppression du compte anonymisera
  -- actor_user_id grâce à la clé étrangère ON DELETE SET NULL.
  return target_user;
end;
$$;
