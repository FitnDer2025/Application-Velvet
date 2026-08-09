-- Velvet internal-only AI test agents — least-privilege grants for seeding.
--
-- The Cloudflare control endpoint authenticates the operator with their normal
-- Velvet session, then performs technical seed operations with the server-only
-- SUPABASE_SERVICE_ROLE_KEY. This migration grants only the direct database
-- capabilities used by that endpoint. It does not grant additional access to
-- anon or authenticated browser roles.

grant usage on schema public to service_role;

-- Used only to find an already-created internal account by its synthetic email.
grant select on table public.accounts to service_role;

-- Used to create/update the three approved synthetic fixture images and to
-- enumerate them during cleanup.
grant select, insert, update, delete
on table public.media_assets
to service_role;

-- The endpoint records enable/disable actions when possible.
grant insert on table public.audit_events to service_role;

-- Keep the privileged seed and cleanup functions server-only.
revoke all on function public.internal_prepare_test_agent_invite(text, text, uuid)
from public, anon, authenticated;
grant execute on function public.internal_prepare_test_agent_invite(text, text, uuid)
to service_role;

revoke all on function public.internal_register_test_agent(uuid, text, text, jsonb, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.internal_register_test_agent(uuid, text, text, jsonb, jsonb, uuid)
to service_role;

revoke all on function public.internal_purge_test_agent(uuid)
from public, anon, authenticated;
grant execute on function public.internal_purge_test_agent(uuid)
to service_role;
