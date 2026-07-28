CREATE TABLE IF NOT EXISTS integration_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
  target text NOT NULL CHECK (target IN ('members', 'pro', 'control')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivering', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbox_event_id, target)
);

CREATE INDEX IF NOT EXISTS integration_deliveries_pending_idx
  ON integration_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'delivering');
