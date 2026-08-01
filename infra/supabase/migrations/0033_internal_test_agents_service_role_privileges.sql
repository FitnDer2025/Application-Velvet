-- Velvet internal-only AI test agents — explicit server privileges.
--
-- The control endpoint uses SUPABASE_SERVICE_ROLE_KEY and never exposes it to
-- the browser. These grants are restricted to the server role and do not open
-- any internal AI table to authenticated members or anonymous visitors.

revoke all on table public.internal_test_agent_settings from anon, authenticated;
revoke all on table public.internal_test_agent_viewers from anon, authenticated;
revoke all on table public.internal_test_agents from anon, authenticated;
revoke all on table public.internal_test_agent_conversation_state from anon, authenticated;
revoke all on table public.internal_test_agent_runs from anon, authenticated;

grant select, insert, update, delete
on table public.internal_test_agent_settings
     to service_role;

grant select, insert, update, delete
on table public.internal_test_agent_viewers
     to service_role;

grant select, insert, update, delete
on table public.internal_test_agents
     to service_role;

grant select, insert, update, delete
on table public.internal_test_agent_conversation_state
     to service_role;

grant select, insert, update, delete
on table public.internal_test_agent_runs
     to service_role;

-- RLS remains enabled. The service_role JWT is the only API role allowed to
-- bypass it for these technical operations.
