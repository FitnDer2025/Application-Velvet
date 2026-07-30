create table if not exists public.member_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios')),
  token text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  bundle_id text not null,
  app_version text,
  locale text,
  active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_push_devices_user_device_key unique (user_id, device_id)
);

create index if not exists member_push_devices_active_user_idx
  on public.member_push_devices (user_id, last_registered_at desc)
  where active;

create index if not exists member_push_devices_token_idx
  on public.member_push_devices (token)
  where active;

alter table public.member_push_devices enable row level security;

drop policy if exists member_push_devices_select_own
  on public.member_push_devices;
create policy member_push_devices_select_own
  on public.member_push_devices
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists member_push_devices_insert_own
  on public.member_push_devices;
create policy member_push_devices_insert_own
  on public.member_push_devices
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists member_push_devices_update_own
  on public.member_push_devices;
create policy member_push_devices_update_own
  on public.member_push_devices
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists member_push_devices_delete_own
  on public.member_push_devices;
create policy member_push_devices_delete_own
  on public.member_push_devices
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.member_push_devices is
  'Jetons APNs actifs des appareils membres. Les clés privées APNs restent exclusivement côté serveur.';

