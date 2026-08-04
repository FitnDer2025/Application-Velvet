-- Velvet Studio V1 - logical PostgreSQL model

create table studio_campaigns (
  id uuid primary key,
  title text not null,
  target text not null check (target in ('members','professionals','brand')),
  objective text not null,
  status text not null default 'draft',
  brief jsonb not null default '{}'::jsonb,
  brand_score numeric(5,2),
  created_by uuid not null,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table studio_assets (
  id uuid primary key,
  campaign_id uuid references studio_campaigns(id) on delete cascade,
  asset_type text not null check (asset_type in ('image','video','audio','subtitle','script','storyboard','export')),
  source_type text not null check (source_type in ('upload','velvet_capture','generated','rendered')),
  provider text,
  provider_job_id text,
  storage_key text not null,
  mime_type text not null,
  width integer,
  height integer,
  duration_ms integer,
  prompt text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table studio_generations (
  id uuid primary key,
  campaign_id uuid references studio_campaigns(id) on delete cascade,
  asset_id uuid references studio_assets(id) on delete set null,
  provider text not null,
  model text,
  operation text not null,
  status text not null,
  prompt text,
  estimated_cost numeric(12,6) default 0,
  actual_cost numeric(12,6) default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table studio_brand_checks (
  id uuid primary key,
  campaign_id uuid references studio_campaigns(id) on delete cascade,
  asset_id uuid references studio_assets(id) on delete cascade,
  rule_code text not null,
  severity text not null check (severity in ('info','warning','critical')),
  passed boolean not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table studio_exports (
  id uuid primary key,
  campaign_id uuid references studio_campaigns(id) on delete cascade,
  channel text not null,
  format text not null check (format in ('9:16','1:1','16:9')),
  asset_id uuid references studio_assets(id),
  caption text,
  hashtags text[],
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table studio_audit_log (
  id uuid primary key,
  campaign_id uuid references studio_campaigns(id) on delete cascade,
  actor_id uuid,
  actor_type text not null check (actor_type in ('human','ai','system')),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index studio_assets_campaign_idx on studio_assets(campaign_id);
create index studio_generations_campaign_idx on studio_generations(campaign_id, created_at desc);
create index studio_brand_checks_campaign_idx on studio_brand_checks(campaign_id, severity);
create index studio_audit_campaign_idx on studio_audit_log(campaign_id, created_at desc);