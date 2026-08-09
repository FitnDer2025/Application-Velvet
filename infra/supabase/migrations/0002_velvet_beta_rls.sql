-- Velvet BETA — Row Level Security

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_roles ar
     where ar.user_id = auth.uid()
       and ar.role_code = required_role
       and (ar.expires_at is null or ar.expires_at > now())
  );
$$;

create or replace function public.is_control_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin')
      or public.has_role('direction')
      or public.has_role('moderator')
      or public.has_role('support')
      or public.has_role('auditor');
$$;

create or replace function public.is_beta_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accounts a
     where a.user_id = auth.uid()
       and a.status = 'active'
  );
$$;

create or replace function public.is_profile_member(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_members pm
     where pm.profile_id = target_profile
       and pm.user_id = auth.uid()
       and pm.status = 'active'
  );
$$;

create or replace function public.is_venue_staff(target_venue uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or exists (
    select 1 from public.establishment_staff es
     where es.establishment_id = target_venue
       and es.user_id = auth.uid()
       and es.status = 'active'
  );
$$;

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
     where cm.conversation_id = target_conversation
       and cm.user_id = auth.uid()
       and cm.left_at is null
  );
$$;

create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_profile_member(target_profile)
      or public.is_control_user()
      or (
        public.is_beta_approved()
        and exists (
          select 1 from public.member_profiles p
           where p.id = target_profile
             and p.visibility in ('beta_members','published')
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
      );
$$;

create or replace function public.complete_beta_activation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='terms' and granted and withdrawn_at is null
  ) then raise exception 'terms_consent_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='privacy' and granted and withdrawn_at is null
  ) then raise exception 'privacy_acknowledgement_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='adult_declaration' and granted and withdrawn_at is null
  ) then raise exception 'adult_declaration_required'; end if;
  if not exists (
    select 1 from public.consent_records
     where user_id=auth.uid() and purpose='sensitive_profile' and granted and withdrawn_at is null
  ) then raise exception 'explicit_sensitive_data_consent_required'; end if;
  update public.accounts set status='active' where user_id=auth.uid() and status='pending_consent';
end;
$$;

alter table public.beta_invites enable row level security;
alter table public.accounts enable row level security;
alter table public.roles enable row level security;
alter table public.account_roles enable row level security;
alter table public.consent_records enable row level security;
alter table public.member_profiles enable row level security;
alter table public.profile_members enable row level security;
alter table public.individual_profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.establishments enable row level security;
alter table public.establishment_staff enable row level security;
alter table public.organizer_profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.recommendations enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.albums enable row level security;
alter table public.media_assets enable row level security;
alter table public.album_access_grants enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.data_subject_requests enable row level security;
alter table public.audit_events enable row level security;

create policy accounts_self_read on public.accounts
for select to authenticated using (user_id=auth.uid() or public.is_control_user());

create policy roles_authenticated_read on public.roles
for select to authenticated using (auth.uid() is not null);

create policy account_roles_self_read on public.account_roles
for select to authenticated using (user_id=auth.uid() or public.is_control_user());

create policy consent_self_read on public.consent_records
for select to authenticated using (user_id=auth.uid() or public.is_control_user());
create policy consent_self_insert on public.consent_records
for insert to authenticated with check (user_id=auth.uid());

create policy profiles_read on public.member_profiles
for select to authenticated using (public.can_view_profile(id));
create policy profiles_create on public.member_profiles
for insert to authenticated with check (public.is_beta_approved() and created_by=auth.uid());
create policy profiles_update on public.member_profiles
for update to authenticated using (public.is_profile_member(id) or created_by=auth.uid())
with check (public.is_profile_member(id) or created_by=auth.uid());
create policy profiles_delete on public.member_profiles
for delete to authenticated using (created_by=auth.uid() or public.has_role('admin'));

create policy profile_members_read on public.profile_members
for select to authenticated using (public.can_view_profile(profile_id));
create policy profile_members_create on public.profile_members
for insert to authenticated with check (
  user_id=auth.uid()
  and exists (select 1 from public.member_profiles p where p.id=profile_id and p.created_by=auth.uid())
);
create policy profile_members_manage on public.profile_members
for update to authenticated using (public.is_profile_member(profile_id) or user_id=auth.uid())
with check (public.is_profile_member(profile_id) or user_id=auth.uid());

create policy individual_profiles_read on public.individual_profiles
for select to authenticated using (public.can_view_profile(profile_id));
create policy individual_profiles_write on public.individual_profiles
for all to authenticated using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id));

create policy circles_owner on public.circles
for all to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
create policy circle_profiles_owner on public.circle_profiles
for all to authenticated
using (exists (select 1 from public.circles c where c.id=circle_id and c.owner_user_id=auth.uid()))
with check (exists (select 1 from public.circles c where c.id=circle_id and c.owner_user_id=auth.uid()));
create policy favorites_owner on public.favorites
for all to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());

create policy establishments_read on public.establishments
for select to authenticated using (
  (public.is_beta_approved() and visibility='published')
  or public.is_venue_staff(id)
  or public.is_control_user()
);
create policy establishments_staff_write on public.establishments
for update to authenticated using (public.is_venue_staff(id)) with check (public.is_venue_staff(id));
create policy establishment_staff_read on public.establishment_staff
for select to authenticated using (user_id=auth.uid() or public.is_venue_staff(establishment_id) or public.is_control_user());
create policy establishment_staff_control on public.establishment_staff
for all to authenticated using (public.is_venue_staff(establishment_id) or public.has_role('admin'))
with check (public.is_venue_staff(establishment_id) or public.has_role('admin'));

