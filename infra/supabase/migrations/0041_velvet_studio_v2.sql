-- Velvet Studio V2 — projets, versions, assets et rendu audiovisuel.
-- À exécuter manuellement dans Supabase après la migration 0040.

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  objective text not null default '',
  audience text not null default '',
  channel text not null default 'Instagram',
  format text not null default '9:16' check (format in ('9:16','1:1','16:9')),
  status text not null default 'draft' check (status in ('draft','production','ready','archived')),
  duration_seconds numeric(7,2) not null default 0 check (duration_seconds between 0 and 90),
  project_data jsonb not null default '{}'::jsonb,
  brand_guard_score smallint not null default 100 check (brand_guard_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  label text not null default 'Version',
  project_data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.studio_projects(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  asset_kind text not null check (asset_kind in ('image','video','audio','logo','capture','font','other')),
  name text not null,
  storage_path text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  duration_seconds numeric(8,3),
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  job_kind text not null check (job_kind in ('manifest','voice','music','video','social_pack')),
  provider text not null default 'velvet-browser-renderer-v2',
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','local_fallback')),
  progress smallint not null default 0 check (progress between 0 and 100),
  request_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_projects_owner_updated_idx on public.studio_projects(owner_user_id,updated_at desc);
create index if not exists studio_versions_project_created_idx on public.studio_project_versions(project_id,created_at desc);
create index if not exists studio_assets_project_created_idx on public.studio_assets(project_id,created_at desc);
create index if not exists studio_render_jobs_project_created_idx on public.studio_render_jobs(project_id,created_at desc);
create index if not exists studio_render_jobs_status_idx on public.studio_render_jobs(status,created_at);

alter table public.studio_projects enable row level security;
alter table public.studio_project_versions enable row level security;
alter table public.studio_assets enable row level security;
alter table public.studio_render_jobs enable row level security;

create policy studio_projects_control_read on public.studio_projects
for select to authenticated
using (public.has_role('admin') or public.has_role('direction'));

create policy studio_projects_control_create on public.studio_projects
for insert to authenticated
with check (
  owner_user_id=auth.uid()
  and (public.has_role('admin') or public.has_role('direction'))
);

create policy studio_projects_control_update on public.studio_projects
for update to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (public.has_role('admin') or public.has_role('direction'));

create policy studio_projects_control_delete on public.studio_projects
for delete to authenticated
using (owner_user_id=auth.uid() and (public.has_role('admin') or public.has_role('direction')));

create policy studio_versions_control_all on public.studio_project_versions
for all to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (created_by=auth.uid() and (public.has_role('admin') or public.has_role('direction')));

create policy studio_assets_control_all on public.studio_assets
for all to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (uploaded_by=auth.uid() and (public.has_role('admin') or public.has_role('direction')));

create policy studio_render_jobs_control_read on public.studio_render_jobs
for select to authenticated
using (public.has_role('admin') or public.has_role('direction'));

create policy studio_render_jobs_control_create on public.studio_render_jobs
for insert to authenticated
with check (requested_by=auth.uid() and (public.has_role('admin') or public.has_role('direction')));

create policy studio_render_jobs_control_update on public.studio_render_jobs
for update to authenticated
using (public.has_role('admin') or public.has_role('direction'))
with check (public.has_role('admin') or public.has_role('direction'));

create or replace function public.control_save_studio_project(
  target_id uuid,
  target_title text,
  target_objective text,
  target_audience text,
  target_channel text,
  target_format text,
  target_status text,
  target_duration numeric,
  target_data jsonb,
  target_version_label text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'studio_control_required';
  end if;
  if target_format not in ('9:16','1:1','16:9') or target_status not in ('draft','production','ready','archived') then
    raise exception 'studio_project_invalid';
  end if;
  if target_duration < 0 or target_duration > 90 then
    raise exception 'studio_duration_invalid';
  end if;

  if target_id is null then
    insert into public.studio_projects(
      owner_user_id,title,objective,audience,channel,format,status,duration_seconds,project_data
    ) values (
      auth.uid(),btrim(target_title),coalesce(target_objective,''),coalesce(target_audience,''),
      coalesce(nullif(btrim(target_channel),''),'Instagram'),target_format,target_status,target_duration,coalesce(target_data,'{}'::jsonb)
    ) returning id into result_id;
  else
    update public.studio_projects
    set title=btrim(target_title),objective=coalesce(target_objective,''),audience=coalesce(target_audience,''),
        channel=coalesce(nullif(btrim(target_channel),''),'Instagram'),format=target_format,status=target_status,
        duration_seconds=target_duration,project_data=coalesce(target_data,'{}'::jsonb),updated_at=now()
    where id=target_id and (owner_user_id=auth.uid() or public.has_role('admin'))
    returning id into result_id;
    if result_id is null then raise exception 'studio_project_not_found'; end if;
  end if;

  if target_version_label is not null then
    insert into public.studio_project_versions(project_id,created_by,label,project_data)
    values(result_id,auth.uid(),left(btrim(target_version_label),120),coalesce(target_data,'{}'::jsonb));
  end if;

  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(auth.uid(),'control','studio_project_saved','studio_project',result_id,
         jsonb_build_object('status',target_status,'format',target_format,'duration',target_duration));
  return result_id;
end;
$$;

create or replace function public.control_create_studio_render_job(
  target_project uuid,
  target_kind text,
  target_provider text,
  target_request jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare result_id uuid;
begin
  if auth.uid() is null or not (public.has_role('admin') or public.has_role('direction')) then
    raise exception 'studio_control_required';
  end if;
  if target_kind not in ('manifest','voice','music','video','social_pack') then
    raise exception 'studio_job_kind_invalid';
  end if;
  if not exists(select 1 from public.studio_projects where id=target_project) then
    raise exception 'studio_project_not_found';
  end if;
  insert into public.studio_render_jobs(project_id,requested_by,job_kind,provider,request_data)
  values(target_project,auth.uid(),target_kind,coalesce(nullif(btrim(target_provider),''),'velvet-browser-renderer-v2'),coalesce(target_request,'{}'::jsonb))
  returning id into result_id;
  insert into public.audit_events(actor_user_id,actor_type,action,entity_type,entity_id,metadata)
  values(auth.uid(),'control','studio_render_requested','studio_render_job',result_id,
         jsonb_build_object('project_id',target_project,'kind',target_kind));
  return result_id;
end;
$$;

revoke all on function public.control_save_studio_project(uuid,text,text,text,text,text,text,numeric,jsonb,text) from public;
revoke all on function public.control_create_studio_render_job(uuid,text,text,jsonb) from public;
grant execute on function public.control_save_studio_project(uuid,text,text,text,text,text,text,numeric,jsonb,text) to authenticated;
grant execute on function public.control_create_studio_render_job(uuid,text,text,jsonb) to authenticated;
