CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (code, label) VALUES
  ('member', 'Membre Velvet'),
  ('pro_owner', 'Propriétaire Velvet Pro'),
  ('pro_staff', 'Collaborateur Velvet Pro'),
  ('organizer', 'Organisateur privé'),
  ('moderator', 'Modération'),
  ('support', 'Support'),
  ('auditor', 'Audit'),
  ('admin', 'Administration'),
  ('direction', 'Direction')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  audience text NOT NULL CHECK (audience IN ('members', 'pro', 'control')),
  user_agent text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by_rotation boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_active_idx
  ON refresh_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_type text NOT NULL CHECK (profile_type IN ('individual', 'couple')),
  display_name text NOT NULL,
  city text,
  public_story text,
  private_details_encrypted text,
  onboarding_status text NOT NULL DEFAULT 'started'
    CHECK (onboarding_status IN ('started', 'identity', 'profile', 'preferences', 'completed')),
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'members', 'published')),
  trust_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_profiles_discovery_idx
  ON member_profiles (visibility, profile_type, city)
  WHERE visibility = 'published';

CREATE TABLE IF NOT EXISTS couple_memberships (
  couple_profile_id uuid NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_label text NOT NULL CHECK (partner_label IN ('partner_a', 'partner_b')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_profile_id, user_id),
  UNIQUE (couple_profile_id, partner_label)
);

CREATE TABLE IF NOT EXISTS establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('club', 'spa', 'bar', 'love_room', 'other')),
  description text,
  city text,
  address_public text,
  address_private_encrypted text,
  website_url text,
  phone_public text,
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('draft', 'review', 'published', 'suspended')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS establishments_public_idx
  ON establishments (kind, city)
  WHERE visibility = 'published';

CREATE TABLE IF NOT EXISTS establishment_staff (
  establishment_id uuid NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'editor', 'support')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'revoked')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (establishment_id, user_id)
);

CREATE TABLE IF NOT EXISTS organizer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'suspended', 'revoked')),
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('establishment', 'organizer')),
  establishment_id uuid REFERENCES establishments(id) ON DELETE CASCADE,
  organizer_profile_id uuid REFERENCES organizer_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  capacity integer NOT NULL CHECK (capacity > 0 AND capacity <= 10000),
  visibility text NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('draft', 'review', 'published', 'cancelled')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (owner_type = 'establishment' AND establishment_id IS NOT NULL AND organizer_profile_id IS NULL)
    OR
    (owner_type = 'organizer' AND organizer_profile_id IS NOT NULL AND establishment_id IS NULL)
  ),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS events_public_schedule_idx
  ON events (starts_at, owner_type)
  WHERE visibility = 'published';

CREATE TABLE IF NOT EXISTS event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'waitlisted', 'cancelled', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_registrations_event_status_idx
  ON event_registrations (event_id, status);

CREATE TABLE IF NOT EXISTS ai_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  policy jsonb NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deployed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deployed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_policies_one_active_idx
  ON ai_policies ((status))
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user', 'profile', 'media', 'message', 'establishment', 'event')),
  subject_id uuid NOT NULL,
  risk_category text NOT NULL,
  confidence numeric(5,2) CHECK (confidence BETWEEN 0 AND 100),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_action text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'resolved', 'dismissed', 'appealed')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  human_decision jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS moderation_cases_queue_idx
  ON moderation_cases (status, severity, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  sequence_number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'ai_agent')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  previous_hash char(64) NOT NULL,
  event_hash char(64) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON audit_events (entity_type, entity_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON audit_events (actor_user_id, sequence_number DESC);

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx
  ON outbox_events (occurred_at)
  WHERE published_at IS NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'member_profiles', 'establishments', 'organizer_profiles',
    'events', 'event_registrations', 'moderation_cases'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;
