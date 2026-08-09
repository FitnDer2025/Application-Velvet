-- Velvet BETA — Supabase source of truth
-- Target region: eu-west-3 (Paris)
-- Apply only to a new Supabase project. The legacy PostgreSQL migrations are
-- intentionally kept separate while the authentication architecture migrates.

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  code_hash text not null,
  intended_role text not null default 'member'
    check (intended_role in ('member','organizer','pro_owner','pro_staff','moderator','support','auditor','direction','admin')),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 10),
  use_count integer not null default 0 check (use_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, code_hash)
);
create index beta_invites_lookup_idx on public.beta_invites (email, expires_at)
  where revoked_at is null;

create table public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  status text not null default 'pending_consent'
    check (status in ('pending_consent','active','suspended','closed')),
  invited_role text not null default 'member',
  invitation_id uuid references public.beta_invites(id) on delete set null,
  email_verified_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  code text primary key,
  label text not null
);
insert into public.roles (code,label) values
  ('member','Membre Velvet'),
  ('organizer','Organisateur privé'),
  ('pro_owner','Propriétaire Velvet Pro'),
  ('pro_staff','Collaborateur Velvet Pro'),
  ('moderator','Modération'),
  ('support','Support'),
  ('auditor','Audit'),
  ('direction','Direction'),
  ('admin','Administration')
on conflict (code) do nothing;

create table public.account_roles (
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  role_code text not null references public.roles(code) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, role_code)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  purpose text not null
    check (purpose in ('terms','privacy','adult_declaration','sensitive_profile','precise_location','marketing_velvet','marketing_partners')),
  document_version text not null,
  granted boolean not null,
  source text not null default 'web_beta',
  occurred_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  evidence jsonb not null default '{}'::jsonb
);
create index consent_records_user_purpose_idx
  on public.consent_records (user_id, purpose, occurred_at desc);

create table public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  profile_type text not null check (profile_type in ('couple','individual')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  city text,
  location_zone text,
  story text,
  description text,
  search_text text,
  practices text[] not null default '{}',
  values_list text[] not null default '{}',
  visibility text not null default 'private'
    check (visibility in ('private','beta_members','published','suspended')),
  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_profiles_discovery_idx
  on public.member_profiles (visibility, profile_type, city)
  where visibility in ('beta_members','published');

create table public.profile_members (
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  member_slot text not null check (member_slot in ('individual','partner_a','partner_b')),
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id),
  unique (profile_id, member_slot)
);

create table public.individual_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  linked_user_id uuid references public.accounts(user_id) on delete set null,
  member_slot text not null check (member_slot in ('individual','partner_a','partner_b')),
  first_name text,
  birth_year smallint check (birth_year between 1900 and 2100),
  height_cm smallint check (height_cm between 100 and 250),
  weight_kg smallint check (weight_kg between 30 and 350),
  morphology text,
  hair_color text,
  eye_color text,
  children_status text check (children_status in ('yes','no','private')),
  profession text,
  profession_private boolean not null default true,
  orientation text,
  frequency text,
  biography text,
  attracted_to text[] not null default '{}',
  desired_practices text[] not null default '{}',
  partner_permissions text[] not null default '{}',
  visibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, member_slot)
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.accounts(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table public.circle_profiles (
  circle_id uuid not null references public.circles(id) on delete cascade,
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_id, profile_id)
);

create table public.favorites (
  owner_user_id uuid not null references public.accounts(user_id) on delete cascade,
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, profile_id)
);

