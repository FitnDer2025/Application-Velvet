-- Velvet internal-only AI test agents — least-privilege visibility.

create or replace function public.can_manage_internal_test_agents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.has_role('admin') or public.has_role('direction')
  );
$$;

create or replace function public.can_access_internal_test_agents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.can_manage_internal_test_agents()
    or exists (
      select 1
      from public.internal_test_agent_viewers v
      where v.user_id=auth.uid() and v.enabled
    )
    or exists (
      select 1
      from public.internal_test_agents a
      where a.user_id=auth.uid()
    )
  );
$$;

-- Internal profiles remain invisible even to moderation/support/audit unless
-- the account is Admin/Direction or explicitly added to the internal cohort.
create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_profile_member(target_profile)
      or (
        (
          not exists (
            select 1
            from public.member_profiles internal_profile
            where internal_profile.id=target_profile
              and internal_profile.is_internal_test_agent
          )
          or public.can_access_internal_test_agents()
        )
        and (
          public.is_control_user()
          or (
            public.is_beta_approved()
            and exists (
              select 1 from public.member_profiles p
               where p.id = target_profile
                 and p.visibility in ('beta_members','published')
                 and (
                   (
                     public.is_internal_test_agent_user()
                     and public.is_internal_test_cohort_profile(p.id)
                   )
                   or not public.is_internal_test_agent_user()
                 )
                 and not exists (
                   select 1
                     from public.blocks b
                     join public.profile_members pm
                       on pm.user_id in (b.blocker_user_id,b.blocked_user_id)
                    where pm.profile_id = target_profile
                      and (
                        (b.blocker_user_id = auth.uid() and b.blocked_user_id = pm.user_id)
                        or
                        (b.blocked_user_id = auth.uid() and b.blocker_user_id = pm.user_id)
                      )
                 )
            )
          )
        )
      );
$$;

drop policy if exists internal_test_agent_settings_control_read on public.internal_test_agent_settings;
drop policy if exists internal_test_agent_viewers_control_read on public.internal_test_agent_viewers;
drop policy if exists internal_test_agents_control_read on public.internal_test_agents;
drop policy if exists internal_test_agent_state_control_read on public.internal_test_agent_conversation_state;
drop policy if exists internal_test_agent_runs_control_read on public.internal_test_agent_runs;

create policy internal_test_agent_settings_control_read
on public.internal_test_agent_settings
for select to authenticated
using (public.can_manage_internal_test_agents());

create policy internal_test_agent_viewers_control_read
on public.internal_test_agent_viewers
for select to authenticated
using (public.can_manage_internal_test_agents());

create policy internal_test_agents_control_read
on public.internal_test_agents
for select to authenticated
using (public.can_manage_internal_test_agents());

create policy internal_test_agent_state_control_read
on public.internal_test_agent_conversation_state
for select to authenticated
using (public.can_manage_internal_test_agents());

create policy internal_test_agent_runs_control_read
on public.internal_test_agent_runs
for select to authenticated
using (public.can_manage_internal_test_agents());

revoke all on function public.can_manage_internal_test_agents() from public;
revoke all on function public.can_access_internal_test_agents() from public;