create policy organizer_read on public.organizer_profiles
for select to authenticated using (public.can_view_profile(member_profile_id) or public.is_control_user());
create policy organizer_owner_update on public.organizer_profiles
for update to authenticated using (public.is_profile_member(member_profile_id) or public.is_control_user())
with check (public.is_profile_member(member_profile_id) or public.is_control_user());

create policy events_read on public.events
for select to authenticated using (
  (public.is_beta_approved() and visibility='published')
  or created_by=auth.uid()
  or (establishment_id is not null and public.is_venue_staff(establishment_id))
  or public.is_control_user()
);
create policy events_create on public.events
for insert to authenticated with check (
  created_by=auth.uid()
  and (
    (owner_type='establishment' and public.is_venue_staff(establishment_id))
    or
    (owner_type='organizer' and exists (
      select 1 from public.organizer_profiles op
      where op.id=organizer_profile_id
        and op.status='approved'
        and public.is_profile_member(op.member_profile_id)
    ))
  )
);
create policy events_update on public.events
for update to authenticated using (
  created_by=auth.uid()
  or (establishment_id is not null and public.is_venue_staff(establishment_id))
  or public.is_control_user()
);

create policy registrations_self_read on public.event_registrations
for select to authenticated using (
  user_id=auth.uid()
  or exists (select 1 from public.events e where e.id=event_id and e.created_by=auth.uid())
  or public.is_control_user()
);
create policy registrations_self_insert on public.event_registrations
for insert to authenticated with check (public.is_beta_approved() and user_id=auth.uid());
create policy registrations_self_update on public.event_registrations
for update to authenticated using (
  user_id=auth.uid()
  or exists (select 1 from public.events e where e.id=event_id and e.created_by=auth.uid())
  or public.is_control_user()
);

create policy recommendations_read on public.recommendations
for select to authenticated using (public.is_beta_approved() and status='published' or public.is_control_user());
create policy recommendations_author_write on public.recommendations
for all to authenticated
using (public.is_profile_member(author_profile_id))
with check (public.is_profile_member(author_profile_id));

create policy conversations_member_read on public.conversations
for select to authenticated using (public.is_conversation_member(id) or public.is_control_user());
create policy conversations_create on public.conversations
for insert to authenticated with check (public.is_beta_approved() and created_by=auth.uid());
create policy conversation_members_read on public.conversation_members
for select to authenticated using (public.is_conversation_member(conversation_id) or public.is_control_user());
create policy conversation_members_create on public.conversation_members
for insert to authenticated with check (
  user_id=auth.uid()
  or exists (select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid())
);
create policy conversation_members_update on public.conversation_members
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy messages_member_read on public.messages
for select to authenticated using (public.is_conversation_member(conversation_id) or public.is_control_user());
create policy messages_member_insert on public.messages
for insert to authenticated with check (
  sender_user_id=auth.uid() and public.is_conversation_member(conversation_id)
);
create policy messages_sender_update on public.messages
for update to authenticated using (sender_user_id=auth.uid())
with check (sender_user_id=auth.uid());

create policy albums_metadata_read on public.albums
for select to authenticated using (public.can_view_profile(profile_id));
create policy albums_owner_write on public.albums
for all to authenticated using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id));
create policy media_authorized_read on public.media_assets
for select to authenticated using (
  public.is_profile_member(profile_id)
  or (
    visibility='profile' and moderation_status='approved' and public.can_view_profile(profile_id)
  )
  or (
    album_id is not null and exists (
      select 1 from public.album_access_grants g
       where g.album_id=media_assets.album_id
         and g.grantee_user_id=auth.uid()
         and g.revoked_at is null
         and (g.expires_at is null or g.expires_at>now())
    )
  )
  or public.is_control_user()
);
create policy media_owner_write on public.media_assets
for all to authenticated using (owner_user_id=auth.uid() or public.is_control_user())
with check (owner_user_id=auth.uid() or public.is_control_user());
create policy grants_authorized_read on public.album_access_grants
for select to authenticated using (
  grantee_user_id=auth.uid()
  or exists (select 1 from public.albums a where a.id=album_id and public.is_profile_member(a.profile_id))
  or public.is_control_user()
);
create policy grants_owner_write on public.album_access_grants
for all to authenticated
using (exists (select 1 from public.albums a where a.id=album_id and public.is_profile_member(a.profile_id)))
with check (exists (select 1 from public.albums a where a.id=album_id and public.is_profile_member(a.profile_id)));

create policy blocks_owner on public.blocks
for all to authenticated using (blocker_user_id=auth.uid()) with check (blocker_user_id=auth.uid());
create policy reports_create on public.reports
for insert to authenticated with check (reporter_user_id=auth.uid() and public.is_beta_approved());
create policy reports_self_or_control_read on public.reports
for select to authenticated using (reporter_user_id=auth.uid() or public.is_control_user());
create policy reports_control_update on public.reports
for update to authenticated using (public.is_control_user()) with check (public.is_control_user());

create policy dsr_owner on public.data_subject_requests
for select to authenticated using (user_id=auth.uid() or public.is_control_user());
create policy dsr_create on public.data_subject_requests
for insert to authenticated with check (user_id=auth.uid());
create policy dsr_control_update on public.data_subject_requests
for update to authenticated using (public.is_control_user()) with check (public.is_control_user());

create policy audit_control_read on public.audit_events
for select to authenticated using (public.is_control_user());

revoke all on public.beta_invites from anon, authenticated;
revoke insert,update,delete on public.roles from anon, authenticated;
revoke insert,update,delete on public.account_roles from anon, authenticated;
revoke update,delete on public.consent_records from anon, authenticated;
revoke insert,update,delete on public.audit_events from anon, authenticated;

grant execute on function public.complete_beta_activation() to authenticated;
