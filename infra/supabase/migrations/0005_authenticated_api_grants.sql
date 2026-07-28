-- The project was created with "Automatically expose new tables" disabled.
-- RLS remains the authorization layer, but authenticated API clients still
-- need explicit table privileges before PostgREST can evaluate those policies.

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;

grant select on public.accounts to authenticated;
grant select on public.roles to authenticated;
grant select on public.account_roles to authenticated;
grant select, insert on public.consent_records to authenticated;

grant select, insert, update, delete on public.member_profiles to authenticated;
grant select, insert, update on public.profile_members to authenticated;
grant select, insert, update, delete on public.individual_profiles to authenticated;
grant select, insert, update, delete on public.circles to authenticated;
grant select, insert, update, delete on public.circle_profiles to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;

grant select, update on public.establishments to authenticated;
grant select, insert, update, delete on public.establishment_staff to authenticated;
grant select, update on public.organizer_profiles to authenticated;

grant select, insert, update on public.events to authenticated;
grant select, insert, update on public.event_registrations to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;

grant select, insert on public.conversations to authenticated;
grant select, insert, update on public.conversation_members to authenticated;
grant select, insert, update on public.messages to authenticated;

grant select, insert, update, delete on public.albums to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert, update, delete on public.album_access_grants to authenticated;

grant select, insert, update, delete on public.blocks to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.data_subject_requests to authenticated;
grant select on public.audit_events to authenticated;

revoke all on function public.complete_beta_activation() from public;
grant execute on function public.complete_beta_activation() to authenticated;

-- The invitation list remains server-only.
revoke all on public.beta_invites from anon, authenticated;
