begin;

create table if not exists public.pro_studio_brand_kits (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  logo_storage_path text,
  secondary_logo_storage_path text,
  primary_color text not null default '#7D294C' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#0D0D0D' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#D5B477' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#09090B' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  typography_style text not null default 'editorial-premium',
  visual_style text not null default 'premium-club',
  density text not null default 'balanced' check (density in ('minimal','balanced','rich','event')),
  brand_prompt text not null default '',
  fixed_information jsonb not null default '{}'::jsonb,
  recurring_features jsonb not null default '[]'::jsonb,
  locked_rules jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_studio_projects (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  source_project_id uuid references public.pro_studio_projects(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','generating','ready','published','archived')),
  theme text not null default '',
  output_type text not null default 'poster' check (output_type in ('poster','social_kit','animated_poster','video_teaser')),
  event_payload jsonb not null default '{}'::jsonb,
  creative_payload jsonb not null default '{}'::jsonb,
  prompt_snapshot text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_studio_projects_establishment_updated_idx
  on public.pro_studio_projects(establishment_id, updated_at desc);

create table if not exists public.pro_studio_assets (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  project_id uuid references public.pro_studio_projects(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('logo','secondary_logo','event_photo','guest_photo','dj_photo','theme_reference','generated_background','render','video')),
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null default 0 check (byte_size >= 0),
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists pro_studio_assets_establishment_project_idx
  on public.pro_studio_assets(establishment_id, project_id, created_at desc);

create table if not exists public.pro_studio_renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.pro_studio_projects(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  render_type text not null check (render_type in ('image','animated','video')),
  format text not null check (format in ('9:16','4:5','1:1','16:9','a4')),
  variant_index integer not null default 1 check (variant_index between 1 and 12),
  storage_path text not null unique,
  mime_type text not null,
  composition jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('processing','ready','failed','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists pro_studio_renders_project_created_idx
  on public.pro_studio_renders(project_id, created_at desc);

create table if not exists public.pro_studio_templates (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  template_code text not null,
  name text not null,
  description text not null default '',
  configuration jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (establishment_id, template_code)
);

create or replace function public.pro_studio_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pro_studio_brand_kits_touch on public.pro_studio_brand_kits;
create trigger pro_studio_brand_kits_touch
before update on public.pro_studio_brand_kits
for each row execute function public.pro_studio_touch_updated_at();

drop trigger if exists pro_studio_projects_touch on public.pro_studio_projects;
create trigger pro_studio_projects_touch
before update on public.pro_studio_projects
for each row execute function public.pro_studio_touch_updated_at();

drop trigger if exists pro_studio_templates_touch on public.pro_studio_templates;
create trigger pro_studio_templates_touch
before update on public.pro_studio_templates
for each row execute function public.pro_studio_touch_updated_at();

alter table public.pro_studio_brand_kits enable row level security;
alter table public.pro_studio_projects enable row level security;
alter table public.pro_studio_assets enable row level security;
alter table public.pro_studio_renders enable row level security;
alter table public.pro_studio_templates enable row level security;

create or replace function public.can_manage_pro_studio(target_establishment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin')
    or exists (
      select 1
      from public.establishment_staff staff
      where staff.establishment_id = target_establishment
        and staff.user_id = auth.uid()
        and staff.status = 'active'
        and staff.staff_role in ('owner','manager','communication','editor')
    );
$$;

revoke all on function public.can_manage_pro_studio(uuid) from public;
grant execute on function public.can_manage_pro_studio(uuid) to authenticated;

create policy pro_studio_brand_kits_select on public.pro_studio_brand_kits
for select to authenticated using (public.can_manage_pro_studio(establishment_id));
create policy pro_studio_brand_kits_write on public.pro_studio_brand_kits
for all to authenticated using (public.can_manage_pro_studio(establishment_id))
with check (public.can_manage_pro_studio(establishment_id));

create policy pro_studio_projects_select on public.pro_studio_projects
for select to authenticated using (public.can_manage_pro_studio(establishment_id));
create policy pro_studio_projects_write on public.pro_studio_projects
for all to authenticated using (public.can_manage_pro_studio(establishment_id))
with check (public.can_manage_pro_studio(establishment_id));

create policy pro_studio_assets_select on public.pro_studio_assets
for select to authenticated using (public.can_manage_pro_studio(establishment_id));
create policy pro_studio_assets_write on public.pro_studio_assets
for all to authenticated using (public.can_manage_pro_studio(establishment_id))
with check (public.can_manage_pro_studio(establishment_id));

create policy pro_studio_renders_select on public.pro_studio_renders
for select to authenticated using (public.can_manage_pro_studio(establishment_id));
create policy pro_studio_renders_write on public.pro_studio_renders
for all to authenticated using (public.can_manage_pro_studio(establishment_id))
with check (public.can_manage_pro_studio(establishment_id));

create policy pro_studio_templates_select on public.pro_studio_templates
for select to authenticated using (
  is_system = true or public.can_manage_pro_studio(establishment_id)
);
create policy pro_studio_templates_write on public.pro_studio_templates
for all to authenticated using (
  is_system = false and public.can_manage_pro_studio(establishment_id)
) with check (
  is_system = false and public.can_manage_pro_studio(establishment_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'velvet-pro-studio',
  'velvet-pro-studio',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','video/webm','video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy pro_studio_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'velvet-pro-studio'
  and array_length(storage.foldername(name), 1) >= 1
  and public.can_manage_pro_studio((storage.foldername(name))[1]::uuid)
);

create policy pro_studio_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'velvet-pro-studio'
  and array_length(storage.foldername(name), 1) >= 1
  and public.can_manage_pro_studio((storage.foldername(name))[1]::uuid)
);

create policy pro_studio_storage_update on storage.objects
for update to authenticated using (
  bucket_id = 'velvet-pro-studio'
  and array_length(storage.foldername(name), 1) >= 1
  and public.can_manage_pro_studio((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'velvet-pro-studio'
  and array_length(storage.foldername(name), 1) >= 1
  and public.can_manage_pro_studio((storage.foldername(name))[1]::uuid)
);

create policy pro_studio_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'velvet-pro-studio'
  and array_length(storage.foldername(name), 1) >= 1
  and public.can_manage_pro_studio((storage.foldername(name))[1]::uuid)
);

insert into public.pro_studio_templates (template_code, name, description, configuration, is_system)
values
  ('neon-club', 'Néon Club', 'Affiche dense et festive, contrastes rose et bleu, adaptée aux week-ends et anniversaires.', '{"visualStyle":"neon club, nightlife, premium, magenta and electric blue lighting","layout":"event","effects":["neon","glow","confetti"]}'::jsonb, true),
  ('velvet-luxe', 'Velvet Luxe', 'Composition bordeaux, noire et champagne, élégante et sensuelle.', '{"visualStyle":"luxury french nightlife, burgundy black champagne, editorial lighting","layout":"balanced","effects":["silk","gold","soft glow"]}'::jsonb, true),
  ('electric-night', 'Electric Night', 'Univers électro énergique et lisible pour DJ, performers et grandes soirées.', '{"visualStyle":"electric nightlife, laser, energetic premium club poster","layout":"rich","effects":["laser","particles","light streaks"]}'::jsonb, true),
  ('dark-desire', 'Dark Desire', 'Ambiance sombre, sophistiquée et mystérieuse.', '{"visualStyle":"dark sophisticated club, cinematic shadows, discreet sensuality","layout":"balanced","effects":["smoke","rim light","deep contrast"]}'::jsonb, true),
  ('summer-pool', 'Summer Pool', 'Affiche lumineuse pour soirées estivales, pool party et thèmes tropicaux.', '{"visualStyle":"premium summer pool party, tropical nightlife, elegant adults","layout":"rich","effects":["water reflections","sunset","festive lights"]}'::jsonb, true)
on conflict (establishment_id, template_code) do nothing;

commit;
