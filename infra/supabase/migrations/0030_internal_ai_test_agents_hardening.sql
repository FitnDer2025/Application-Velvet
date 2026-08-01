-- Velvet internal-only AI test agents — cleanup and revocation hardening.

alter table public.internal_test_agents
  drop constraint if exists internal_test_agents_profile_id_fkey;
alter table public.internal_test_agents
  alter column profile_id drop not null;
alter table public.internal_test_agents
  add constraint internal_test_agents_profile_id_fkey
  foreign key (profile_id) references public.member_profiles(id) on delete set null;

-- Removing a developer from the allowlist immediately closes access to every
-- existing direct conversation containing an internal agent.
create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id=target_conversation
      and cm.user_id=auth.uid()
      and cm.left_at is null
  )
  and (
    not exists (
      select 1
      from public.direct_conversation_profiles dcp
      join public.member_profiles pa on pa.id=dcp.profile_a_id
      join public.member_profiles pb on pb.id=dcp.profile_b_id
      where dcp.conversation_id=target_conversation
        and (pa.is_internal_test_agent or pb.is_internal_test_agent)
    )
    or public.can_access_internal_test_agents()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;

-- Keep the technical agent row until Auth deletion succeeds. If Auth deletion
-- fails, cleanup can be retried with the retained user id.
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
  update public.internal_test_agents
  set status='retired',profile_id=null,next_run_at=now(),updated_at=now()
  where id=target_agent_id;

  return target_user;
end;
$$;

revoke all on function public.internal_purge_test_agent(uuid) from public;
grant execute on function public.internal_purge_test_agent(uuid) to service_role;

-- A release stays blocked for both visible test profiles and incomplete
-- cleanup rows awaiting Auth deletion.
create or replace function public.control_beta_release_checks()
returns table (
  check_code text,
  status text,
  affected_count bigint,
  detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_control_user() then
    raise exception 'control_required';
  end if;

  return query
  with leftovers as (
    select 'profile:'||p.id::text as item
    from public.member_profiles p
    where p.is_internal_test_agent
    union all
    select 'agent:'||a.id::text as item
    from public.internal_test_agents a
  )
  select
    'internal_test_agents_present'::text,
    case when count(*)=0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Tous les agents IA internes, leurs profils et leurs comptes doivent être supprimés avant une bêta externe ou une production.'::text
  from leftovers;

  return query
  select
    'active_accounts_without_role'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Chaque compte actif doit posséder au moins un rôle non expiré.'::text
  from public.accounts a
  where a.status = 'active'
    and not exists (
      select 1 from public.account_roles ar
      where ar.user_id = a.user_id
        and (ar.expires_at is null or ar.expires_at > now())
    );

  return query
  select
    'profiles_pending_admission'::text,
    case when count(*) = 0 then 'passed' else 'warning' end,
    count(*)::bigint,
    'Profils encore bloqués dans le parcours d’inscription ou de validation photo.'::text
  from public.member_profiles p
  where coalesce(p.admission_status, 'pending_profile') <> 'approved';

  return query
  select
    'incomplete_couple_profiles'::text,
    case when count(*) = 0 then 'passed' else 'warning' end,
    count(*)::bigint,
    'Un couple publié doit réunir deux partenaires actifs.'::text
  from public.member_profiles p
  where p.profile_type = 'couple'
    and p.visibility in ('beta_members', 'published')
    and not p.is_internal_test_agent
    and (
      select count(*)
      from public.profile_members pm
      where pm.profile_id = p.id and pm.status = 'active'
    ) < 2;

  return query
  select
    'published_venues_incomplete'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Un établissement publié doit avoir une description et une ville.'::text
  from public.establishments e
  where e.visibility = 'published'
    and (nullif(btrim(e.description), '') is null or nullif(btrim(e.city), '') is null);

  return query
  select
    'events_over_capacity'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Les inscriptions confirmées ne doivent jamais dépasser la capacité publiée.'::text
  from public.events e
  where e.visibility = 'published'
    and (
      select coalesce(sum(r.places), 0)
      from public.event_registrations r
      where r.event_id = e.id and r.status in ('confirmed', 'checked_in')
    ) > e.capacity;

  return query
  select
    'overdue_data_requests'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Les demandes RGPD arrivées à échéance doivent être traitées.'::text
  from public.data_subject_requests d
  where d.status not in ('completed', 'rejected') and d.due_at < now();

  return query
  select
    'open_reports'::text,
    case when count(*) = 0 then 'passed' else 'warning' end,
    count(*)::bigint,
    'Signalements encore ouverts ou attribués à la modération.'::text
  from public.reports r
  where r.status in ('open', 'assigned');

  return query
  select
    'pending_organizers'::text,
    case when count(*) = 0 then 'passed' else 'warning' end,
    count(*)::bigint,
    'Demandes Organisateur privé en attente de décision.'::text
  from public.organizer_requests o
  where o.status = 'pending';
end;
$$;
