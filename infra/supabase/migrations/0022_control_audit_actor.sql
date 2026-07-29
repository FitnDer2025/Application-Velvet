-- Velvet BETA — les actions opérées depuis Velvet Control possèdent
-- une identité d'audit distincte des actions membres et système.

alter table public.audit_events
  drop constraint if exists audit_events_actor_type_check;

alter table public.audit_events
  add constraint audit_events_actor_type_check
  check (actor_type in ('user','system','ai_agent','control'));
