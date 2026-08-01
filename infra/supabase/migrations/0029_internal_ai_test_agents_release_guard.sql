-- Velvet internal-only AI test agents — release blocker and privileges.

-- Replace the release check with the existing checks plus a hard blocker for
-- any internal test agent left in the target database.
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
  select
    'internal_test_agents_present'::text,
    case when count(*)=0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Tous les agents IA internes et leurs profils doivent être supprimés avant une bêta externe ou une production.'::text
  from public.member_profiles p
  where p.is_internal_test_agent;

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

drop policy if exists internal_test_agent_settings_control_read on public.internal_test_agent_settings;
drop policy if exists internal_test_agent_viewers_control_read on public.internal_test_agent_viewers;
drop policy if exists internal_test_agents_control_read on public.internal_test_agents;
drop policy if exists internal_test_agent_state_control_read on public.internal_test_agent_conversation_state;
drop policy if exists internal_test_agent_runs_control_read on public.internal_test_agent_runs;

create policy internal_test_agent_settings_control_read
on public.internal_test_agent_settings
for select to authenticated
using (public.is_control_user());

create policy internal_test_agent_viewers_control_read
on public.internal_test_agent_viewers
for select to authenticated
using (public.is_control_user());

create policy internal_test_agents_control_read
on public.internal_test_agents
for select to authenticated
using (public.is_control_user());

create policy internal_test_agent_state_control_read
on public.internal_test_agent_conversation_state
for select to authenticated
using (public.is_control_user());

create policy internal_test_agent_runs_control_read
on public.internal_test_agent_runs
for select to authenticated
using (public.is_control_user());

revoke all on public.internal_test_agent_settings from anon,authenticated;
revoke all on public.internal_test_agent_viewers from anon,authenticated;
revoke all on public.internal_test_agents from anon,authenticated;
revoke all on public.internal_test_agent_conversation_state from anon,authenticated;
revoke all on public.internal_test_agent_runs from anon,authenticated;

grant select on public.internal_test_agent_settings to authenticated;
grant select on public.internal_test_agent_viewers to authenticated;
grant select on public.internal_test_agents to authenticated;
grant select on public.internal_test_agent_conversation_state to authenticated;
grant select on public.internal_test_agent_runs to authenticated;

revoke all on function public.can_access_internal_test_agents() from public;
revoke all on function public.is_internal_test_agent_user(uuid) from public;
revoke all on function public.is_internal_test_cohort_profile(uuid) from public;
revoke all on function public.guard_internal_test_agent_conversation() from public;
revoke all on function public.internal_prepare_test_agent_invite(text,text,uuid) from public;
revoke all on function public.internal_register_test_agent(uuid,text,text,jsonb,jsonb,uuid) from public;
revoke all on function public.internal_test_agent_open_conversation(uuid,uuid) from public;
revoke all on function public.control_add_internal_test_viewer(uuid) from public;
revoke all on function public.control_remove_internal_test_viewer(uuid) from public;
revoke all on function public.control_set_internal_test_agents_enabled(boolean) from public;
revoke all on function public.control_set_internal_test_agent_status(uuid,text) from public;
revoke all on function public.control_internal_test_agent_status() from public;
revoke all on function public.internal_purge_test_agent(uuid) from public;

grant execute on function public.internal_prepare_test_agent_invite(text,text,uuid) to service_role;
grant execute on function public.internal_register_test_agent(uuid,text,text,jsonb,jsonb,uuid) to service_role;
grant execute on function public.internal_test_agent_open_conversation(uuid,uuid) to service_role;
grant execute on function public.control_add_internal_test_viewer(uuid) to authenticated;
grant execute on function public.control_remove_internal_test_viewer(uuid) to authenticated;
grant execute on function public.control_set_internal_test_agents_enabled(boolean) to authenticated;
grant execute on function public.control_set_internal_test_agent_status(uuid,text) to authenticated;
grant execute on function public.control_internal_test_agent_status() to authenticated;
grant execute on function public.internal_purge_test_agent(uuid) to service_role;
