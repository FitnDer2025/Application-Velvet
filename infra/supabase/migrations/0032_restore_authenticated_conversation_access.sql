-- Velvet — restore authenticated access to shared RLS helper functions.
--
-- Migration 0030 intentionally removed the implicit PUBLIC execute privilege
-- from is_conversation_member(uuid), but did not restore it to authenticated.
-- Supabase RLS policies that call this helper therefore reject normal member
-- conversation reads. The iOS initial synchronization awaits messaging with
-- the directory and profile history, so that single permission failure can
-- leave all three sections empty.
--
-- Keep anonymous access revoked and grant only the roles that legitimately
-- evaluate these helpers.

revoke all on function public.is_conversation_member(uuid) from anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to service_role;

-- Policies on the internal technical tables use this function directly.
-- Granting EXECUTE does not grant access to the tables: the function still
-- returns true only for Admin or Direction accounts.
revoke all on function public.can_manage_internal_test_agents() from anon;
grant execute on function public.can_manage_internal_test_agents() to authenticated;
grant execute on function public.can_manage_internal_test_agents() to service_role;

-- Explicitly preserve the profile visibility helper for authenticated clients.
-- CREATE OR REPLACE normally retains privileges, but this makes the expected
-- contract durable and prevents the same regression in future hardening work.
revoke all on function public.can_view_profile(uuid) from anon;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to service_role;
