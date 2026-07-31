-- Velvet — fondation conformité RGPD, sécurité et DSA.
-- Cette migration corrige les garde-fous techniques identifiés lors de l'audit du 31 juillet 2026.
-- Les durées préremplies sont des règles internes provisoires à valider dans l'AIPD et le registre.

-- ---------------------------------------------------------------------------
-- Authentification renforcée des espaces privilégiés
-- ---------------------------------------------------------------------------

create or replace function public.current_authentication_assurance_level()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;

create or replace function public.has_control_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.current_authentication_assurance_level() = 'aal2';
$$;

create or replace function public.is_control_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_control_mfa()
    and (
      public.has_role('admin')
      or public.has_role('direction')
      or public.has_role('moderator')
      or public.has_role('support')
      or public.has_role('auditor')
    );
$$;

create or replace function public.is_sensitive_data_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_control_mfa()
    and (public.has_role('admin') or public.has_role('moderator'));
$$;

revoke all on function public.current_authentication_assurance_level() from public, anon;
revoke all on function public.has_control_mfa() from public, anon;
revoke all on function public.is_sensitive_data_reviewer() from public, anon;
grant execute on function public.current_authentication_assurance_level() to authenticated;
grant execute on function public.has_control_mfa() to authenticated;
grant execute on function public.is_sensitive_data_reviewer() to authenticated;

-- ---------------------------------------------------------------------------
-- Consentements : seul le dernier choix chronologique fait foi
-- ---------------------------------------------------------------------------

create or replace function public.latest_consent_is_granted(
  target_user uuid,
  target_purpose text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted and c.withdrawn_at is null
    from public.consent_records c
    where c.user_id = target_user
      and c.purpose = target_purpose
    order by c.occurred_at desc, c.id desc
    limit 1
  ), false);
$$;

create or replace function public.complete_beta_activation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.latest_consent_is_granted(auth.uid(), 'terms') then
    raise exception 'terms_consent_required';
  end if;
  if not public.latest_consent_is_granted(auth.uid(), 'privacy') then
    raise exception 'privacy_acknowledgement_required';
  end if;
  if not public.latest_consent_is_granted(auth.uid(), 'adult_declaration') then
    raise exception 'adult_declaration_required';
  end if;
  if not public.latest_consent_is_granted(auth.uid(), 'sensitive_profile') then
    raise exception 'explicit_sensitive_data_consent_required';
  end if;
  update public.accounts
  set status = 'active', updated_at = now()
  where user_id = auth.uid() and status = 'pending_consent';
end;
$$;

grant execute on function public.complete_beta_activation() to authenticated;

-- ---------------------------------------------------------------------------
-- Visibilité explicite : public, privé sur autorisation, invisible
-- ---------------------------------------------------------------------------

alter table public.member_profiles
  add column if not exists privacy_mode text not null default 'private';

alter table public.member_profiles
  drop constraint if exists member_profiles_privacy_mode_check;
alter table public.member_profiles
  add constraint member_profiles_privacy_mode_check
  check (privacy_mode in ('public', 'private', 'invisible'));

-- Préserve le comportement des profils déjà publiés. Les nouveaux profils restent privés.
update public.member_profiles
set privacy_mode = 'public'
where privacy_mode = 'private'
  and visibility in ('beta_members', 'published')
  and published_at is not null;