create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('club','spa','bar','love_room','other')),
  description text,
  city text,
  address_public text,
  address_private text,
  phone_public text,
  email_public citext,
  opening_hours jsonb not null default '{}'::jsonb,
  amenities text[] not null default '{}',
  visibility text not null default 'draft'
    check (visibility in ('draft','review','published','suspended')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.establishment_staff (
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  staff_role text not null check (staff_role in ('owner','manager','editor','reception','finance')),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  created_at timestamptz not null default now(),
  primary key (establishment_id, user_id)
);

create table public.organizer_profiles (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null unique references public.member_profiles(id) on delete cascade,
  description text,
  status text not null default 'pending'
    check (status in ('pending','approved','suspended','revoked')),
  approved_by uuid references public.accounts(user_id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('establishment','organizer')),
  establishment_id uuid references public.establishments(id) on delete cascade,
  organizer_profile_id uuid references public.organizer_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null check (capacity between 2 and 10000),
  location_public text,
  location_private text,
  audience text,
  visibility text not null default 'draft'
    check (visibility in ('draft','review','published','cancelled','suspended')),
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_type='establishment' and establishment_id is not null and organizer_profile_id is null)
    or
    (owner_type='organizer' and organizer_profile_id is not null and establishment_id is null)
  ),
  check (ends_at is null or ends_at > starts_at)
);
create index events_schedule_idx on public.events (starts_at, visibility);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  places smallint not null default 1 check (places between 1 and 10),
  status text not null default 'pending'
    check (status in ('pending','confirmed','waitlisted','cancelled','declined','checked_in')),
  visible_to_participants boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id,user_id)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references public.member_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','establishment','organizer')),
  target_id uuid not null,
  body text not null check (char_length(body) between 10 and 2000),
  rating smallint check (rating between 1 and 5),
  status text not null default 'published' check (status in ('draft','published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','event','support')),
  event_id uuid references public.events(id) on delete set null,
  subject text,
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  display_identity text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  primary key (conversation_id,user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.accounts(user_id) on delete restrict,
  sender_identity text,
  body text not null check (char_length(body) between 1 and 10000),
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id,created_at desc);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  confidentiality text not null
    check (confidentiality in ('request','trusted_circle','private_circle','favorites','temporary')),
  expires_at timestamptz,
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  album_id uuid references public.albums(id) on delete cascade,
  owner_user_id uuid not null references public.accounts(user_id) on delete restrict,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  visibility text not null default 'private' check (visibility in ('profile','private','quarantined','removed')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  checksum text,
  created_at timestamptz not null default now()
);

create table public.album_access_grants (
  album_id uuid not null references public.albums(id) on delete cascade,
  grantee_user_id uuid not null references public.accounts(user_id) on delete cascade,
  granted_by uuid not null references public.accounts(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (album_id,grantee_user_id)
);

create table public.blocks (
  blocker_user_id uuid not null references public.accounts(user_id) on delete cascade,
  blocked_user_id uuid not null references public.accounts(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id,blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.accounts(user_id) on delete restrict,
  subject_type text not null check (subject_type in ('account','profile','message','media','event','establishment')),
  subject_id uuid not null,
  category text not null,
  description text,
  status text not null default 'open' check (status in ('open','assigned','resolved','dismissed','appealed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  request_type text not null check (request_type in ('access','portability','rectification','erasure','restriction','objection','withdraw_consent')),
  status text not null default 'received' check (status in ('received','verifying','processing','completed','rejected')),
  requested_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '1 month'),
  completed_at timestamptz,
  response_storage_path text
);

create table public.audit_events (
  sequence_number bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.accounts(user_id) on delete set null,
  actor_type text not null check (actor_type in ('user','system','ai_agent')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  event_hash text unique
);
create index audit_events_entity_idx
  on public.audit_events (entity_type,entity_id,sequence_number desc);

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;
create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

create trigger accounts_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
create trigger member_profiles_updated_at before update on public.member_profiles
for each row execute function public.set_updated_at();
create trigger individual_profiles_updated_at before update on public.individual_profiles
for each row execute function public.set_updated_at();
create trigger establishments_updated_at before update on public.establishments
for each row execute function public.set_updated_at();
create trigger organizer_profiles_updated_at before update on public.organizer_profiles
for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger event_registrations_updated_at before update on public.event_registrations
for each row execute function public.set_updated_at();
create trigger recommendations_updated_at before update on public.recommendations
for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger albums_updated_at before update on public.albums
for each row execute function public.set_updated_at();

-- The invite code is provided in signUp options.data.invite_code.
-- An invalid or expired invitation aborts the auth transaction.
create or replace function public.accept_invited_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.beta_invites;
  supplied_code text;
begin
  supplied_code := new.raw_user_meta_data ->> 'invite_code';
  if supplied_code is null or new.email is null then
    raise exception 'beta_invitation_required';
  end if;

  select *
    into invite
    from public.beta_invites
   where lower(email::text) = lower(new.email)
     and revoked_at is null
     and expires_at > now()
     and use_count < max_uses
     and code_hash = crypt(supplied_code,code_hash)
   order by created_at desc
   limit 1
   for update;

  if invite.id is null then
    raise exception 'beta_invitation_invalid';
  end if;

  update public.beta_invites
     set use_count = use_count + 1,
         consumed_at = case when use_count + 1 >= max_uses then now() else consumed_at end
   where id = invite.id;

  insert into public.accounts (user_id,email,status,invited_role,invitation_id)
  values (new.id,new.email,'pending_consent',invite.intended_role,invite.id);

  insert into public.account_roles (user_id,role_code)
  values (new.id,'member')
  on conflict do nothing;

  if invite.intended_role <> 'member' then
    insert into public.account_roles (user_id,role_code)
    values (new.id,invite.intended_role)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_from_invite
after insert on auth.users
for each row execute function public.accept_invited_signup();