create table if not exists public.profile_visibility_grants (
  owner_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  viewer_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  granted_by uuid not null references public.accounts(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (owner_profile_id, viewer_profile_id),
  check (owner_profile_id <> viewer_profile_id),
  check (expires_at is null or expires_at > granted_at)
);
create index if not exists profile_visibility_grants_viewer_idx
  on public.profile_visibility_grants(viewer_profile_id, revoked_at, expires_at);

alter table public.profile_visibility_grants enable row level security;

drop policy if exists profile_visibility_grants_owner_read on public.profile_visibility_grants;
create policy profile_visibility_grants_owner_read
on public.profile_visibility_grants for select to authenticated
using (
  public.is_profile_member(owner_profile_id)
  or public.is_profile_member(viewer_profile_id)
  or public.is_sensitive_data_reviewer()
);

drop policy if exists profile_visibility_grants_owner_write on public.profile_visibility_grants;
create policy profile_visibility_grants_owner_write
on public.profile_visibility_grants for all to authenticated
using (public.is_profile_member(owner_profile_id))
with check (public.is_profile_member(owner_profile_id) and granted_by = auth.uid());

grant select, insert, update, delete on public.profile_visibility_grants to authenticated;

create or replace function public.current_profile_id_for_user(target_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pm.profile_id
  from public.profile_members pm
  where pm.user_id = target_user and pm.status = 'active'
  order by pm.accepted_at desc nulls last, pm.created_at desc
  limit 1;
$$;

create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_profile_member(target_profile)
    or public.is_sensitive_data_reviewer()
    or (
      public.is_beta_approved()
      and public.profile_accepts_audience(target_profile, 'discover')
      and exists (
        select 1
        from public.member_profiles p
        where p.id = target_profile
          and p.visibility in ('beta_members', 'published')
          and p.lifecycle_state = 'active'
          and p.privacy_mode <> 'invisible'
          and (
            p.privacy_mode = 'public'
            or exists (
              select 1
              from public.profile_visibility_grants g
              where g.owner_profile_id = p.id
                and g.viewer_profile_id = public.current_profile_id_for_user(auth.uid())
                and g.revoked_at is null
                and (g.expires_at is null or g.expires_at > now())
            )
          )
          and not exists (
            select 1
            from public.blocks b
            join public.profile_members pm
              on pm.user_id in (b.blocker_user_id, b.blocked_user_id)
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

create or replace function public.can_contact_user(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_sensitive_data_reviewer()
    or target_user = auth.uid()
    or exists (
      select 1
      from public.profile_members pm
      join public.member_profiles mp on mp.id = pm.profile_id
      where pm.user_id = target_user
        and pm.status = 'active'
        and mp.admission_status = 'approved'
        and public.can_view_profile(mp.id)
        and public.profile_accepts_audience(mp.id, 'contact')
    );
$$;

revoke all on function public.current_profile_id_for_user(uuid) from public, anon;
grant execute on function public.current_profile_id_for_user(uuid) to authenticated;

create or replace function public.set_my_profile_privacy_mode(target_mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile uuid;
begin
  if target_mode not in ('public', 'private', 'invisible') then
    raise exception 'invalid_privacy_mode';
  end if;
  target_profile := public.current_profile_id_for_user(auth.uid());
  if target_profile is null then raise exception 'member_profile_required'; end if;
  update public.member_profiles
  set privacy_mode = target_mode, updated_at = now()
  where id = target_profile;
  insert into public.audit_events(
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'profile_privacy_mode_changed', 'member_profile', target_profile,
    jsonb_build_object('privacy_mode', target_mode)
  );
  return target_mode;
end;
$$;

create or replace function public.withdraw_my_consent(target_purpose text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile uuid;
  now_value timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_purpose not in (
    'sensitive_profile', 'precise_location', 'marketing_velvet', 'marketing_partners'
  ) then
    raise exception 'consent_not_withdrawable_here';
  end if;

  insert into public.consent_records(
    user_id, purpose, document_version, granted, source,
    occurred_at, withdrawn_at, evidence
  ) values (
    auth.uid(), target_purpose, 'velvet-consent-withdrawal-v1', false,
    'privacy_center', now_value, now_value,
    jsonb_build_object('method', 'authenticated_user_action')
  );

  if target_purpose = 'precise_location' then
    update public.member_location_settings
    set enabled = false,
        latitude_bucket = null,
        longitude_bucket = null,
        last_used_at = null,
        updated_at = now_value
    where user_id = auth.uid();
  elsif target_purpose = 'sensitive_profile' then
    target_profile := public.current_profile_id_for_user(auth.uid());
    if target_profile is not null then
      update public.member_profiles
      set privacy_mode = 'invisible', updated_at = now_value
      where id = target_profile;
    end if;
  end if;

  insert into public.audit_events(
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'consent_withdrawn', 'consent', null,
    jsonb_build_object('purpose', target_purpose)
  );
end;
$$;

create or replace function public.grant_my_sensitive_profile_consent(
  target_document_version text,
  target_evidence jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(btrim(target_document_version), '') is null then
    raise exception 'document_version_required';
  end if;
  insert into public.consent_records(
    user_id, purpose, document_version, granted, source, evidence
  ) values (
    auth.uid(), 'sensitive_profile', target_document_version, true,
    'privacy_center',
    jsonb_build_object('method', 'explicit_authenticated_confirmation')
      || coalesce(target_evidence, '{}'::jsonb)
  );
end;
$$;

create or replace function public.my_consent_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(purpose, granted), '{}'::jsonb)
  from (
    select distinct on (c.purpose)
      c.purpose,
      (c.granted and c.withdrawn_at is null) as granted
    from public.consent_records c
    where c.user_id = auth.uid()
    order by c.purpose, c.occurred_at desc, c.id desc
  ) latest;
$$;

revoke all on function public.set_my_profile_privacy_mode(text) from public, anon;
revoke all on function public.withdraw_my_consent(text) from public, anon;
revoke all on function public.grant_my_sensitive_profile_consent(text,jsonb) from public, anon;
revoke all on function public.my_consent_state() from public, anon;
grant execute on function public.set_my_profile_privacy_mode(text) to authenticated;
grant execute on function public.withdraw_my_consent(text) to authenticated;
grant execute on function public.grant_my_sensitive_profile_consent(text,jsonb) to authenticated;
grant execute on function public.my_consent_state() to authenticated;

-- ---------------------------------------------------------------------------
-- Exercice des droits RGPD
-- ---------------------------------------------------------------------------

alter table public.data_subject_requests
  add column if not exists details text,
  add column if not exists identity_verified_at timestamptz,
  add column if not exists assigned_to uuid references public.accounts(user_id) on delete set null,
  add column if not exists decision_reason text,
  add column if not exists deadline_extended_to timestamptz,
  add column if not exists deadline_extension_reason text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.data_subject_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.data_subject_requests(id) on delete cascade,
  actor_user_id uuid references public.accounts(user_id) on delete set null,
  event_type text not null check (event_type in (
    'received', 'identity_verified', 'assigned', 'processing', 'extended',
    'completed', 'rejected', 'message_sent'
  )),
  note text,
  occurred_at timestamptz not null default now()
);
create index if not exists data_subject_request_events_request_idx
  on public.data_subject_request_events(request_id, occurred_at);
alter table public.data_subject_request_events enable row level security;

drop policy if exists dsr_events_owner_or_control_read on public.data_subject_request_events;
create policy dsr_events_owner_or_control_read
on public.data_subject_request_events for select to authenticated
using (
  exists (
    select 1 from public.data_subject_requests d
    where d.id = request_id
      and (d.user_id = auth.uid() or public.is_control_user())
  )
);

grant select on public.data_subject_request_events to authenticated;

create or replace function public.create_my_data_subject_request(
  target_type text,
  target_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if target_type not in (
    'access', 'portability', 'rectification', 'erasure',
    'restriction', 'objection', 'withdraw_consent'
  ) then
    raise exception 'invalid_data_subject_request';
  end if;
  insert into public.data_subject_requests(user_id, request_type, details)
  values (auth.uid(), target_type, nullif(left(btrim(target_details), 4000), ''))
  returning id into saved_id;
  insert into public.data_subject_request_events(
    request_id, actor_user_id, event_type, note
  ) values (saved_id, auth.uid(), 'received', 'Demande créée depuis le centre de confidentialité.');
  return saved_id;
end;
$$;

revoke all on function public.create_my_data_subject_request(text,text) from public, anon;
grant execute on function public.create_my_data_subject_request(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Signalements, preuves, décisions motivées et recours DSA
-- ---------------------------------------------------------------------------

alter table public.reports
  drop constraint if exists reports_reporter_user_id_fkey;
alter table public.reports
  alter column reporter_user_id drop not null;
alter table public.reports
  add constraint reports_reporter_user_id_fkey
  foreign key (reporter_user_id) references public.accounts(user_id) on delete set null;

alter table public.reports
  drop constraint if exists reports_status_check;
alter table public.reports
  add constraint reports_status_check
  check (status in (
    'open', 'assigned', 'under_review', 'actioned',
    'resolved', 'dismissed', 'appealed'
  ));

alter table public.reports
  add column if not exists source text not null default 'in_app',
  add column if not exists subject_url text,
  add column if not exists legal_basis text,
  add column if not exists good_faith_declaration boolean not null default true,
  add column if not exists assigned_to uuid references public.accounts(user_id) on delete set null,
  add column if not exists decided_by uuid references public.accounts(user_id) on delete set null,
  add column if not exists decision text,
  add column if not exists decision_reason text,
  add column if not exists action_taken text,
  add column if not exists statement_of_reasons jsonb,
  add column if not exists evidence_retention_until timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.moderation_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  subject_hash text not null check (char_length(subject_hash) = 64),
  snapshot_ciphertext text,
  encryption_status text not null default 'pending_key'
    check (encryption_status in ('encrypted', 'pending_key', 'metadata_only')),
  encryption_key_version text,
  captured_by uuid references public.accounts(user_id) on delete set null,
  captured_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '5 years'),
  legal_hold boolean not null default false,
  storage_path text
);
create index if not exists moderation_evidence_report_idx
  on public.moderation_evidence(report_id, captured_at);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete restrict,
  actor_user_id uuid references public.accounts(user_id) on delete set null,
  action_type text not null check (action_type in (
    'assign', 'restrict_visibility', 'remove_content', 'suspend_account',
    'close_account', 'restore_content', 'dismiss', 'escalate',
    'preserve_evidence', 'notify_author', 'notify_reporter'
  )),
  reason text not null,
  legal_basis text,
  statement_of_reasons jsonb not null default '{}'::jsonb,
  affected_entity_type text,
  affected_entity_id uuid,
  occurred_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists moderation_actions_report_idx
  on public.moderation_actions(report_id, occurred_at);

create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete restrict,
  appellant_user_id uuid references public.accounts(user_id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 4000),
  status text not null default 'received'
    check (status in ('received', 'under_review', 'upheld', 'reversed', 'closed')),
  reviewed_by uuid references public.accounts(user_id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.illegal_content_notices (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  notifier_email citext not null,
  notifier_name text,
  notifier_organization text,
  subject_url text not null,
  subject_type text,
  subject_id uuid,
  explanation text not null check (char_length(explanation) between 20 and 10000),
  legal_basis text,
  good_faith_declaration boolean not null,
  status text not null default 'received'
    check (status in ('received', 'under_review', 'actioned', 'dismissed', 'closed')),
  assigned_to uuid references public.accounts(user_id) on delete set null,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists illegal_content_notices_status_idx
  on public.illegal_content_notices(status, created_at);

alter table public.moderation_evidence enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.illegal_content_notices enable row level security;

drop policy if exists moderation_evidence_reviewer_read on public.moderation_evidence;
create policy moderation_evidence_reviewer_read
on public.moderation_evidence for select to authenticated
using (public.is_sensitive_data_reviewer());

drop policy if exists moderation_actions_control_read on public.moderation_actions;
create policy moderation_actions_control_read
on public.moderation_actions for select to authenticated
using (public.is_control_user());

drop policy if exists moderation_appeals_owner_read on public.moderation_appeals;
create policy moderation_appeals_owner_read
on public.moderation_appeals for select to authenticated
using (appellant_user_id = auth.uid() or public.is_control_user());

drop policy if exists moderation_appeals_owner_create on public.moderation_appeals;
create policy moderation_appeals_owner_create
on public.moderation_appeals for insert to authenticated
with check (appellant_user_id = auth.uid());

drop policy if exists illegal_content_notices_control_read on public.illegal_content_notices;
create policy illegal_content_notices_control_read
on public.illegal_content_notices for select to authenticated
using (public.is_control_user());

grant select on public.moderation_evidence, public.moderation_actions to authenticated;
grant select, insert on public.moderation_appeals to authenticated;
grant select on public.illegal_content_notices to authenticated;

create or replace function public.prevent_compliance_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'compliance_record_is_append_only';
end;
$$;

drop trigger if exists moderation_evidence_immutable on public.moderation_evidence;
create trigger moderation_evidence_immutable
before update or delete on public.moderation_evidence
for each row execute function public.prevent_compliance_record_mutation();

drop trigger if exists moderation_actions_immutable on public.moderation_actions;
create trigger moderation_actions_immutable
before update or delete on public.moderation_actions
for each row execute function public.prevent_compliance_record_mutation();

create or replace function public.submit_member_profile_report(
  target_profile uuid,
  target_category text,
  target_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_report uuid;
  snapshot jsonb;
  snapshot_hash text;
  evidence_key text;
  encrypted_snapshot text;
begin
  if auth.uid() is null or not public.is_beta_approved() then
    raise exception 'member_access_required';
  end if;
  if nullif(btrim(target_category), '') is null then
    raise exception 'report_category_required';
  end if;
  if not exists (select 1 from public.member_profiles where id = target_profile) then
    raise exception 'target_profile_unavailable';
  end if;

  insert into public.reports(
    reporter_user_id, subject_type, subject_id, category, description,
    source, good_faith_declaration, evidence_retention_until
  ) values (
    auth.uid(), 'profile', target_profile, left(btrim(target_category), 80),
    nullif(left(btrim(target_description), 2000), ''),
    'in_app', true, now() + interval '5 years'
  ) returning id into saved_report;

  select jsonb_build_object(
    'profile', to_jsonb(p),
    'individual_profiles', coalesce((
      select jsonb_agg(to_jsonb(ip))
      from public.individual_profiles ip where ip.profile_id = p.id
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'storage_path', m.storage_path,
        'media_type', m.media_type,
        'visibility', m.visibility,
        'moderation_status', m.moderation_status,
        'checksum', m.checksum,
        'created_at', m.created_at
      )) from public.media_assets m where m.profile_id = p.id
    ), '[]'::jsonb),
    'captured_at', now()
  ) into snapshot
  from public.member_profiles p where p.id = target_profile;

  snapshot_hash := encode(extensions.digest(snapshot::text, 'sha256'), 'hex');
  begin
    execute $vault$
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'moderation_evidence_key'
      order by created_at desc
      limit 1
    $vault$ into evidence_key;
  exception when others then
    evidence_key := null;
  end;

  if nullif(evidence_key, '') is not null then
    encrypted_snapshot := encode(
      extensions.pgp_sym_encrypt(snapshot::text, evidence_key, 'cipher-algo=aes256'),
      'base64'
    );
  end if;

  insert into public.moderation_evidence(
    report_id, subject_hash, snapshot_ciphertext, encryption_status,
    encryption_key_version, captured_by
  ) values (
    saved_report,
    snapshot_hash,
    encrypted_snapshot,
    case when encrypted_snapshot is null then 'pending_key' else 'encrypted' end,
    case when encrypted_snapshot is null then null else 'vault:moderation_evidence_key' end,
    auth.uid()
  );

  insert into public.audit_events(
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'profile_report_submitted', 'report', saved_report,
    jsonb_build_object('subject_profile_id', target_profile, 'category', target_category)
  );

  return saved_report;
end;
$$;

create or replace function public.submit_illegal_content_notice(
  target_email text,
  target_name text,
  target_organization text,
  target_url text,
  target_subject_type text,
  target_subject_id uuid,
  target_explanation text,
  target_legal_basis text,
  target_good_faith boolean
)
returns table(notice_id uuid, reference_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  saved_reference text;
begin
  if target_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'valid_email_required';
  end if;
  if nullif(btrim(target_url), '') is null
    or char_length(btrim(target_explanation)) < 20
    or target_good_faith is not true then
    raise exception 'complete_illegal_content_notice_required';
  end if;
  saved_reference := 'VEL-' || to_char(now(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.illegal_content_notices(
    reference_code, notifier_email, notifier_name, notifier_organization,
    subject_url, subject_type, subject_id, explanation, legal_basis,
    good_faith_declaration
  ) values (
    saved_reference, lower(btrim(target_email))::citext,
    nullif(left(btrim(target_name), 160), ''),
    nullif(left(btrim(target_organization), 200), ''),
    left(btrim(target_url), 2000), nullif(left(btrim(target_subject_type), 80), ''),
    target_subject_id, left(btrim(target_explanation), 10000),
    nullif(left(btrim(target_legal_basis), 4000), ''), true
  ) returning id into saved_id;
  return query select saved_id, saved_reference;
end;
$$;

create or replace function public.control_decide_report(
  target_report uuid,
  target_decision text,
  target_reason text,
  target_action text,
  target_legal_basis text default null,
  target_statement jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_row public.reports;
begin
  if not public.is_sensitive_data_reviewer() then
    raise exception 'moderator_mfa_required';
  end if;
  if target_decision not in ('actioned', 'dismissed', 'resolved')
    or target_action not in (
      'restrict_visibility', 'remove_content', 'suspend_account',
      'close_account', 'restore_content', 'dismiss', 'escalate'
    )
    or char_length(btrim(target_reason)) < 10 then
    raise exception 'complete_moderation_decision_required';
  end if;

  select * into report_row from public.reports where id = target_report for update;
  if report_row.id is null then raise exception 'report_not_found'; end if;

  update public.reports
  set status = target_decision,
      decision = target_decision,
      decision_reason = left(btrim(target_reason), 4000),
      action_taken = target_action,
      legal_basis = coalesce(nullif(left(btrim(target_legal_basis), 4000), ''), legal_basis),
      statement_of_reasons = coalesce(target_statement, '{}'::jsonb),
      decided_by = auth.uid(),
      resolved_at = case when target_decision in ('resolved', 'dismissed') then now() else resolved_at end,
      updated_at = now()
  where id = target_report;

  insert into public.moderation_actions(
    report_id, actor_user_id, action_type, reason, legal_basis,
    statement_of_reasons, affected_entity_type, affected_entity_id
  ) values (
    target_report, auth.uid(), target_action, left(btrim(target_reason), 4000),
    nullif(left(btrim(target_legal_basis), 4000), ''),
    coalesce(target_statement, '{}'::jsonb), report_row.subject_type, report_row.subject_id
  );

  insert into public.audit_events(
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), 'user', 'moderation_decision_recorded', 'report', target_report,
    jsonb_build_object('decision', target_decision, 'action_taken', target_action)
  );
end;
$$;

revoke all on function public.submit_member_profile_report(uuid,text,text) from public, anon;
revoke all on function public.submit_illegal_content_notice(text,text,text,text,text,uuid,text,text,boolean) from public;
revoke all on function public.control_decide_report(uuid,text,text,text,text,jsonb) from public, anon;
grant execute on function public.submit_member_profile_report(uuid,text,text) to authenticated;
grant execute on function public.submit_illegal_content_notice(text,text,text,text,text,uuid,text,text,boolean) to anon, authenticated;
grant execute on function public.control_decide_report(uuid,text,text,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Registre de sécurité, violations et échéance des 72 heures
-- ---------------------------------------------------------------------------

create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'contained', 'investigating', 'resolved', 'closed')),
  title text not null,
  description text not null,
  detected_at timestamptz not null,
  contained_at timestamptz,
  resolved_at timestamptz,
  incident_lead uuid references public.accounts(user_id) on delete set null,
  created_by uuid references public.accounts(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_data_breaches (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null unique references public.security_incidents(id) on delete restrict,
  data_categories text[] not null default '{}',
  sensitive_data_involved boolean not null default false,
  approximate_people_affected integer check (approximate_people_affected is null or approximate_people_affected >= 0),
  risk_level text not null check (risk_level in ('unlikely', 'risk', 'high_risk')),
  risk_assessment text not null,
  cnil_notification_required boolean,
  cnil_notification_deadline timestamptz generated always as (
    detected_at + interval '72 hours'
  ) stored,
  detected_at timestamptz not null,
  cnil_notified_at timestamptz,
  data_subject_notification_required boolean,
  data_subjects_notified_at timestamptz,
  non_notification_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.breach_notification_events (
  id uuid primary key default gen_random_uuid(),
  breach_id uuid not null references public.personal_data_breaches(id) on delete restrict,
  recipient_type text not null check (recipient_type in ('cnil', 'data_subjects', 'processor', 'insurer', 'legal')),
  recipient_reference text,
  sent_by uuid references public.accounts(user_id) on delete set null,
  sent_at timestamptz not null default now(),
  evidence_storage_path text,
  note text
);

alter table public.security_incidents enable row level security;
alter table public.personal_data_breaches enable row level security;
alter table public.breach_notification_events enable row level security;

create policy security_incidents_control
on public.security_incidents for all to authenticated
using (public.is_control_user()) with check (public.is_control_user());
create policy personal_data_breaches_control
on public.personal_data_breaches for all to authenticated
using (public.is_control_user()) with check (public.is_control_user());
create policy breach_notification_events_control
on public.breach_notification_events for all to authenticated
using (public.is_control_user()) with check (public.is_control_user());

grant select, insert, update on public.security_incidents to authenticated;
grant select, insert, update on public.personal_data_breaches to authenticated;
grant select, insert on public.breach_notification_events to authenticated;

-- ---------------------------------------------------------------------------
-- Conservation et effacement physique des objets médias
-- ---------------------------------------------------------------------------

create table if not exists public.data_retention_policies (
  code text primary key,
  data_category text not null,
  active_retention interval,
  post_closure_retention interval,
  deletion_method text not null,
  legal_basis text,
  owner_role text not null,
  requires_legal_validation boolean not null default true,
  reviewed_at timestamptz,
  next_review_at timestamptz,
  notes text
);

insert into public.data_retention_policies(
  code, data_category, active_retention, post_closure_retention,
  deletion_method, legal_basis, owner_role, requires_legal_validation, notes
) values
  ('account_profile', 'Compte, profil et préférences sensibles', null, interval '30 days', 'hard_delete_and_storage_purge', 'contrat/consentement explicite', 'privacy_lead', true, 'Délai de rétractation interne de 30 jours.'),
  ('precise_location', 'Coordonnées de localisation', interval '24 hours', interval '0 days', 'immediate_delete_on_withdrawal', 'consentement', 'privacy_lead', true, 'Velvet ne conserve que des coordonnées arrondies pour le service de proximité.'),
  ('consent_evidence', 'Preuves de consentement', null, interval '5 years', 'restricted_archive_then_delete', 'preuve de conformité', 'privacy_lead', true, 'Durée à valider selon la prescription applicable.'),
  ('moderation_evidence', 'Signalements et preuves de modération', null, interval '5 years', 'encrypted_restricted_archive', 'obligation légale/intérêt légitime', 'trust_safety_lead', true, 'Le legal hold suspend la purge.'),
  ('security_logs', 'Journaux de sécurité et accès privilégiés', interval '12 months', interval '0 days', 'automatic_delete', 'sécurité/intérêt légitime', 'security_lead', true, 'Accès strictement limité et contrôlé.'),
  ('encrypted_backups', 'Sauvegardes chiffrées', interval '35 days', interval '0 days', 'provider_rotation', 'continuité et sécurité', 'security_lead', true, 'À aligner avec le contrat du prestataire.'),
  ('security_incidents', 'Registre des incidents et violations', null, interval '5 years', 'restricted_archive_then_delete', 'obligation de documentation', 'security_lead', true, 'Durée à valider avec le DPO/conseil.')
on conflict (code) do update set
  data_category = excluded.data_category,
  active_retention = excluded.active_retention,
  post_closure_retention = excluded.post_closure_retention,
  deletion_method = excluded.deletion_method,
  legal_basis = excluded.legal_basis,
  owner_role = excluded.owner_role,
  requires_legal_validation = excluded.requires_legal_validation,
  notes = excluded.notes;

create table if not exists public.storage_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null default 'velvet-media',
  storage_path text not null,
  reason text not null,
  subject_user_id uuid,
  subject_profile_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'legal_hold')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (bucket_name, storage_path)
);
create index if not exists storage_deletion_queue_claim_idx
  on public.storage_deletion_queue(status, next_attempt_at, created_at);

alter table public.data_retention_policies enable row level security;
alter table public.storage_deletion_queue enable row level security;

create policy retention_policies_control_read
on public.data_retention_policies for select to authenticated
using (public.is_control_user());
create policy storage_deletion_queue_control_read
on public.storage_deletion_queue for select to authenticated
using (public.is_control_user());

grant select on public.data_retention_policies, public.storage_deletion_queue to authenticated;

create or replace function public.purge_expired_profile_deletions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row record;
  account_id uuid;
  account_ids uuid[];
  purged integer := 0;
begin
  for action_row in
    select id, profile_id
    from public.profile_lifecycle_actions
    where action_type = 'delete'
      and status = 'confirmed'
      and execute_after <= now()
    for update skip locked
  loop
    select array_agg(user_id) into account_ids
    from public.profile_members
    where profile_id = action_row.profile_id and status = 'active';

    insert into public.storage_deletion_queue(
      bucket_name, storage_path, reason, subject_user_id, subject_profile_id
    )
    select 'velvet-media', m.storage_path, 'profile_erasure', m.owner_user_id, m.profile_id
    from public.media_assets m
    where m.profile_id = action_row.profile_id
    on conflict (bucket_name, storage_path) do nothing;

    insert into public.storage_deletion_queue(
      bucket_name, storage_path, reason, subject_user_id, subject_profile_id
    )
    select 'velvet-media', a.storage_path, 'account_erasure', a.uploader_user_id, action_row.profile_id
    from public.message_attachments a
    where a.uploader_user_id = any(coalesce(account_ids, '{}'::uuid[]))
    on conflict (bucket_name, storage_path) do nothing;

    -- Les signalements et leurs preuves sont conservés sous accès restreint.
    update public.reports
    set reporter_user_id = null,
        updated_at = now()
    where reporter_user_id = any(coalesce(account_ids, '{}'::uuid[]));

    delete from public.member_profiles where id = action_row.profile_id;

    foreach account_id in array coalesce(account_ids, '{}'::uuid[])
    loop
      delete from public.messages where sender_user_id = account_id;
      delete from public.conversations where created_by = account_id;
      delete from public.events where created_by = account_id;
      delete from public.establishment_drafts where updated_by = account_id;
      delete from auth.users target
      where target.id = account_id
        and not exists (
          select 1 from public.profile_members remaining
          where remaining.user_id = account_id and remaining.status = 'active'
        );
    end loop;

    insert into public.audit_events(
      actor_user_id, actor_type, action, entity_type, entity_id, metadata
    ) values (
      null, 'system', 'profile_erasure_database_completed',
      'member_profile', action_row.profile_id,
      jsonb_build_object('storage_purge_queued', true)
    );
    purged := purged + 1;
  end loop;
  return purged;
end;
$$;

revoke all on function public.purge_expired_profile_deletions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contrôles de publication dédiés à la conformité
-- ---------------------------------------------------------------------------

create or replace function public.control_compliance_checks()
returns table(
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
  if not public.is_control_user() then raise exception 'control_mfa_required'; end if;

  return query
  select 'overdue_data_subject_requests'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Toute demande RGPD échue doit être traitée ou faire l’objet d’une prolongation motivée.'::text
  from public.data_subject_requests d
  where d.status not in ('completed', 'rejected')
    and coalesce(d.deadline_extended_to, d.due_at) < now();

  return query
  select 'unencrypted_moderation_evidence'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'La clé Vault moderation_evidence_key doit être configurée avant tout signalement réel.'::text
  from public.moderation_evidence e
  where e.encryption_status <> 'encrypted';

  return query
  select 'storage_deletions_failed'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Les médias en échec d’effacement doivent être retraités et vérifiés.'::text
  from public.storage_deletion_queue q
  where q.status = 'failed';

  return query
  select 'cnil_notification_deadline_at_risk'::text,
    case when count(*) = 0 then 'passed' else 'failed' end,
    count(*)::bigint,
    'Une violation nécessitant une notification CNIL approche ou dépasse le délai de 72 heures.'::text
  from public.personal_data_breaches b
  where b.cnil_notification_required is true
    and b.cnil_notified_at is null
    and b.cnil_notification_deadline <= now() + interval '12 hours';

  return query
  select 'retention_policies_unvalidated'::text,
    case when count(*) = 0 then 'passed' else 'warning' end,
    count(*)::bigint,
    'Les durées internes doivent être validées dans l’AIPD et le registre des traitements.'::text
  from public.data_retention_policies p
  where p.requires_legal_validation and p.reviewed_at is null;
end;
$$;

revoke all on function public.control_compliance_checks() from public, anon;
grant execute on function public.control_compliance_checks() to authenticated;
